/**
 * VideoService — Recherche et téléchargement de vidéos universel (YouTube, etc.)
 *
 * Fonctionnalités :
 * - Recherche par titre / mots-clés / description ou lien direct (comme .song)
 * - Extraction des métadonnées (titre, chaîne, durée, miniature)
 * - Téléchargement direct MP4 fluide et léger (360p/720p < 45 Mo) optimisé pour WhatsApp
 * - 100% vidéo + audio synchronisés (codec H.264 / AAC)
 */

import { youtubeDl } from 'youtube-dl-exec';
import { readFileSync, unlinkSync, existsSync, readdirSync } from 'fs';
import os from 'os';
import path from 'path';
import logger from '../../core/logger/logger.js';

export interface VideoMetadata {
  videoId: string;
  url: string;
  title: string;
  author: string;
  duration: string;
  durationSec: number;
  thumbnail: string;
  description?: string;
}

export interface VideoDownloadResult {
  success: boolean;
  metadata?: VideoMetadata;
  videoBuffer?: Buffer;
  error?: string;
}

const MAX_VIDEO_DURATION_SEC = 600; // 10 minutes max pour WhatsApp

export class VideoService {
  private static instance: VideoService;

  private constructor() {}

  public static getInstance(): VideoService {
    if (!VideoService.instance) {
      VideoService.instance = new VideoService();
    }
    return VideoService.instance;
  }

  /**
   * 1. Recherche une vidéo par mots-clés ou URL et extrait les métadonnées
   */
  public async searchVideo(query: string): Promise<VideoMetadata | null> {
    try {
      logger.info(`[VideoService] Searching video for query: "${query}"`);

      // Détecter si c'est déjà une URL YouTube directe
      const ytUrlMatch = query.match(
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
      );

      const target = ytUrlMatch
        ? `https://www.youtube.com/watch?v=${ytUrlMatch[1]}`
        : `ytsearch1:${query}`;

      const info = (await youtubeDl(target, {
        dumpSingleJson: true,
        noWarnings: true,
        preferFreeFormats: true,
        extractorArgs: 'youtube:player_client=android,web',
      } as any)) as any;

      const item = (info?.entries && Array.isArray(info.entries) && info.entries.length > 0)
        ? info.entries[0]
        : info;

      if (!item || !item.id) {
        logger.warn('[VideoService] No video found for query');
        return null;
      }

      const durationSec = item.duration || 0;
      if (durationSec > MAX_VIDEO_DURATION_SEC) {
        logger.warn(`[VideoService] Video too long: ${durationSec}s > ${MAX_VIDEO_DURATION_SEC}s`);
        return null;
      }

      const minutes = Math.floor(durationSec / 60);
      const seconds = String(durationSec % 60).padStart(2, '0');

      const metadata: VideoMetadata = {
        videoId: item.id,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        title: item.title || item.fulltitle || 'Vidéo',
        author: item.uploader || item.channel || 'Créateur',
        duration: `${minutes}:${seconds}`,
        durationSec,
        thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        description: item.description ? item.description.slice(0, 150) + '...' : undefined,
      };

      logger.info(`[VideoService] Found video: "${metadata.title}" by ${metadata.author} (${metadata.duration})`);
      return metadata;
    } catch (err: any) {
      logger.error({ error: err.message || err }, '[VideoService] Error searching video');
      return null;
    }
  }

  /**
   * 2. Télécharge la vidéo au format MP4 progressif pour WhatsApp
   */
  public async downloadVideo(metadata: VideoMetadata): Promise<VideoDownloadResult> {
    const tempPrefix = `abel_vid_${Date.now()}_${metadata.videoId}`;
    const tempTemplate = path.join(os.tmpdir(), `${tempPrefix}.%(ext)s`);

    logger.info(`[VideoService] Downloading video "${metadata.title}" (${metadata.url})...`);

    try {
      await youtubeDl(metadata.url, {
        output: tempTemplate,
        format: '18/22/b[ext=mp4]/best[ext=mp4]/best',
        extractorArgs: 'youtube:player_client=android,web',
        noWarnings: true,
      } as any);

      const tmpDir = os.tmpdir();
      const files = readdirSync(tmpDir).filter(f => f.startsWith(tempPrefix));

      if (files.length === 0) {
        return {
          success: false,
          metadata,
          error: `Échec du téléchargement de la vidéo pour "${metadata.title}".`,
        };
      }

      const downloadedFile = path.join(tmpDir, files[0]);
      const buffer = readFileSync(downloadedFile);

      // Nettoyage immédiat du fichier temporaire
      try {
        if (existsSync(downloadedFile)) unlinkSync(downloadedFile);
      } catch {
        // Ignorer
      }

      logger.info(`[VideoService] Video downloaded successfully: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`);

      return {
        success: true,
        metadata,
        videoBuffer: buffer,
      };
    } catch (err: any) {
      logger.error({ error: err.message || err }, '[VideoService] Error downloading video');
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
  public async findAndDownloadVideo(query: string): Promise<VideoDownloadResult> {
    const metadata = await this.searchVideo(query);
    if (!metadata) {
      return {
        success: false,
        error: `Aucune vidéo trouvée pour "${query}". Essayez avec un titre plus précis.`,
      };
    }
    return this.downloadVideo(metadata);
  }
}

export default VideoService.getInstance();
