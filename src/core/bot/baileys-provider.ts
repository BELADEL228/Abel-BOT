import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  WASocket,
  downloadMediaMessage,
  jidNormalizedUser
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import { IWhatsAppProvider, MessageOptions, SessionStatus } from './types.js';
import { BOT_CONSTANTS } from '../../config/constants.js';
import messageHandler from '../message-handler/message-handler.js';
import autoReplyEngine from '../../services/automation/auto-reply-engine.js';
import logger from '../logger/logger.js';
import { healthMonitor } from '../monitoring/health-check.js';

export class BaileysProvider implements IWhatsAppProvider {
  public sessionId: string;
  public sessionOwnerJid?: string;
  public sessionOwnerName?: string;
  public sessionPhone?: string;
  public status: SessionStatus = 'idle';
  public startedAt: number = 0;
  public lastQrCode?: string;
  public lastPairingCode?: string;

  private socket: WASocket | null = null;
  private authDir: string;
  private isStopping: boolean = false;
  private reconnectAttempts: number = 0;
  private static readonly MAX_RECONNECT_ATTEMPTS: number = 5;

  constructor(sessionId: string = 'main', customAuthDir?: string) {
    this.sessionId = sessionId;
    if (customAuthDir) {
      this.authDir = customAuthDir;
    } else if (sessionId === 'main') {
      this.authDir = path.resolve(process.cwd(), BOT_CONSTANTS.AUTH_FOLDER_NAME);
    } else {
      this.authDir = path.resolve(process.cwd(), 'sessions', sessionId);
    }

    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }

