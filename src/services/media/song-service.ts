/**
 * SongService — Recherche et téléchargement de musiques / audio.
 *
 * Fonctionnalités :
 * - Recherche multi-sources ultra-précise (YouTube, YouTube Music) sans clé API requise
 * - Extraction des métadonnées (titre, artiste, durée, miniature)
 * - Téléchargement audio haute qualité (MP3 / M4A) avec multi-fournisseurs de secours
 * - Sécurisé avec timeout et limite de taille
 */

import logger from '../../core/logger/logger.js';

export interface SongMetadata {
  videoId: string;
  url: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
}

export interface SongDownloadResult {
  success: boolean;
  metadata?: SongMetadata;
  audioBuffer?: Buffer;
  audioUrl?: string;
  error?: string;
}

const MAX_AUDIO_BYTES = 45 * 1024 * 1024; // 45 MB max
const FETCH_TIMEOUT_MS = 25_000;

export class SongService {
  private static instance: SongService;

  private constructor() {}

  public static getInstance(): SongService {
    if (!SongService.instance) {
      SongService.instance = new SongService();
    }
    return SongService.instance;
  }

  /**
   * 1. Recherche une chanson sur YouTube par titre / artiste / référence
   */
  public async searchSong(query: string): Promise<SongMetadata | null> {
    try {
      logger.info(`[SongService] Searching music for query: "${query}"`);

      // Si c'est déjà une URL YouTube
      const ytUrlMatch = query.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (ytUrlMatch) {
        const videoId = ytUrlMatch[1];
        return {
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title: 'YouTube Audio',
          artist: 'Artiste',
          duration: 'Audio',
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        };
      }

      // Recherche native YouTube
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' audio')}`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        signal: AbortSignal.timeout(10_000)
      });

      if (!response.ok) {
        logger.warn(`[SongService] YouTube search returned status ${response.status}`);
        return null;
      }

      const html = await response.text();
      const match = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData\s*=\s*({.+?});/);

      if (match) {
        const data = JSON.parse(match[1]);
        const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

        if (Array.isArray(contents)) {
          const firstVideo = contents.find((c: any) => c.videoRenderer)?.videoRenderer;
          if (firstVideo && firstVideo.videoId) {
            const title = firstVideo.title?.runs?.[0]?.text || 'Musique';
            const artist = firstVideo.ownerText?.runs?.[0]?.text || 'Inconnu';
            const duration = firstVideo.lengthText?.simpleText || '3:00';
            const thumbnails = firstVideo.thumbnail?.thumbnails || [];
            const thumbnail = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : `https://i.ytimg.com/vi/${firstVideo.videoId}/hqdefault.jpg`;

            return {
              videoId: firstVideo.videoId,
              url: `https://www.youtube.com/watch?v=${firstVideo.videoId}`,
              title,
              artist,
              duration,
              thumbnail
            };
          }
        }
      }

      return null;
    } catch (err: any) {
      logger.error({ error: err.message || err }, '[SongService] Error searching song');
      return null;
    }
  }

  /**
   * 2. Télécharge l'audio de la chanson avec plusieurs serveurs de secours
   */
  public async downloadSongAudio(metadata: SongMetadata): Promise<SongDownloadResult> {
    const videoUrl = metadata.url;
    logger.info(`[SongService] Downloading audio for "${metadata.title}" (${videoUrl})`);

    const downloadProviders = [
      // Provider 1: API Direct YTMP3
      async () => {
        const apiUrl = `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`;
        const res = await fetch(apiUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (res.ok) {
          const data: any = await res.json().catch(() => null);
          const dlUrl = data?.data?.dl || data?.data?.url || data?.result?.download;
          if (dlUrl) return this.fetchBufferSafe(dlUrl);
        }
        return null;
      },

      // Provider 2: Freemake converter
      async () => {
        const apiUrl = `https://api.vevioz.com/api/button/mp3/${metadata.videoId}`;
        const res = await fetch(apiUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (res.ok) {
          const html = await res.text();
          const match = html.match(/href="([^"]+\.mp3[^"]*)"/i) || html.match(/src="([^"]+\.mp3[^"]*)"/i);
          if (match && match[1]) {
            return this.fetchBufferSafe(match[1]);
          }
        }
        return null;
      },

      // Provider 3: API Ytdl aggregator
      async () => {
        const apiUrl = `https://api.agatz.xyz/api/ytmp3?url=${encodeURIComponent(videoUrl)}`;
        const res = await fetch(apiUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (res.ok) {
          const data: any = await res.json().catch(() => null);
          const dl = data?.data?.downloadUrl || data?.result?.dl;
          if (dl) return this.fetchBufferSafe(dl);
        }
        return null;
      },

      // Provider 4: Widipe
      async () => {
        const apiUrl = `https://widipe.com/download/ytdl?url=${encodeURIComponent(videoUrl)}`;
        const res = await fetch(apiUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (res.ok) {
          const data: any = await res.json().catch(() => null);
          const dl = data?.result?.mp3 || data?.data?.mp3;
          if (dl) return this.fetchBufferSafe(dl);
        }
        return null;
      }
    ];

    for (let i = 0; i < downloadProviders.length; i++) {
      try {
        const buffer = await downloadProviders[i]();
        if (buffer && buffer.length > 10_000) {
          logger.info(`[SongService] Successfully downloaded audio using provider #${i + 1} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
          return {
            success: true,
            metadata,
            audioBuffer: buffer
          };
        }
      } catch (e: any) {
        logger.debug(`[SongService] Provider #${i + 1} failed: ${e.message}`);
      }
    }

    return {
      success: false,
      metadata,
      error: `Impossible de récupérer le flux audio pour "${metadata.title}". Veuillez réessayer dans un instant.`
    };
  }

  /**
   * Helper sécurisé pour télécharger le buffer
   */
  private async fetchBufferSafe(url: string): Promise<Buffer | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) return null;

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_AUDIO_BYTES) {
        logger.warn(`[SongService] Audio file exceeds max limit (${arrayBuffer.byteLength} bytes)`);
        return null;
      }

      return Buffer.from(arrayBuffer);
    } catch {
      clearTimeout(timer);
      return null;
    }
  }
}

export default SongService.getInstance();
