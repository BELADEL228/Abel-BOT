/**
 * Signal Session Healer — Auto-réparation des clés E2EE WhatsApp (Bad MAC / Session Desync)
 * Supprime automatiquement les fichiers de sessions ou sender-keys corrompus pour forcer
 * WhatsApp et Baileys à régénérer un échange de clés propre (PreKey bundle).
 */

import fs from 'fs';
import path from 'path';
import logger from '../logger/logger.js';

export class SignalSessionHealer {
  private static readonly cleanedPeers: Map<string, number> = new Map();
  private static readonly COOLDOWN_MS = 30_000; // 30s cooldown per peer to avoid excessive FS writes

  /**
   * Nettoie les fichiers de session et sender-key corrompus pour un peer donné
   */
  public static repairPeerSession(authDir: string, peerOrSessionId: string): boolean {
    if (!authDir || !fs.existsSync(authDir) || !peerOrSessionId) return false;

    // Clean peer identifier (e.g., "91706645020777.0" -> "91706645020777")
    const cleanId = peerOrSessionId.split('.')[0].replace(/\D/g, '');
    if (!cleanId || cleanId.length < 5) return false;

    const lastCleaned = this.cleanedPeers.get(cleanId) || 0;
    if (Date.now() - lastCleaned < this.COOLDOWN_MS) {
      return false;
    }
    this.cleanedPeers.set(cleanId, Date.now());

    let deletedCount = 0;
    try {
      const files = fs.readdirSync(authDir);
      for (const file of files) {
        if (
          (file.startsWith(`session-${cleanId}`) || file.includes(`--${cleanId}--`)) &&
          file.endsWith('.json')
        ) {
          const filePath = path.join(authDir, file);
          try {
            fs.unlinkSync(filePath);
            deletedCount++;
          } catch {
            // ignore
          }
        }
      }

      if (deletedCount > 0) {
        logger.info(
          `[SignalSessionHealer] Auto-healed ${deletedCount} corrupted Signal session file(s) for peer: ${cleanId}`
        );
        return true;
      }
    } catch (err: any) {
      logger.warn({ error: err.message }, `[SignalSessionHealer] Error repairing session for ${cleanId}`);
    }

    return false;
  }

  /**
   * Analyse une erreur pour détecter et réparer les erreurs "Bad MAC"
   */
  public static handlePotentialMacError(authDir: string, error: any): void {
    if (!error) return;
    const errorStr = typeof error === 'string' ? error : (error.stack || error.message || '');
    if (/Bad MAC/i.test(errorStr) || /Failed to decrypt/i.test(errorStr)) {
      // Extract peer IDs (e.g., 91706645020777.0 or [as awaitable] (91706645020777))
      const match = errorStr.match(/(\d{8,16})/);
      if (match && match[1]) {
        this.repairPeerSession(authDir, match[1]);
      }
    }
  }
}

export default SignalSessionHealer;
