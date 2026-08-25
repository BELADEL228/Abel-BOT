import path from 'path';
import fs from 'fs';
import { BaileysProvider } from './baileys-provider.js';
import { IWhatsAppProvider } from './types.js';
import logger from '../logger/logger.js';
import { BOT_CONSTANTS } from '../../config/constants.js';

export interface SessionInfo {
  id: string;
  phone?: string;
  ownerName?: string;
  status: string;
  uptimeSeconds: number;
  isMain: boolean;
  lastPairingCode?: string;
}

export class SessionManager {
  private static instance: SessionManager;
  private sessions: Map<string, BaileysProvider> = new Map();
  private sessionsBaseDir: string;

  private constructor() {
    this.sessionsBaseDir = path.resolve(process.cwd(), 'sessions');
    if (!fs.existsSync(this.sessionsBaseDir)) {
      fs.mkdirSync(this.sessionsBaseDir, { recursive: true });
    }
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Bootstraps the session manager:
   * 1. Starts the primary 'main' session (auth_info_baileys)
   * 2. Scans the 'sessions/' directory and restores any previously authenticated sessions
   */
  public async bootstrap(): Promise<void> {
    logger.info('[SessionManager] Initializing Multi-Session Manager...');

    // 1. Start primary main session (Abel)
    const mainProvider = new BaileysProvider('main');
    this.sessions.set('main', mainProvider);
    await mainProvider.start();

    // 2. Discover and start existing user sessions in sessions/
    if (fs.existsSync(this.sessionsBaseDir)) {
      const entries = fs.readdirSync(this.sessionsBaseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'main') {
          const sessionId = entry.name;
          const sessionPath = path.join(this.sessionsBaseDir, sessionId);
          const credsPath = path.join(sessionPath, 'creds.json');

          // Only auto-start if creds.json exists (session is already authenticated)
          if (fs.existsSync(credsPath)) {
            logger.info(`[SessionManager] Restoring existing authenticated session: ${sessionId}`);
            const provider = new BaileysProvider(sessionId, sessionPath);
            this.sessions.set(sessionId, provider);
            provider.start().catch((err) => {
              logger.error({ error: err }, `[SessionManager] Failed to restore session ${sessionId}`);
            });
          }
        }
      }
    }

    logger.info(`[SessionManager] Multi-Session Manager ready with ${this.sessions.size} session(s).`);
  }

  /**
   * Creates or retrieves a session and initiates pairing code generation
   */
  public async createWithPairingCode(sessionId: string, phoneNumber: string): Promise<{ code: string; provider: IWhatsAppProvider }> {
    const cleanId = sessionId.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    if (!cleanId) throw new Error('Identifiant de session invalide');
    if (!cleanPhone || cleanPhone.length < 8) throw new Error('Numéro de téléphone invalide (format international requis, ex: 22890000000)');

    let provider = this.sessions.get(cleanId);
    if (provider) {
      if (provider.status === 'connected') {
        throw new Error(`La session "${cleanId}" est déjà connectée au numéro +${provider.sessionPhone || 'inconnu'}.`);
      }
      await provider.stop();
    }

    const sessionDir = path.resolve(this.sessionsBaseDir, cleanId);
    provider = new BaileysProvider(cleanId, sessionDir);
    this.sessions.set(cleanId, provider);

    const code = await provider.requestPairingCode(cleanPhone);
    return { code, provider };
  }

  /**
   * Creates or retrieves a session and starts QR code pairing
   */
  public async createWithQr(sessionId: string): Promise<IWhatsAppProvider> {
    const cleanId = sessionId.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanId) throw new Error('Identifiant de session invalide');

    let provider = this.sessions.get(cleanId);
    if (provider) {
      if (provider.status === 'connected') {
        throw new Error(`La session "${cleanId}" est déjà connectée.`);
      }
      await provider.stop();
    }

    const sessionDir = path.resolve(this.sessionsBaseDir, cleanId);
    provider = new BaileysProvider(cleanId, sessionDir);
    this.sessions.set(cleanId, provider);

    await provider.start();
    return provider;
  }

  public getSession(sessionId: string): BaileysProvider | undefined {
    return this.sessions.get(sessionId.toLowerCase());
  }

  public getMainSession(): BaileysProvider | undefined {
    return this.sessions.get('main');
  }

  public getAllSessions(): BaileysProvider[] {
    return Array.from(this.sessions.values());
  }

  public listSessionsInfo(): SessionInfo[] {
    return Array.from(this.sessions.values()).map(s => {
      const now = Date.now();
      const uptime = s.startedAt > 0 && s.status === 'connected' ? Math.floor((now - s.startedAt) / 1000) : 0;
      return {
        id: s.sessionId,
        phone: s.sessionPhone,
        ownerName: s.sessionOwnerName,
        status: s.status,
        uptimeSeconds: uptime,
        isMain: s.sessionId === 'main',
        lastPairingCode: s.lastPairingCode
      };
    });
  }

  public async stopSession(sessionId: string): Promise<boolean> {
    const provider = this.sessions.get(sessionId.toLowerCase());
    if (!provider) return false;
    await provider.stop();
    return true;
  }

  public async deleteSession(sessionId: string): Promise<boolean> {
    const cleanId = sessionId.toLowerCase();
    if (cleanId === 'main') {
      throw new Error('Impossible de supprimer la session principale.');
    }

    const provider = this.sessions.get(cleanId);
    if (provider) {
      await provider.stop();
      this.sessions.delete(cleanId);
    }

    const sessionDir = path.resolve(this.sessionsBaseDir, cleanId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    return true;
  }
}

export default SessionManager.getInstance();
