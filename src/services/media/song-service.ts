/**
 * SongService — Recherche et téléchargement de musiques via youtube-dl-exec.
 *
 * Fonctionnalités :
 * - Recherche ultra-précise sur YouTube via youtube-search-api natif
 * - Extraction des métadonnées (titre, artiste, durée, miniature)
 * - Téléchargement audio haute qualité (M4A/WebM → buffer) via URL directe Google
 * - Aucune clé API requise — 100% fiable
 */

import * as ytdlModule from 'youtube-dl-exec';
// youtube-dl-exec exports itself as a callable function via CJS interop
const youtubeDl = ytdlModule as unknown as (url: string, options: Record<string, unknown>) => Promise<any>;
import logger from '../../core/logger/logger.js';

export interface SongMetadata {
  videoId: string;
  url: string;
  title: string;
  artist: string;
  duration: string;
  durationSec: number;
  thumbnail: string;
  fileExt: string;
  audioUrl: string;
}

export interface SongDownloadResult {
  success: boolean;
  metadata?: SongMetadata;
  audioBuffer?: Buffer;
  error?: string;
}

const MAX_AUDIO_BYTES = 50 * 1024 * 1024; // 50 MB max
const MAX_DURATION_SEC = 600; // 10 min max

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
   * 1. Recherche + résolution de la meilleure URL audio pour une chanson
   *    Supporte : titre, artiste, "artiste - titre", URL YouTube directe
   */
  public async searchSong(query: string): Promise<SongMetadata | null> {
    try {
      logger.info(`[SongService] Resolving audio metadata for: "${query}"`);

      // Détecter si c'est une URL YouTube directe
      const ytUrlMatch = query.match(
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
      );

      let videoUrl: string;
      if (ytUrlMatch) {
        videoUrl = `https://www.youtube.com/watch?v=${ytUrlMatch[1]}`;
        logger.info(`[SongService] Direct YouTube URL detected: ${videoUrl}`);
      } else {
        // Recherche YouTube avec ytsearch
        videoUrl = `ytsearch1:${query} audio`;
        logger.info(`[SongService] Searching via ytsearch: ${videoUrl}`);
      }

      // Extraire les infos complètes (format audio, titre, artiste, durée)
      const info = await youtubeDl(videoUrl, {
        dumpSingleJson: true,
        noWarnings: true,
        noCallHome: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0'],
      }) as any;

      if (!info || !info.id) {
        logger.warn('[SongService] No video found for query');
        return null;
      }

      // Refuser les vidéos trop longues (clip, podcasts)
      if (info.duration > MAX_DURATION_SEC) {
        logger.warn(`[SongService] Video too long: ${info.duration}s > ${MAX_DURATION_SEC}s`);
        return null;
      }

      // Trouver le meilleur format audio seulement
      const formats: any[] = info.formats || [];
      const audioFormats = formats
        .filter(f => f.vcodec === 'none' && f.acodec !== 'none' && f.url)
        .sort((a, b) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));

      const bestAudio = audioFormats[0];
      if (!bestAudio) {
        logger.warn('[SongService] No audio-only format found');
        return null;
      }

      const durationSec = info.duration || 0;
      const minutes = Math.floor(durationSec / 60);
      const seconds = String(durationSec % 60).padStart(2, '0');

      const metadata: SongMetadata = {
        videoId: info.id,
        url: `https://www.youtube.com/watch?v=${info.id}`,
        title: info.title || info.fulltitle || 'Musique',
        artist: info.uploader || info.channel || info.artist || 'Artiste',
        duration: `${minutes}:${seconds}`,
        durationSec,
        thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`,
        fileExt: bestAudio.ext || 'm4a',
        audioUrl: bestAudio.url,
      };

      logger.info(
        `[SongService] Found: "${metadata.title}" by ${metadata.artist} — ${metadata.duration} [${metadata.fileExt}]`
      );

      return metadata;
    } catch (err: any) {
      logger.error({ error: err.message || err }, '[SongService] Error resolving song metadata');
      return null;
    }
  }

  /**
   * 2. Télécharge le buffer audio directement depuis l'URL Google extraite
   */
  public async downloadSongAudio(metadata: SongMetadata): Promise<SongDownloadResult> {
    try {
      logger.info(
        `[SongService] Downloading "${metadata.title}" — URL: ${metadata.audioUrl.slice(0, 80)}...`
      );

      const buffer = await this.fetchBufferSafe(metadata.audioUrl, metadata.fileExt);
      if (!buffer || buffer.length < 10_000) {
        // Retry with a fresh URL from youtube-dl-exec (URLs can expire quickly)
        logger.warn('[SongService] Buffer too small or empty — retrying with fresh URL...');
        const refreshed = await this.searchSong(metadata.url);
        if (refreshed) {
          const retryBuffer = await this.fetchBufferSafe(refreshed.audioUrl, refreshed.fileExt);
          if (retryBuffer && retryBuffer.length > 10_000) {
            logger.info(
              `[SongService] Retry success: ${(retryBuffer.length / (1024 * 1024)).toFixed(2)} MB`
            );
            return { success: true, metadata: refreshed, audioBuffer: retryBuffer };
          }
        }
        return {
          success: false,
          metadata,
          error: `Échec du téléchargement pour "${metadata.title}". Réessayez dans un instant.`,
        };
      }

      logger.info(
        `[SongService] Download complete: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`
      );
      return { success: true, metadata, audioBuffer: buffer };
    } catch (err: any) {
      logger.error({ error: err.message || err }, '[SongService] Download error');
      return {
        success: false,
        metadata,
        error: `Erreur lors du téléchargement : ${err.message}`,
      };
    }
  }

  /**
   * 3. Méthode tout-en-un : recherche + téléchargement
   */
  public async findAndDownload(query: string): Promise<SongDownloadResult> {
    const metadata = await this.searchSong(query);
    if (!metadata) {
      return {
        success: false,
        error: `Aucune musique trouvée pour "${query}". Essayez avec un titre plus précis.`,
      };
    }
    return this.downloadSongAudio(metadata);
  }

  /**
   * Helper sécurisé pour télécharger le buffer depuis l'URL directe
   */
  private async fetchBufferSafe(url: string, _ext: string): Promise<Buffer | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60_000); // 60s timeout

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': 'https://www.youtube.com/',
          'Accept': '*/*',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        logger.warn(`[SongService] fetchBufferSafe: HTTP ${res.status}`);
        return null;
      }

      const contentLength = Number(res.headers.get('content-length') || 0);
      if (contentLength > MAX_AUDIO_BYTES) {
        logger.warn(`[SongService] File too large: ${contentLength} bytes`);
        return null;
      }

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_AUDIO_BYTES) {
        logger.warn(`[SongService] Buffer too large: ${arrayBuffer.byteLength} bytes`);
        return null;
      }

      return Buffer.from(arrayBuffer);
    } catch (err: any) {
      logger.debug(`[SongService] fetchBufferSafe error: ${err.message}`);
      return null;
    }
  }
}

export default SongService.getInstance();
