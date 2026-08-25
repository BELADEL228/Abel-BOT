/**
 * AntiBanGuard — Service de protection anti-ban WhatsApp
 *
 * WhatsApp détecte les comportements de bot par :
 *  - Volume de messages trop élevé par heure/jour
 *  - Absence de délai entre les envois (pattern mécanique)
 *  - Réponses systématiques à chaque message (ratio 1:1)
 *  - Rafales de messages identiques ou très similaires
 *
 * Ce service centralise toutes ces protections.
 */

import logger from '../../core/logger/logger.js';

interface ChatSendStats {
  hourCount: number;
  hourWindowStart: number;
  lastSentAt: number;
}

interface DailyStats {
  count: number;
  dayStart: number;
}

class AntiBanGuard {
  private static instance: AntiBanGuard;

  // Per-chat: max messages per hour
  private readonly MAX_PER_CHAT_PER_HOUR = 30;

  // Global daily cap for all outgoing bot messages
  private readonly GLOBAL_DAILY_CAP = 500;

  // Auto-reply specific daily cap (subset of GLOBAL_DAILY_CAP)
  private readonly AUTO_REPLY_DAILY_CAP = 150;

  // Minimum interval between two messages to the same chat (ms)
  private readonly MIN_INTERVAL_SAME_CHAT_MS = 3_000;

  private chatStats: Map<string, ChatSendStats> = new Map();
  private dailyStats: DailyStats = { count: 0, dayStart: Date.now() };
  private autoReplyDailyCount = 0;
  private autoReplyDayStart = Date.now();

  private constructor() {}

  public static getInstance(): AntiBanGuard {
    if (!AntiBanGuard.instance) {
      AntiBanGuard.instance = new AntiBanGuard();
    }
    return AntiBanGuard.instance;
  }

  /**
   * Must be called before sending ANY message (command replies, auto-replies, etc.)
   * Returns true if the message is allowed, false if it should be silently dropped.
   */
  public checkMessageSend(chatJid: string, isAutoReply = false): boolean {
    const now = Date.now();

    // ── 1. Global daily cap ────────────────────────────────────────────────────
    if (now - this.dailyStats.dayStart >= 86_400_000) {
      this.dailyStats = { count: 0, dayStart: now };
    }
    if (this.dailyStats.count >= this.GLOBAL_DAILY_CAP) {
      logger.warn('[AntiBanGuard] Global daily message cap reached. Message blocked.');
      return false;
    }

    // ── 2. Auto-reply daily cap ────────────────────────────────────────────────
    if (isAutoReply) {
      if (now - this.autoReplyDayStart >= 86_400_000) {
        this.autoReplyDailyCount = 0;
        this.autoReplyDayStart = now;
      }
      if (this.autoReplyDailyCount >= this.AUTO_REPLY_DAILY_CAP) {
        logger.warn('[AntiBanGuard] Auto-reply daily cap reached. Auto-reply blocked.');
        return false;
      }
    }

    // ── 3. Per-chat hourly cap ─────────────────────────────────────────────────
    const stats = this.chatStats.get(chatJid);
    if (stats) {
      if (now - stats.hourWindowStart < 3_600_000) {
        if (stats.hourCount >= this.MAX_PER_CHAT_PER_HOUR) {
          logger.warn(`[AntiBanGuard] Per-chat hourly cap reached for ${chatJid}. Message blocked.`);
          return false;
        }
      } else {
        // Reset hourly window
        stats.hourCount = 0;
        stats.hourWindowStart = now;
      }

      // ── 4. Minimum send interval ─────────────────────────────────────────────
      if (now - stats.lastSentAt < this.MIN_INTERVAL_SAME_CHAT_MS) {
        logger.debug(`[AntiBanGuard] Too fast for chat ${chatJid}. Enforcing minimum interval.`);
        return false;
      }
    }

    return true;
  }

  /**
   * Must be called AFTER a message is actually sent to update counters.
   */
  public recordSent(chatJid: string, isAutoReply = false): void {
    const now = Date.now();

    // Global daily
    this.dailyStats.count++;

    // Auto-reply daily
    if (isAutoReply) {
      this.autoReplyDailyCount++;
    }

    // Per-chat hourly
    const stats = this.chatStats.get(chatJid);
    if (stats) {
      if (now - stats.hourWindowStart >= 3_600_000) {
        stats.hourCount = 1;
        stats.hourWindowStart = now;
      } else {
        stats.hourCount++;
      }
      stats.lastSentAt = now;
    } else {
      this.chatStats.set(chatJid, {
        hourCount: 1,
        hourWindowStart: now,
        lastSentAt: now
      });
    }
  }

  /**
   * Returns a randomized human-like jitter delay in ms.
   * Longer delays during "off-hours" (23h-07h), shorter during active hours.
   */
  public getHumanJitterMs(baseMinMs: number, baseMaxMs: number): number {
    const hour = new Date().getHours();
    // Off-peak hours: add extra 50-100% delay
    const multiplier = hour >= 23 || hour < 7 ? 1.5 + Math.random() * 0.5 : 1.0;
    const base = Math.floor(Math.random() * (baseMaxMs - baseMinMs + 1)) + baseMinMs;
    return Math.floor(base * multiplier);
  }

  /**
   * Returns current protection stats for monitoring.
   */
  public getStats() {
    return {
      globalDailyCount: this.dailyStats.count,
      globalDailyCap: this.GLOBAL_DAILY_CAP,
      autoReplyDailyCount: this.autoReplyDailyCount,
      autoReplyDailyCap: this.AUTO_REPLY_DAILY_CAP,
      trackedChats: this.chatStats.size
    };
  }
}

export default AntiBanGuard.getInstance();
