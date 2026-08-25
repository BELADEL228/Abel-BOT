/**
 * AutoReplyQueue — File d'attente async avec jitter humain et double-check pré-envoi.
 *
 * - Limite globale : maxPerHour messages/heure
 * - Délai humain : minDelaySeconds à maxDelaySeconds avant chaque envoi
 * - Double-check : juste avant l'envoi, vérifie que les conditions sont toujours remplies
 * - Annulation : l'owner peut répondre/lire pendant l'attente → job annulé
 */

import logger from '../../core/logger/logger.js';
import { IWhatsAppProvider } from '../../core/bot/types.js';

export interface QueueJob {
  id: string;
  chatJid: string;
  senderJid: string;
  senderName: string;
  message: string;
  templateName: string;
  delayMs: number;
  scheduledAt: number;
  provider: IWhatsAppProvider;
  canceled: boolean;
  timer: NodeJS.Timeout;
  onPreSendCheck: () => boolean;  // Returns false → cancel
  onSent: () => void;
  onCanceled: () => void;
}

export class AutoReplyQueue {
  private static instance: AutoReplyQueue;
  private jobs: Map<string, QueueJob> = new Map();

  private constructor() {}

  public static getInstance(): AutoReplyQueue {
    if (!AutoReplyQueue.instance) {
      AutoReplyQueue.instance = new AutoReplyQueue();
    }
    return AutoReplyQueue.instance;
  }

  /**
   * Enqueue a new auto-reply to be sent after `delayMs`.
   * Cancels any existing queued reply for the same chatJid (debounce).
   */
  public enqueue(params: Omit<QueueJob, 'id' | 'canceled' | 'timer'>): string {
    const id = `${params.chatJid}_${Date.now()}`;

    // Cancel existing job for this chat (prevent duplicate pending replies)
    this.cancelByChatJid(params.chatJid);

    const timer = setTimeout(async () => {
      const job = this.jobs.get(id);
      if (!job || job.canceled) {
        this.jobs.delete(id);
        return;
      }

      // ── DOUBLE-CHECK PRE-SEND ──────────────────────────────────────────────────
      // This is the critical safety check: owner may have replied or read the message
      // between the time we scheduled the job and now.
      if (!job.onPreSendCheck()) {
        job.canceled = true;
        job.onCanceled();
        this.jobs.delete(id);
        logger.info(`[AutoReplyQueue] Job ${id} canceled by pre-send check (owner replied/read)`);
        return;
      }

      // ── SIMULATE HUMAN TYPING ──────────────────────────────────────────────────
      try {
        await job.provider.sendPresence(job.chatJid, 'composing');
      } catch {
        // Non-critical — ignore presence errors
      }

      // Short composing delay (1-3s additional after main delay)
      const composingMs = Math.floor(Math.random() * 2000) + 1000;
      await new Promise(r => setTimeout(r, composingMs));

      // Final pre-send check after composing wait
      if (!job.onPreSendCheck()) {
        job.canceled = true;
        job.onCanceled();
        this.jobs.delete(id);
        logger.info(`[AutoReplyQueue] Job ${id} canceled after composing wait`);
        return;
      }

      // ── SEND ──────────────────────────────────────────────────────────────────
      try {
        await job.provider.sendMessage(job.chatJid, job.message);
        job.onSent();
        logger.info(`[AutoReplyQueue] Sent auto-reply to ${job.chatJid} (template: ${job.templateName})`);
      } catch (err) {
        logger.error({ error: err }, `[AutoReplyQueue] Failed to send auto-reply to ${job.chatJid}`);
      } finally {
        this.jobs.delete(id);
      }
    }, params.delayMs);

    const job: QueueJob = {
      ...params,
      id,
      canceled: false,
      timer
    };

    this.jobs.set(id, job);
    logger.debug(`[AutoReplyQueue] Enqueued job ${id} for ${params.chatJid} (delay: ${params.delayMs}ms)`);
    return id;
  }

  /**
   * Cancel a specific job by ID.
   */
  public cancel(id: string): void {
    const job = this.jobs.get(id);
    if (job) {
      clearTimeout(job.timer);
      job.canceled = true;
      this.jobs.delete(id);
    }
  }

  /**
   * Cancel all pending jobs for a specific chatJid.
   */
  public cancelByChatJid(chatJid: string): void {
    for (const [id, job] of this.jobs) {
      if (job.chatJid === chatJid) {
        clearTimeout(job.timer);
        job.canceled = true;
        job.onCanceled();
        this.jobs.delete(id);
      }
    }
  }

  public getPendingCount(): number {
    return this.jobs.size;
  }

  public hasPendingFor(chatJid: string): boolean {
    for (const job of this.jobs.values()) {
      if (job.chatJid === chatJid) return true;
    }
    return false;
  }
}

export default AutoReplyQueue.getInstance();
