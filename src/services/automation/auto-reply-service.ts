import { IWhatsAppProvider } from '../../core/bot/types.js';
import { config } from '../../config/env.js';
import logger from '../../core/logger/logger.js';

interface PendingChatTracker {
  contactJid: string;
  senderName: string;
  lastMessageText: string;
  receivedAt: number;
  autoReplyTimer?: NodeJS.Timeout;
  ownerNotifyTimer?: NodeJS.Timeout;
  autoReplySent: boolean;
  ownerNotified: boolean;
}

export class AutoReplyService {
  private static instance: AutoReplyService;

  private isAutoReplyEnabled: boolean = true;
  // ⚠️ TEST MODE: 1 min for auto-reply, 2 min for owner alert
  // Production values: autoReplyDelayMinutes = 15, ownerNotifyDelayHours = 1
  private autoReplyDelayMinutes: number = 1;
  private ownerNotifyDelayMinutes: number = 2; // stored in minutes for fine-grained control
  private customAutoReplyText: string =
    "🤖 *Message Automatique :* Bonjour ! Je suis actuellement occupé. Je prends connaissance de votre message et je vous reviens dans quelques minutes.";

  private pendingChats: Map<string, PendingChatTracker> = new Map();

  private constructor() {}

  public static getInstance(): AutoReplyService {
    if (!AutoReplyService.instance) {
      AutoReplyService.instance = new AutoReplyService();
    }
    return AutoReplyService.instance;
  }

  // Configurations
  public setEnabled(enabled: boolean): void {
    this.isAutoReplyEnabled = enabled;
  }

  public isEnabled(): boolean {
    return this.isAutoReplyEnabled;
  }

  public setCustomMessage(text: string): void {
    this.customAutoReplyText = text;
  }

  public getCustomMessage(): string {
    return this.customAutoReplyText;
  }

  public setDelays(replyDelayMins: number, notifyDelayMins: number): void {
    this.autoReplyDelayMinutes = replyDelayMins;
    this.ownerNotifyDelayMinutes = notifyDelayMins;
  }

  public getDelays(): { replyMins: number; notifyMins: number } {
    return {
      replyMins: this.autoReplyDelayMinutes,
      notifyMins: this.ownerNotifyDelayMinutes
    };
  }

  /** Returns a human-readable status of all pending auto-reply timers */
  public getStatusReport(): string {
    if (this.pendingChats.size === 0) {
      return '📭 *Aucun timer actif.* Aucun message non répondu en attente.';
    }
    const now = Date.now();
    let report = `⏳ *TIMERS AUTO-REPLY ACTIFS (${this.pendingChats.size}) :*\n\n`;
    for (const t of this.pendingChats.values()) {
      const waitedMs = now - t.receivedAt;
      const waitedMin = Math.floor(waitedMs / 60000);
      const waitedSec = Math.floor((waitedMs % 60000) / 1000);
      const replyIn = Math.max(0, this.autoReplyDelayMinutes * 60 - waitedMs / 1000);
      const notifyIn = Math.max(0, this.ownerNotifyDelayMinutes * 60 - waitedMs / 1000);
      report += `👤 *${t.senderName}* (@${t.contactJid.split('@')[0]})\n`;
      report += `   ⏱️ Reçu il y a : ${waitedMin}m ${waitedSec}s\n`;
      report += `   📤 Auto-reply dans : ${t.autoReplySent ? '✅ Envoyé' : `${Math.ceil(replyIn)}s`}\n`;
      report += `   🚨 Alerte owner dans : ${t.ownerNotified ? '✅ Notifié' : `${Math.ceil(notifyIn)}s`}\n\n`;
    }
    return report.trim();
  }

  /**
   * Called when a contact sends a message to the bot/user
   */
  public registerIncomingMessage(
    contactJid: string,
    senderName: string,
    text: string,
    provider: IWhatsAppProvider
  ): void {
    // If message comes from group or status, skip individual auto-reply
    if (contactJid.endsWith('@g.us') || contactJid === 'status@broadcast') {
      return;
    }

    // Reset any existing timers for this contact
    this.clearPendingTrackers(contactJid);

    const tracker: PendingChatTracker = {
      contactJid,
      senderName: senderName || contactJid.split('@')[0],
      lastMessageText: text,
      receivedAt: Date.now(),
      autoReplySent: false,
      ownerNotified: false
    };

    // 1. Timer 1: Auto-reply to contact after X minutes (e.g. 15 or 30 mins)
    if (this.isAutoReplyEnabled) {
      const replyDelayMs = this.autoReplyDelayMinutes * 60 * 1000;
      tracker.autoReplyTimer = setTimeout(async () => {
        try {
          logger.info(`[AutoReplyService] Sending auto-reply to ${contactJid} after ${this.autoReplyDelayMinutes}m idle`);
          await provider.sendMessage(contactJid, this.customAutoReplyText);
          tracker.autoReplySent = true;
        } catch (err) {
          logger.error({ error: err }, '[AutoReplyService] Failed to send auto-reply message');
        }
      }, replyDelayMs);
    }

    // 2. Timer 2: Owner Notification after Y minutes
    const notifyDelayMs = this.ownerNotifyDelayMinutes * 60 * 1000;
    tracker.ownerNotifyTimer = setTimeout(async () => {
      try {
        const ownerJid = config.botOwner ? `${config.botOwner.replace(/\D/g, '')}@s.whatsapp.net` : contactJid;
        const alertMessage =
          `🚨 *RAPPEL MESSAGE NON LU — ASSISTANT PERSONNEL*\n\n` +
          `👤 *Contact :* ${tracker.senderName} (@${contactJid.split('@')[0]})\n` +
          `⏱️ *En attente depuis :* ${this.ownerNotifyDelayMinutes} minute(s)\n` +
          `💬 *Dernier message :* "${tracker.lastMessageText.slice(0, 100)}"\n\n` +
          `💡 N'oubliez pas de lui répondre !`;

        logger.info(`[AutoReplyService] Sending owner alert for contact ${contactJid} after ${this.ownerNotifyDelayMinutes}m`);
        await provider.sendMessage(ownerJid, alertMessage, { mentions: [contactJid] });
        tracker.ownerNotified = true;
      } catch (err) {
        logger.error({ error: err }, '[AutoReplyService] Failed to send owner notification alert');
      }
    }, notifyDelayMs);

    this.pendingChats.set(contactJid, tracker);
  }

  /**
   * Called when the owner sends a message or replies to a contact
   */
  public registerOwnerReply(contactJid: string): void {
    if (this.pendingChats.has(contactJid)) {
      logger.info(`[AutoReplyService] Owner replied to ${contactJid}. Clearing timers.`);
      this.clearPendingTrackers(contactJid);
    }
  }

  private clearPendingTrackers(contactJid: string): void {
    const existing = this.pendingChats.get(contactJid);
    if (existing) {
      if (existing.autoReplyTimer) clearTimeout(existing.autoReplyTimer);
      if (existing.ownerNotifyTimer) clearTimeout(existing.ownerNotifyTimer);
      this.pendingChats.delete(contactJid);
    }
  }

  public getPendingChats(): PendingChatTracker[] {
    return Array.from(this.pendingChats.values());
  }
}

export default AutoReplyService.getInstance();
