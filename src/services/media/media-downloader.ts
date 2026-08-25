/**
 * MediaDownloaderService — Service de téléchargement média sécurisé (TikTok, YouTube, Instagram, etc.)
 *
 * Sécurité renforcée :
 * - Protection SSRF (blocage localhost, IP privées, métadonnées cloud)
 * - Timeout réseau strict (30 secondes max par requête)
 * - Limite de taille mémoire stricte (50 Mo max par média téléchargé pour prévenir les OOM)
 */

import logger from '../../core/logger/logger.js';

export interface DownloadResult {
  success: boolean;
  type: 'video' | 'audio' | 'image';
  buffer?: Buffer;
  url?: string;
  title?: string;
  author?: string;
  error?: string;
}

const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
const FETCH_TIMEOUT_MS = 30_000; // 30 seconds

/**
 * Valide qu'une URL est publique et légitime (Protection Anti-SSRF).
 */
function isSafePublicUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    const host = parsed.hostname.toLowerCase();

    // Bloquer localhost et adresses locales / privées
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host) ||
      host === '169.254.169.254' // AWS / GCP / Azure metadata endpoint
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Télécharge un flux média de manière sécurisée avec limitation de taille et timeout.
 */
async function safeFetchBuffer(url: string, customHeaders: Record<string, string> = {}): Promise<Buffer | null> {
  if (!isSafePublicUrl(url)) {
    logger.warn(`[MediaDownloader] Blocked potentially unsafe URL (SSRF Guard): ${url}`);
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...customHeaders
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_BYTES) {
      logger.warn(`[MediaDownloader] Media exceeds maximum allowed size (${contentLength} bytes > ${MAX_DOWNLOAD_BYTES})`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
      logger.warn(`[MediaDownloader] Downloaded buffer exceeds max size (${arrayBuffer.byteLength} bytes)`);
      return null;
    }

    return Buffer.from(arrayBuffer);
  } catch (err: any) {
    clearTimeout(timeoutId);
    logger.error({ error: err.message || err }, `[MediaDownloader] Network error fetching media`);
    return null;
  }
}

export class MediaDownloaderService {
  private static instance: MediaDownloaderService;

  private constructor() {}

  public static getInstance(): MediaDownloaderService {
    if (!MediaDownloaderService.instance) {
      MediaDownloaderService.instance = new MediaDownloaderService();
    }
    return MediaDownloaderService.instance;
  }

  /**
   * Downloads TikTok video (No Watermark) or audio
   */
  public async downloadTikTok(tiktokUrl: string, audioOnly = false): Promise<DownloadResult> {
    if (!isSafePublicUrl(tiktokUrl)) {
      return { success: false, type: 'video', error: 'Lien invalide ou non autorisé.' };
    }

    try {
      logger.info(`[MediaDownloader] Downloading TikTok from: ${tiktokUrl}`);

      // Primary API: TikWM
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}`;
      const response = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      }).catch(() => null);

      if (response && response.ok) {
        const data: any = await response.json().catch(() => null);
        if (data && data.code === 0 && data.data) {
          const targetMediaUrl = audioOnly ? data.data.music : (data.data.play || data.data.wmplay);
          const title = data.data.title || 'Vidéo TikTok';
          const author = data.data.author?.nickname || 'TikTok Creator';

          if (targetMediaUrl) {
            const buffer = await safeFetchBuffer(targetMediaUrl);
            if (buffer) {
              return {
                success: true,
                type: audioOnly ? 'audio' : 'video',
                buffer,
                url: targetMediaUrl,
                title,
                author
              };
            }
          }
        }
      }

      // Fallback API: TiklyDown
      try {
        const fbUrl = `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(tiktokUrl)}`;
        const fbRes = await fetch(fbUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (fbRes.ok) {
          const fbData: any = await fbRes.json();
          const targetUrl = audioOnly ? fbData.music?.play_url : fbData.video?.noWatermark;
          if (targetUrl) {
            const buffer = await safeFetchBuffer(targetUrl);
            if (buffer) {
              return {
                success: true,
                type: audioOnly ? 'audio' : 'video',
                buffer,
                title: fbData.title || 'Vidéo TikTok',
                author: fbData.author?.name || 'TikTok'
              };
            }
          }
        }
      } catch (_) {}

      return {
        success: false,
        type: 'video',
        error: 'Impossible de récupérer la vidéo TikTok. Vérifiez que le lien est public.'
      };
    } catch (err: any) {
      logger.error({ error: err.message || err }, '[MediaDownloader] TikTok download failed');
      return {
        success: false,
        type: 'video',
        error: err.message || 'Erreur lors du téléchargement TikTok'
      };
    }
  }

  /**
   * Downloads YouTube video / audio
   */
  public async downloadYouTube(ytUrl: string, audioOnly = false): Promise<DownloadResult> {
    if (!isSafePublicUrl(ytUrl)) {
      return { success: false, type: audioOnly ? 'audio' : 'video', error: 'Lien YouTube invalide.' };
    }

    try {
      logger.info(`[MediaDownloader] Downloading YouTube from: ${ytUrl}`);

      const endpoint = audioOnly
        ? `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(ytUrl)}`
        : `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(ytUrl)}`;

      const res = await fetch(endpoint, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(() => null);
      if (res && res.ok) {
        const data: any = await res.json().catch(() => null);
        const dlUrl = data?.data?.dl || data?.data?.url || data?.result?.download;
        const title = data?.data?.title || data?.result?.title || 'YouTube Media';

        if (dlUrl) {
          const buffer = await safeFetchBuffer(dlUrl);
          if (buffer) {
            return {
              success: true,
              type: audioOnly ? 'audio' : 'video',
              buffer,
              title
            };
          }
        }
      }

      return {
        success: false,
        type: audioOnly ? 'audio' : 'video',
        error: 'Service YouTube temporairement indisponible. Veuillez réessayer dans quelques instants.'
      };
    } catch (err: any) {
      return {
        success: false,
        type: audioOnly ? 'audio' : 'video',
        error: err.message || 'Erreur lors du téléchargement YouTube'
      };
    }
  }

  /**
   * Downloads Instagram Post / Reel
   */
  public async downloadInstagram(igUrl: string): Promise<DownloadResult> {
    if (!isSafePublicUrl(igUrl)) {
      return { success: false, type: 'video', error: 'Lien Instagram invalide.' };
    }

    try {
      logger.info(`[MediaDownloader] Downloading Instagram from: ${igUrl}`);
      const endpoint = `https://api.siputzx.my.id/api/d/igdl?url=${encodeURIComponent(igUrl)}`;
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(() => null);

      if (res && res.ok) {
        const data: any = await res.json().catch(() => null);
        const firstItem = data?.data?.[0] || data?.result?.[0];
        const dlUrl = typeof firstItem === 'string' ? firstItem : firstItem?.url;

        if (dlUrl) {
          const buffer = await safeFetchBuffer(dlUrl);
          if (buffer) {
            const isVideo = dlUrl.includes('.mp4') || firstItem?.type === 'video';
            return {
              success: true,
              type: isVideo ? 'video' : 'image',
              buffer,
              title: 'Instagram Post'
            };
          }
        }
      }

      return {
        success: false,
        type: 'video',
        error: 'Impossible de télécharger ce contenu Instagram. Assurez-vous que le compte est public.'
      };
    } catch (err: any) {
      return {
        success: false,
        type: 'video',
        error: err.message || 'Erreur lors du téléchargement Instagram'
      };
    }
  }
}

export default MediaDownloaderService.getInstance();