    this.loadSessionMetadata();
  }

  public static readonly botSentMessageIds: Set<string> = new Set();

  public static isBotSentMessage(id?: string | null): boolean {
    if (!id) return false;
    return BaileysProvider.botSentMessageIds.has(id);
  }

  public static trackSentMessage(id?: string | null): void {
    if (!id) return;
    BaileysProvider.botSentMessageIds.add(id);
    if (BaileysProvider.botSentMessageIds.size > 5000) {
      const oldest = BaileysProvider.botSentMessageIds.keys().next().value;
      if (oldest) BaileysProvider.botSentMessageIds.delete(oldest);
    }
  }

  private loadSessionMetadata(): void {
    try {
      const metaPath = path.join(this.authDir, 'session.json');
      if (fs.existsSync(metaPath)) {
        const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (data.phone) this.sessionPhone = data.phone;
        if (data.ownerName) this.sessionOwnerName = data.ownerName;
        if (data.ownerJid) this.sessionOwnerJid = data.ownerJid;
      }
      const credsPath = path.join(this.authDir, 'creds.json');
      if (fs.existsSync(credsPath)) {
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        if (creds.me?.id) {
          const normJid = jidNormalizedUser(creds.me.id);
          this.sessionOwnerJid = normJid;
          this.sessionPhone = normJid.split('@')[0];
          this.sessionOwnerName = creds.me.name || this.sessionPhone;
        }
      }
    } catch {
      // ignore
    }
  }

  public saveSessionMetadata(): void {
    try {
      const metaPath = path.join(this.authDir, 'session.json');
      const data = {
        sessionId: this.sessionId,
        phone: this.sessionPhone,
        ownerName: this.sessionOwnerName,
        ownerJid: this.sessionOwnerJid,
        status: this.status,
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(metaPath, JSON.stringify(data, null, 2), 'utf8');
    } catch {
      // ignore
    }
  }

  public async start(): Promise<void> {
    this.isStopping = false;
    this.status = 'connecting';
    this.startedAt = Date.now();

    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    logger.info(`[BaileysProvider:${this.sessionId}] Starting engine with Baileys v${version.join('.')} (Latest: ${isLatest})`);

    const msgRetryCounterCache = {
      store: new Map<string, number>(),
      get(key: string): number | undefined {
        return this.store.get(key);
      },
      set(key: string, value: number): void {
        this.store.set(key, value);
        if (this.store.size > 2000) {
          const first = this.store.keys().next().value;
          if (first) this.store.delete(first);
        }
      },
      del(key: string): void {
        this.store.delete(key);
      }
    };

    const internalLogger = logger.child({ module: `baileys-${this.sessionId}` });
    internalLogger.level = 'silent';

    this.socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: internalLogger as any,
      msgRetryCounterCache: msgRetryCounterCache as any,
      retryRequestDelayMs: 350,
      maxMsgRetryCount: 5,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      getMessage: async (_key) => undefined
    });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.lastQrCode = qr;
        this.status = 'qr_ready';
        logger.info(`[BaileysProvider:${this.sessionId}] QR Code generated. Scan with WhatsApp:`);
        if (this.sessionId === 'main') {
          qrcode.generate(qr, { small: true });
        }
      }

      if (connection === 'close') {
        this.status = 'disconnected';
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const shouldReconnect = !this.isStopping && !isLoggedOut;

        this.saveSessionMetadata();

        logger.warn(
          { statusCode, shouldReconnect, attempt: this.reconnectAttempts },
          `[BaileysProvider:${this.sessionId}] Connection closed.`
        );

        if (isLoggedOut) {
          logger.error(`[BaileysProvider:${this.sessionId}] Logged out (401). Session ended.`);
          healthMonitor.recordError();
        } else if (shouldReconnect) {
          if (this.reconnectAttempts < BaileysProvider.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            healthMonitor.recordReconnectAttempt(this.reconnectAttempts);
            const delayMs = 3000 * this.reconnectAttempts; // Exponential / progressive backoff
            logger.info(
              `[RECONNECT] [BaileysProvider:${this.sessionId}] Tentative ${this.reconnectAttempts}/${BaileysProvider.MAX_RECONNECT_ATTEMPTS} dans ${delayMs / 1000}s...`
            );
            setTimeout(() => this.start(), delayMs);
          } else {
            logger.error(
              `[FATAL] [BaileysProvider:${this.sessionId}] Cannot reconnect after ${BaileysProvider.MAX_RECONNECT_ATTEMPTS} attempts.`
            );
            healthMonitor.recordError();
          }
        }
      } else if (connection === 'open') {
        this.status = 'connected';
        this.reconnectAttempts = 0; // Reset counter on successful connection
        healthMonitor.recordReconnectAttempt(0);

        const user = this.socket?.user;
        if (user) {
          this.sessionOwnerJid = jidNormalizedUser(user.id);
          this.sessionPhone = this.sessionOwnerJid.split('@')[0];
          this.sessionOwnerName = user.name || this.sessionPhone;
        }
        this.saveSessionMetadata();
        logger.info(`[BaileysProvider:${this.sessionId}] Connected successfully! Account: ${this.sessionOwnerName || this.sessionPhone || 'Online'}`);
      }
    });

    this.socket.ev.on('messages.upsert', async (event) => {
      if (event.type !== 'notify') return;

      for (const msg of event.messages) {
        try {
          await messageHandler.handleIncomingMessage(msg, this);
        } catch (err) {
          logger.error({ error: err }, `[BaileysProvider:${this.sessionId}] Error handling incoming message`);
        }
      }
    });
  }

  public async requestPairingCode(phoneNumber: string): Promise<string> {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    this.sessionPhone = cleanPhone;
    this.saveSessionMetadata();

    if (!this.socket) {
      await this.start();
    }

    if (!this.socket) throw new Error('Failed to initialize WhatsApp socket');

    // Wait until socket method is available
    let retries = 0;
    while (!this.socket.requestPairingCode && retries < 15) {
      await new Promise(r => setTimeout(r, 400));
      retries++;
    }

    if (this.socket.authState.creds.registered) {
      throw new Error(`Cette session (${this.sessionId}) est déjà enregistrée. Supprimez-la d'abord avec .delsession si vous souhaitez la reconnecter.`);
    }

    // Small delay to ensure Baileys auth state is initialized
    await new Promise(r => setTimeout(r, 1200));

    const rawCode = await this.socket.requestPairingCode(cleanPhone);
    const code = rawCode ? (rawCode.length === 8 ? `${rawCode.slice(0, 4)}-${rawCode.slice(4)}` : rawCode) : '';

    this.lastPairingCode = code;
    this.status = 'pairing_code_ready';
    this.saveSessionMetadata();
    logger.info(`[BaileysProvider:${this.sessionId}] Pairing Code generated: ${code} for phone: ${cleanPhone}`);
    return code;
  }

  public async stop(): Promise<void> {
    this.isStopping = true;
    this.status = 'disconnected';
    this.saveSessionMetadata();
    if (this.socket) {
      try {
        this.socket.ev.removeAllListeners('connection.update');
        this.socket.ev.removeAllListeners('messages.upsert');
        this.socket.ev.removeAllListeners('creds.update');
        this.socket.end(undefined);
      } catch (err) {
        // ignore
      }
      this.socket = null;
    }
    logger.info(`[BaileysProvider:${this.sessionId}] Session stopped.`);
  }

  public async sendMessage(chatJid: string, text: string, options?: MessageOptions): Promise<any> {
    if (!this.socket) throw new Error(`[BaileysProvider:${this.sessionId}] Socket not initialized`);
    const sendOptions: any = {};
    if (options?.quoted) {
      sendOptions.quoted = typeof options.quoted === 'boolean' ? undefined : options.quoted;
    }
    if (options?.mentions) {
      sendOptions.mentions = options.mentions;
    }
    const result = await this.socket.sendMessage(chatJid, { text }, sendOptions);
    if (result?.key?.id) {
      BaileysProvider.trackSentMessage(result.key.id);
    }
    return result;
  }

  public async sendMedia(
    chatJid: string,
    type: 'image' | 'video' | 'audio' | 'document' | 'sticker',
    mediaBuffer: Buffer,
    caption?: string,
    options?: MessageOptions
  ): Promise<any> {
    if (!this.socket) throw new Error(`[BaileysProvider:${this.sessionId}] Socket not initialized`);

    const content: any = {};
    if (type === 'image') content.image = mediaBuffer;
    else if (type === 'video') {
      content.video = mediaBuffer;
      if (options?.gifPlayback) content.gifPlayback = true;
    }
    else if (type === 'audio') {
      content.audio = mediaBuffer;
      content.mimetype = options?.mimetype || 'audio/mp4';
    }
    else if (type === 'document') {
      content.document = mediaBuffer;
      if (options?.mimetype) content.mimetype = options.mimetype;
      if (options?.fileName) content.fileName = options.fileName;
    }
    else if (type === 'sticker') content.sticker = mediaBuffer;

    if (caption) content.caption = caption;

    const sendOptions: any = {};
    if (options?.quoted) {
      sendOptions.quoted = typeof options.quoted === 'boolean' ? undefined : options.quoted;
    }
    if (options?.mentions) {
      sendOptions.mentions = options.mentions;
    }

    const result = await this.socket.sendMessage(chatJid, content, sendOptions);
    if (result?.key?.id) {
      BaileysProvider.trackSentMessage(result.key.id);
    }
    return result;
  }

  public async sendPresence(chatJid: string, presence: 'composing' | 'recording' | 'available' | 'unavailable'): Promise<void> {
    if (!this.socket) return;
    try {
      await this.socket.sendPresenceUpdate(presence, chatJid);
    } catch {
      // ignore
    }
  }

  public async downloadMedia(message: any): Promise<Buffer | null> {
    if (!message) return null;
    try {
      const buffer = await downloadMediaMessage(
        message,
        'buffer',
        {},
        {
          logger: logger as any,
          reuploadRequest: async (msg) => {
            if (!this.socket) throw new Error('Socket not ready');
            return await this.socket.updateMediaMessage(msg);
          }
        }
      );
      return buffer as Buffer;
    } catch (err: any) {
      logger.error({ error: err.message || err }, `[BaileysProvider:${this.sessionId}] Error downloading media`);
      return null;
    }
  }

  public async kickMember(groupJid: string, userJid: string): Promise<void> {
    if (!this.socket) return;
    await this.socket.groupParticipantsUpdate(groupJid, [userJid], 'remove');
  }

  public async promoteMember(groupJid: string, userJid: string): Promise<void> {
    if (!this.socket) return;
    await this.socket.groupParticipantsUpdate(groupJid, [userJid], 'promote');
  }

  public async demoteMember(groupJid: string, userJid: string): Promise<void> {
    if (!this.socket) return;
    await this.socket.groupParticipantsUpdate(groupJid, [userJid], 'demote');
  }

  public async deleteMessage(chatJid: string, messageId: string, fromMe: boolean = true, participantJid?: string): Promise<void> {
    if (!this.socket) return;
    try {
      const deleteKey: any = {
        remoteJid: chatJid,
        fromMe,
        id: messageId
      };
      if (participantJid && (chatJid.endsWith('@g.us') || participantJid.includes('@'))) {
        deleteKey.participant = participantJid;
      }
      await this.socket.sendMessage(chatJid, { delete: deleteKey });
    } catch (err: any) {
      logger.warn({ error: err.message || err }, `[BaileysProvider:${this.sessionId}] Failed to delete message ${messageId}`);
    }
  }
}

export default BaileysProvider;
