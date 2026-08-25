/**
 * MediaDownloaderService — Service de téléchargement média universel et sécurisé
 * (Facebook, TikTok, YouTube, Instagram, Twitter / X, etc.)
 *
 * Moteur principal : yt-dlp natif avec fallbacks APIs sécurisées.
 * Protection : SSRF, limite de mémoire 50MB, timeouts réseau.
 */

import { youtubeDl } from 'youtube-dl-exec';
import { readFileSync, unlinkSync, existsSync, readdirSync } from 'fs';
import os from 'os';
import path from 'path';
import logger from '../../core/logger/logger.js';

export interface DownloadResult {
  success: boolean;
  type: 'video' | 'audio' | 'image';
  buffer?: Buffer;
  url?: string;
  title?: string;
  author?: string;
  fileName?: string;
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
        ...customHeaders,
      },
      signal: controller.signal,
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

/**
 * Télécharge directement via yt-dlp vers un fichier temporaire avec nettoyage automatique.
 */
async function downloadViaYtDlp(
  targetUrl: string,
  options: { audioOnly?: boolean; customFormat?: string } = {}
): Promise<{ buffer: Buffer; title?: string; ext: string } | null> {
  const tempPrefix = `abel_dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const tempTemplate = path.join(os.tmpdir(), `${tempPrefix}.%(ext)s`);

  const format = options.customFormat || (options.audioOnly
    ? 'bestaudio[ext=m4a]/bestaudio[acodec^=mp4a]/bestaudio/best'
    : 'best[ext=mp4][vcodec!=none][acodec!=none]/best[ext=mp4]/hd/sd/best');

  try {
    logger.info(`[MediaDownloader] yt-dlp downloading: ${targetUrl}`);
    await youtubeDl(targetUrl, {
      output: tempTemplate,
      format,
      noWarnings: true,
    });

    const tmpDir = os.tmpdir();
    const files = readdirSync(tmpDir).filter(f => f.startsWith(tempPrefix));

    if (files.length === 0) return null;

    const downloadedFile = path.join(tmpDir, files[0]);
    const ext = path.extname(downloadedFile).replace('.', '') || (options.audioOnly ? 'm4a' : 'mp4');
    const buffer = readFileSync(downloadedFile);

    // Supprimer le fichier temporaire
    try {
      if (existsSync(downloadedFile)) unlinkSync(downloadedFile);
    } catch {
      // Ignorer
    }

    return { buffer, ext };
  } catch (err: any) {
    logger.debug(`[MediaDownloader] yt-dlp direct download failed: ${err.message}`);
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
   * 1. Téléchargement Facebook (Vidéo / Reel / Watch / Post / Audio)
   */
  public async downloadFacebook(fbUrl: string, audioOnly = false): Promise<DownloadResult> {
    if (!isSafePublicUrl(fbUrl)) {
      return { success: false, type: audioOnly ? 'audio' : 'video', error: 'Lien Facebook invalide.' };
    }

    logger.info(`[MediaDownloader] Downloading Facebook: ${fbUrl} (audioOnly: ${audioOnly})`);

    // Tier 1: SnapSave / SnapCDN HD & SD Extractor (Garantit une vidéo H.264 + AAC complète sans écran noir)
    try {
      const snapApi = `https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(fbUrl)}`;
      const res = await fetch(snapApi, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(() => null);
      if (res && res.ok) {
        const data: any = await res.json().catch(() => null);
        const downloads: any[] = data?.data?.downloads || [];
        // Préférer la qualité HD 720p puis SD 360p
        const hdItem = downloads.find((d: any) => d.quality?.includes('HD') || d.quality?.includes('720p'));
        const sdItem = downloads.find((d: any) => d.quality?.includes('SD') || d.quality?.includes('360p'));
        const targetUrl = hdItem?.url || sdItem?.url || downloads[0]?.url || data?.data?.video_hd || data?.data?.video_sd;

        if (targetUrl) {
          const buffer = await safeFetchBuffer(targetUrl);
          if (buffer && buffer.length > 10_000) {
            logger.info(`[MediaDownloader] Facebook video downloaded via SnapCDN: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);
            return {
              success: true,
              type: audioOnly ? 'audio' : 'video',
              buffer,
              title: data?.data?.title || 'Vidéo Facebook',
              fileName: `facebook_${Date.now()}.${audioOnly ? 'm4a' : 'mp4'}`,
            };
          }
        }
      }
    } catch (err: any) {
      logger.debug(`[MediaDownloader] SnapCDN Facebook failed: ${err.message}`);
    }

    // Tier 2: yt-dlp direct avec formats progressifs combinés
    const ytdlRes = await downloadViaYtDlp(fbUrl, { audioOnly });
    if (ytdlRes && ytdlRes.buffer.length > 10_000) {
      return {
        success: true,
        type: audioOnly ? 'audio' : 'video',
        buffer: ytdlRes.buffer,
        title: 'Vidéo Facebook',
        fileName: `facebook_${Date.now()}.${ytdlRes.ext}`,
      };
    }

    return {
      success: false,
      type: audioOnly ? 'audio' : 'video',
      error: 'Impossible de télécharger la vidéo Facebook. Assurez-vous que la vidéo est publique et accessible.',
    };
  }

  /**
   * 2. Téléchargement TikTok (sans filigrane) ou audio
   */
  public async downloadTikTok(tiktokUrl: string, audioOnly = false): Promise<DownloadResult> {
    if (!isSafePublicUrl(tiktokUrl)) {
      return { success: false, type: 'video', error: 'Lien TikTok invalide.' };
    }

    logger.info(`[MediaDownloader] Downloading TikTok from: ${tiktokUrl}`);

    // Tier 1: API TikWM (rapide sans filigrane)
    try {
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}`;
      const response = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
                author,
              };
            }
          }
        }
      }
    } catch (_) {}

    // Tier 2: yt-dlp fallback
    const ytdlRes = await downloadViaYtDlp(tiktokUrl, { audioOnly });
    if (ytdlRes && ytdlRes.buffer.length > 10_000) {
      return {
        success: true,
        type: audioOnly ? 'audio' : 'video',
        buffer: ytdlRes.buffer,
        title: 'Vidéo TikTok',
        fileName: `tiktok_${Date.now()}.${ytdlRes.ext}`,
      };
    }

    return {
      success: false,
      type: 'video',
      error: 'Impossible de récupérer la vidéo TikTok. Vérifiez que le lien est public.',
    };
  }

  /**
   * 3. Téléchargement YouTube (Vidéo MP4 / Audio MP3)
   */
  public async downloadYouTube(ytUrl: string, audioOnly = false): Promise<DownloadResult> {
    if (!isSafePublicUrl(ytUrl)) {
      return { success: false, type: audioOnly ? 'audio' : 'video', error: 'Lien YouTube invalide.' };
    }

    logger.info(`[MediaDownloader] Downloading YouTube: ${ytUrl} (audioOnly: ${audioOnly})`);

    const ytdlRes = await downloadViaYtDlp(ytUrl, { audioOnly });
    if (ytdlRes && ytdlRes.buffer.length > 10_000) {
      return {
        success: true,
        type: audioOnly ? 'audio' : 'video',
        buffer: ytdlRes.buffer,
        title: 'YouTube Media',
        fileName: `youtube_${Date.now()}.${ytdlRes.ext}`,
      };
    }

    return {
      success: false,
      type: audioOnly ? 'audio' : 'video',
      error: 'Impossible de télécharger le média YouTube. Vérifiez le lien.',
    };
  }

  /**
   * 4. Téléchargement Instagram (Reel, Vidéo, Post)
   */
  public async downloadInstagram(igUrl: string): Promise<DownloadResult> {
    if (!isSafePublicUrl(igUrl)) {
      return { success: false, type: 'video', error: 'Lien Instagram invalide.' };
    }

    logger.info(`[MediaDownloader] Downloading Instagram: ${igUrl}`);

    // Tier 1: yt-dlp
    const ytdlRes = await downloadViaYtDlp(igUrl);
    if (ytdlRes && ytdlRes.buffer.length > 10_000) {
      return {
        success: true,
        type: 'video',
        buffer: ytdlRes.buffer,
        title: 'Instagram Media',
        fileName: `instagram_${Date.now()}.${ytdlRes.ext}`,
      };
    }

    // Tier 2: API fallback
    try {
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
              title: 'Instagram Post',
            };
          }
        }
      }
    } catch (_) {}

    return {
      success: false,
      type: 'video',
      error: 'Impossible de télécharger ce contenu Instagram. Assurez-vous que le compte est public.',
    };
  }

  /**
   * 5. Téléchargement Twitter / X
   */
  public async downloadTwitter(twUrl: string): Promise<DownloadResult> {
    if (!isSafePublicUrl(twUrl)) {
      return { success: false, type: 'video', error: 'Lien Twitter / X invalide.' };
    }

    logger.info(`[MediaDownloader] Downloading Twitter / X: ${twUrl}`);

    const ytdlRes = await downloadViaYtDlp(twUrl);
    if (ytdlRes && ytdlRes.buffer.length > 10_000) {
      return {
        success: true,
        type: 'video',
        buffer: ytdlRes.buffer,
        title: 'Twitter / X Vidéo',
        fileName: `twitter_${Date.now()}.${ytdlRes.ext}`,
      };
    }

    return {
      success: false,
      type: 'video',
      error: 'Impossible de télécharger la vidéo Twitter / X. Vérifiez le lien.',
    };
  }
}

export default MediaDownloaderService.getInstance();
