/**
 * MessageDebouncer — Regroupe les rafales de messages en un seul événement.
 *
 * Si un contact envoie "Salut", "Tu es là ?" et "J'ai besoin de toi" en 6 secondes,
 * le debouncer attend DEBOUNCE_MS avant de déclencher le callback avec les 3 textes fusionnés.
 */

import logger from '../../core/logger/logger.js';

const DEBOUNCE_MS = 4500; // Attend 4.5s après le dernier message avant de traiter

interface DebouncedBuffer {
  messages: string[];
  timer: NodeJS.Timeout;
  receivedAt: number;
}

export type DebouncedMessageCallback = (
  chatJid: string,
  senderJid: string,
  senderName: string,
  combinedText: string,
  isGroup: boolean
) => Promise<void>;

export class MessageDebouncer {
  private static instance: MessageDebouncer;
  private buffers: Map<string, DebouncedBuffer> = new Map();
  private callback: DebouncedMessageCallback | null = null;

  private constructor() {}

  public static getInstance(): MessageDebouncer {
    if (!MessageDebouncer.instance) {
      MessageDebouncer.instance = new MessageDebouncer();
    }
    return MessageDebouncer.instance;
  }

  public setCallback(cb: DebouncedMessageCallback): void {
    this.callback = cb;
  }

  public push(
    chatJid: string,
    senderJid: string,
    senderName: string,
    text: string,
    isGroup: boolean
  ): void {
    const existing = this.buffers.get(chatJid);

    if (existing) {
      clearTimeout(existing.timer);
      existing.messages.push(text);
      existing.timer = setTimeout(() => {
        this.flush(chatJid, senderJid, senderName, isGroup);
      }, DEBOUNCE_MS);
    } else {
      const timer = setTimeout(() => {
        this.flush(chatJid, senderJid, senderName, isGroup);
      }, DEBOUNCE_MS);

      this.buffers.set(chatJid, {
        messages: [text],
        timer,
        receivedAt: Date.now()
      });
    }
  }

  private async flush(
    chatJid: string,
    senderJid: string,
    senderName: string,
    isGroup: boolean
  ): Promise<void> {
    const buffer = this.buffers.get(chatJid);
    if (!buffer || !this.callback) {
      this.buffers.delete(chatJid);
      return;
    }

    this.buffers.delete(chatJid);

    const combinedText = buffer.messages.join('\n').trim();
    if (!combinedText) return;

    logger.debug(
      `[MessageDebouncer] Flushed ${buffer.messages.length} messages from ${chatJid}: "${combinedText.slice(0, 80)}"`
    );

    try {
      await this.callback(chatJid, senderJid, senderName, combinedText, isGroup);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      logger.error(
        { errorMessage: e.message, stack: e.stack },
        '[MessageDebouncer] Error in callback'
      );
    }
  }

  public cancel(chatJid: string): void {
    const buffer = this.buffers.get(chatJid);
    if (buffer) {
      clearTimeout(buffer.timer);
      this.buffers.delete(chatJid);
    }
  }

  public getPendingCount(): number {
    return this.buffers.size;
  }
}

export default MessageDebouncer.getInstance();
