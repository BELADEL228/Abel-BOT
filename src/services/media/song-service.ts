/**
 * SongService — Recherche et téléchargement de musiques via yt-dlp natif.
 *
 * Architecture :
 * 1. Recherche et extraction des métadonnées via ytsearch1 (titre, artiste, durée, miniature).
 * 2. Téléchargement direct ultra-rapide (~3-5 secondes) via yt-dlp vers un fichier temporaire.
 * 3. Lecture du buffer, suppression propre du fichier temporaire et envoi sur WhatsApp.
 */

import { youtubeDl } from 'youtube-dl-exec';
import { readFileSync, unlinkSync, existsSync, readdirSync } from 'fs';
import os from 'os';
import path from 'path';
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
}

export interface SongDownloadResult {
  success: boolean;
  metadata?: SongMetadata;
  audioBuffer?: Buffer;
  error?: string;
}

const MAX_DURATION_SEC = 600; // 10 minutes max

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
   * 1. Recherche une chanson et extrait ses métadonnées
   */
  public async searchSong(query: string): Promise<SongMetadata | null> {
    try {
      logger.info(`[SongService] Searching music metadata for: "${query}"`);

      // Détecter si c'est déjà une URL YouTube directe
      const ytUrlMatch = query.match(
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
      );

      const target = ytUrlMatch
        ? `https://www.youtube.com/watch?v=${ytUrlMatch[1]}`
        : `ytsearch1:${query} audio`;

      const info = (await youtubeDl(target, {
        dumpSingleJson: true,
        noWarnings: true,
        preferFreeFormats: true,
        format: 'bestaudio/best',
      })) as any;

      // Déballer les résultats si c'est une recherche (playlist ytsearch1)
      const item = info?.entries && Array.isArray(info.entries) && info.entries.length > 0
        ? info.entries[0]
        : info;

      if (!item || !item.id) {
        logger.warn('[SongService] No matching track found');
        return null;
      }

      const durationSec = item.duration || 0;
      if (durationSec > MAX_DURATION_SEC) {
        logger.warn(`[SongService] Track too long: ${durationSec}s > ${MAX_DURATION_SEC}s`);
        return null;
      }

      const minutes = Math.floor(durationSec / 60);
      const seconds = String(durationSec % 60).padStart(2, '0');

      const metadata: SongMetadata = {
        videoId: item.id,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        title: item.title || item.fulltitle || 'Musique',
        artist: item.uploader || item.channel || item.artist || 'Artiste',
        duration: `${minutes}:${seconds}`,
        durationSec,
        thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        fileExt: item.ext || 'm4a',
      };

      logger.info(`[SongService] Found: "${metadata.title}" by ${metadata.artist} (${metadata.duration})`);
      return metadata;
    } catch (err: any) {
      logger.error({ error: err.message || err }, '[SongService] Error resolving track metadata');
      return null;
    }
  }

  /**
   * 2. Téléchargement direct du flux audio via yt-dlp
   */
  public async downloadSongAudio(metadata: SongMetadata): Promise<SongDownloadResult> {
    const tempPrefix = `abel_song_${Date.now()}_${metadata.videoId}`;
    const tempTemplate = path.join(os.tmpdir(), `${tempPrefix}.%(ext)s`);

    logger.info(`[SongService] Downloading audio for "${metadata.title}" via yt-dlp...`);

    try {
      await youtubeDl(metadata.url, {
        output: tempTemplate,
        format: 'bestaudio/best',
        noWarnings: true,
      });

      // Trouver le fichier temporaire généré
      const tmpDir = os.tmpdir();
      const files = readdirSync(tmpDir).filter(f => f.startsWith(tempPrefix));

      if (files.length === 0) {
        return {
          success: false,
          metadata,
          error: `Échec du téléchargement du fichier audio pour "${metadata.title}".`,
        };
      }

      const downloadedFile = path.join(tmpDir, files[0]);
      const ext = path.extname(downloadedFile).replace('.', '') || metadata.fileExt;
      metadata.fileExt = ext;

      const buffer = readFileSync(downloadedFile);

      // Nettoyer immédiatement le fichier temporaire
      try {
        if (existsSync(downloadedFile)) {
          unlinkSync(downloadedFile);
        }
      } catch {
        // Ignorer l'erreur de suppression du fichier temp
      }

      logger.info(`[SongService] Audio downloaded successfully: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB [${ext}]`);

      return {
        success: true,
        metadata,
        audioBuffer: buffer,
      };
    } catch (err: any) {
      logger.error({ error: err.message || err }, '[SongService] Error during direct audio download');
      return {
        success: false,
        metadata,
        error: `Erreur lors du téléchargement : ${err.message}`,
      };
    }
  }

  /**
   * 3. Méthode tout-en-un : Recherche + Téléchargement
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
}

export default SongService.getInstance();
