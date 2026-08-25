/**
 * AutoReplyEngine v2 — Orchestrateur principal du système AutoReply intelligent.
 *
 * Pipeline complet :
 * Message entrant
 *   → Debounce (fusion des rafales)
 *   → Gatekeeper (filtres d'élimination absolue — 0ms, 0 appel IA)
 *   → Scoring & Décision
 *   → Sélection du template
 *   → Queue (délai humain + double-check pré-envoi)
 *   → Envoi + Logs + Cooldown
 *   → Notification owner si urgent
 */

import { IWhatsAppProvider } from '../../core/bot/types.js';
import { config } from '../../config/env.js';
import logger from '../../core/logger/logger.js';
import autoReplyConfig from './auto-reply-config.js';
import contactStore from './auto-reply-contact-store.js';
import templateEngine from './auto-reply-template-engine.js';
import autoReplyQueue from './auto-reply-queue.js';
import messageDebouncer from './message-debouncer.js';
import ruleEngine from './rule-engine.js';
import { botState } from '../../core/state/bot-state.js';
import aiResponseGenerator from './ai-response-generator.js';
import antiBanGuard from '../protection/anti-ban-guard.js';
import contextManager from './context-manager.js';

// Re-export AutoReplyTone for backwards compatibility with autoreply command
export type { AutoReplyTone } from './ai-response-generator.js';
export type { AutoReplyState } from './auto-reply-config.js';

// Legacy compat shims
export type AutoReplyMode = 'all' | 'private' | 'groups' | 'unknown' | 'whitelist';
export interface AutoReplyStats {
  totalReceived: number;
  autoRepliesSent: number;
  ignored: number;
  cooldownIgnored: number;
  aiReplies: number;
  customContactReplies: number;
  keywordReplies: number;
  urgentAlertsSent: number;
  contactFrequency: Map<string, number>;
}
export interface FollowUpItem { id: string; targetJid: string; targetName: string; durationStr: string; remindAt: number; }
export interface ReminderItem { id: string; text: string; remindAt: number; }

export class AutoReplyEngine {
  private static instance: AutoReplyEngine;

  // ── Legacy-compat public properties ──────────────────────────────────────────
  public get isEnabled(): boolean { return autoReplyConfig.state !== 'OFF' && autoReplyConfig.state !== 'PAUSED'; }
  public set isEnabled(v: boolean) {
    // Trigger async state change without blocking (fire and forget with logging)
    autoReplyConfig.setState(v ? 'ON' : 'OFF').catch(err => logger.error({ err }, '[AutoReplyEngine] Failed to set isEnabled'));
  }

  public mode: AutoReplyMode = 'private';
  public isAiEnabled: boolean = true;
  public isContextEnabled: boolean = true;
  public tone: any = 'casual';

  public get cooldownMinutes(): number { return autoReplyConfig.cooldownHours * 60; }
  public set cooldownMinutes(v: number) { autoReplyConfig.cooldownHours = v / 60; }

  public get waitBeforeReplyMinutes(): number { return autoReplyConfig.minDelaySeconds / 60; }
  public set waitBeforeReplyMinutes(_v: number) { /* replaced by queue delay */ }

  public get ownerReminderHours(): number { return 2; }
  public set ownerReminderHours(_v: number) { /* noop */ }

  public get humanActiveWindowMinutes(): number { return autoReplyConfig.humanActiveWindowMinutes; }
  public set humanActiveWindowMinutes(v: number) { autoReplyConfig.humanActiveWindowMinutes = v; }

  public get delayRange(): { min: number; max: number } | null {
    return { min: autoReplyConfig.minDelaySeconds, max: autoReplyConfig.maxDelaySeconds };
  }
  public set delayRange(v: { min: number; max: number } | null) {
    if (v) { autoReplyConfig.minDelaySeconds = v.min; autoReplyConfig.maxDelaySeconds = v.max; }
  }

  public get groupsEnabled(): boolean { return autoReplyConfig.groupsEnabled; }
  public set groupsEnabled(v: boolean) { autoReplyConfig.groupsEnabled = v; }

  public followUps: FollowUpItem[] = [];
  public reminders: ReminderItem[] = [];

  public stats: AutoReplyStats = {
    totalReceived: 0,
    autoRepliesSent: 0,
    ignored: 0,
    cooldownIgnored: 0,
    aiReplies: 0,
    customContactReplies: 0,
    keywordReplies: 0,
    urgentAlertsSent: 0,
    contactFrequency: new Map()
  };

  // ── Human tracking (read receipts + active chats) ─────────────────────────────
  private humanReadChats: Map<string, number> = new Map();

  // ── Owner reminder timers ─────────────────────────────────────────────────────
  private ownerReminderTimers: Map<string, NodeJS.Timeout> = new Map();

  // MAX entries to prevent unbounded growth
  private static readonly MAX_CONTACT_FREQ = 5000;

  // Cleanup interval (run daily)
  private contactFreqCleanupTimer: NodeJS.Timeout | null = null;
  private followUpTickerInterval: NodeJS.Timeout | null = null;
  private monitoringTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Wire the debouncer callback to our decision pipeline
    messageDebouncer.setCallback(async (chatJid, senderJid, senderName, combinedText, isGroup) => {
      try {
        await this.runDecisionPipeline(chatJid, senderJid, senderName, combinedText, isGroup);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        logger.error(
          { errorMessage: e.message, stack: e.stack, chatJid },
          '[AutoReplyEngine] Unhandled error in decision pipeline'
        );
      }
    });
    this.startFollowUpTicker();
    this.startContactFreqCleanup();
    this.startMonitoring();
  }

  public static getInstance(): AutoReplyEngine {
    if (!AutoReplyEngine.instance) {
      AutoReplyEngine.instance = new AutoReplyEngine();
    }
    return AutoReplyEngine.instance;
  }

  // ─── PUBLIC ENTRY POINT ───────────────────────────────────────────────────────

  /**
   * Called by message-handler for every incoming message.
   * Feeds through the debouncer first, then the decision pipeline.
   */
  public async processIncoming(
    chatJid: string,
    senderJid: string,
    senderName: string,
    text: string,
    isGroup: boolean,
    provider: IWhatsAppProvider
  ): Promise<void> {
    this.stats.totalReceived++;
    const freq = (this.stats.contactFrequency.get(senderName || chatJid) || 0) + 1;
    this.stats.contactFrequency.set(senderName || chatJid, freq);

    // Always track context for AI
    contextManager.addMessage(chatJid, 'contact', text);
    contactStore.recordIncomingMessage(senderJid, senderName);

    // Store provider reference on contact for later use in queue
    (this as any)._lastProvider = provider;
    (this as any)._providers = (this as any)._providers || new Map();

    // Limit _providers to prevent unbounded growth
    const MAX_PROVIDERS = 1000;
    if ((this as any)._providers.size >= MAX_PROVIDERS) {
      (this as any)._providers.clear();
      logger.debug('[AutoReplyEngine] Cleared _providers Map (exceeded limit)');
    }

    (this as any)._providers.set(chatJid, provider);

    // Feed through debouncer (messages arriving quickly will be batched together)
    messageDebouncer.push(chatJid, senderJid, senderName, text, isGroup);
  }

  // ─── DECISION PIPELINE ────────────────────────────────────────────────────────

  private async runDecisionPipeline(
    chatJid: string,
    senderJid: string,
    senderName: string,
    text: string,
    isGroup: boolean
  ): Promise<void> {
    const provider: IWhatsAppProvider | undefined = (this as any)._providers?.get(chatJid);
    if (!provider) return;

    // ═══ STEP 1: ABSOLUTE GATEKEEPERS (0ms, 0 IA) ══════════════════════════════

    // 1.1 — AutoReply is OFF or PAUSED
    if (!autoReplyConfig.isActive()) {
      this.logAndIgnore(chatJid, text, 'AUTOREPLY_OFF');
      return;
    }

    // 1.2 — Group not allowed
    if (isGroup) {
      if (!autoReplyConfig.groupsEnabled || autoReplyConfig.isGroupIgnored(chatJid)) {
        this.logAndIgnore(chatJid, text, 'GROUP_DISABLED');
        return;
      }
    }

    // 1.3 — Private only mode and it's a group
    if (isGroup && this.mode === 'private') {
      this.logAndIgnore(chatJid, text, 'GROUP_DISABLED');
      return;
    }

    // 1.4 — Bot message detection
    if (autoReplyConfig.isBotMessage(text)) {
      this.logAndIgnore(chatJid, text, 'BOT_DETECTED');
      return;
    }

    // 1.5 — Trivial / short message (single word, "ok", "merci", "👍", etc.)
    if (autoReplyConfig.isTrivialMessage(text)) {
      this.logAndIgnore(chatJid, text, 'TRIVIAL_MESSAGE');
      return;
    }

    // 1.6 — Blacklisted contact (via ruleEngine or botState or contactStore)
    const isBlocked =
      ruleEngine.isBlacklisted(senderJid) ||
      botState.blacklistedUsers.has(senderJid) ||
      contactStore.isBlocked(senderJid);
    if (isBlocked) {
      this.logAndIgnore(chatJid, text, 'BLACKLISTED');
      return;
    }

    // 1.7 — Owner is actively chatting in this conversation
    if (contactStore.isHumanActive(chatJid)) {
      this.logAndIgnore(chatJid, text, 'OWNER_ACTIVE');
      return;
    }

    // 1.8 — Owner recently read this chat (within 90 seconds)
    const readAt = this.humanReadChats.get(chatJid);
    if (readAt && Date.now() - readAt < 90_000) {
      this.logAndIgnore(chatJid, text, 'MESSAGE_READ');
      return;
    }

    // 1.9 — Global rate limit (maxPerHour)
    if (!autoReplyConfig.checkAndIncrementRateLimit()) {
      this.logAndIgnore(chatJid, text, 'GLOBAL_RATE_LIMIT');
      return;
    }

    // 1.10 — Schedule check (SCHEDULED state must be in active window)
    if (autoReplyConfig.state === 'SCHEDULED' && !autoReplyConfig.isInScheduleWindow()) {
      this.logAndIgnore(chatJid, text, 'SCHEDULE_INACTIVE');
      return;
    }

    // 1.11 — Whitelist-only mode check
    const isWhitelisted =
      ruleEngine.isWhitelisted(senderJid) ||
      botState.whitelistedUsers.has(senderJid) ||
      botState.isSudo(senderJid) ||
      contactStore.isAllowed(senderJid) ||
      botState.hasCustomPermission(senderJid, 'autoreply', 'automation');

    if (this.mode === 'whitelist' && !isWhitelisted) {
      this.logAndIgnore(chatJid, text, 'WHITELIST_ONLY');
      return;
    }

    // 1.12 — Cooldown check
    if (contactStore.isCooldownActive(senderJid)) {
      this.stats.cooldownIgnored++;
      this.logAndIgnore(chatJid, text, 'COOLDOWN_ACTIVE');
      return;
    }

    // ═══ STEP 2: URGENCY CHECK & OWNER NOTIFICATION ═════════════════════════════

    const urgency = autoReplyConfig.checkUrgency(text);
    if (urgency.isUrgent) {
      await this.notifyOwner(chatJid, senderJid, senderName, text, urgency.keyword!, provider);
      this.stats.urgentAlertsSent++;
      contactStore.addLog({
        contactJid: senderJid,
        messageText: text,
        decision: 'NOTIFY_OWNER',
        reason: 'URGENT_KEYWORD',
        sentAt: Date.now()
      });
    }

    // ═══ STEP 3: TEMPLATE SELECTION ═════════════════════════════════════════════

    const contact = contactStore.getContact(senderJid);
    const ownerName = provider.sessionOwnerName || 'Abel';

    let selectedMessage: string;
    let templateName: string;

    // Priority 1: Contact-specific rule engine override
    const contactOverride = ruleEngine.getContactReply(senderJid) || ruleEngine.getContactReply(chatJid);
    if (contactOverride) {
      const ctx = { name: senderName || senderJid.split('@')[0], phone: senderJid.split('@')[0], ownerName };
      selectedMessage = ruleEngine.interpolateVariables(contactOverride, { fullName: ctx.name, phone: ctx.phone });
      templateName = 'contact_override';
      this.stats.customContactReplies++;
    }
    // Priority 2: Keyword match
    else if (ruleEngine.matchKeyword(text)) {
      const kwMatch = ruleEngine.matchKeyword(text)!;
      selectedMessage = ruleEngine.interpolateVariables(kwMatch.reply, {
        fullName: senderName || senderJid.split('@')[0],
        phone: senderJid.split('@')[0]
      });
      templateName = `keyword:${kwMatch.keyword}`;
      this.stats.keywordReplies++;
    }
    // Priority 3: AI-driven reply (if enabled)
    else if (this.isAiEnabled) {
      const contextText = this.isContextEnabled ? contextManager.getPreviousContextFormatted(chatJid) : undefined;
      try {
        selectedMessage = await aiResponseGenerator.generateHumanReply({
          chatJid,
          contactName: senderName || senderJid.split('@')[0],
          senderJid,
          incomingText: text,
          contextText,
          tone: this.tone,
          ownerName,
          sessionId: (provider as any).sessionOwnerJid || 'main'
        });

        if (!selectedMessage) throw new Error('AI returned empty reply');

        templateName = 'ai_generated';
        this.stats.aiReplies++;
      } catch {
        // Fallback to template on AI failure
        selectedMessage = templateEngine.resolve(
          autoReplyConfig.state,
          contact.category,
          { name: senderName || senderJid.split('@')[0], phone: senderJid.split('@')[0], ownerName },
          contact.customTemplate,
          autoReplyConfig.vacationUntil || undefined
        );
        templateName = 'template_fallback';
      }
    }
    // Priority 4: Template-based reply
    else {
      selectedMessage = templateEngine.resolve(
        autoReplyConfig.state,
        contact.category,
        { name: senderName || senderJid.split('@')[0], phone: senderJid.split('@')[0], ownerName },
        contact.customTemplate,
        autoReplyConfig.vacationUntil || undefined
      );
      templateName = `template:${autoReplyConfig.state}:${contact.category}`;
    }

    // ═══ STEP 4: QUEUE WITH HUMAN DELAY + DOUBLE-CHECK ══════════════════════════

    const minMs = autoReplyConfig.minDelaySeconds * 1000;
    const maxMs = autoReplyConfig.maxDelaySeconds * 1000;
    const delayMs = antiBanGuard
      ? antiBanGuard.getHumanJitterMs(minMs, maxMs)
      : Math.floor(Math.random() * (maxMs - minMs)) + minMs;

    const isFirstMsg = contactStore.isFirstMessage(senderJid);
    const reason = isFirstMsg ? 'FIRST_MESSAGE' : 'COOLDOWN_EXPIRED';

    autoReplyQueue.enqueue({
      chatJid,
      senderJid,
      senderName,
      message: selectedMessage,
      templateName,
      delayMs,
      scheduledAt: Date.now(),
      provider,

      // ── DOUBLE-CHECK PRE-SEND ──────────────────────────────────────────────────
      // Called just before the message is actually sent.
      // If any blocking condition appeared while we were waiting, cancel the send.
      onPreSendCheck: () => {
        if (!autoReplyConfig.isActive()) return false;
        if (contactStore.isHumanActive(chatJid)) return false;
        const newReadAt = this.humanReadChats.get(chatJid);
        if (newReadAt && Date.now() - newReadAt < 90_000) return false;
        if (contactStore.isCooldownActive(senderJid)) return false;
        return true;
      },

      onSent: () => {
        this.stats.autoRepliesSent++;
        contactStore.setCooldown(senderJid, autoReplyConfig.cooldownHours);
        contextManager.addMessage(chatJid, 'owner', selectedMessage);
        contactStore.addLog({
          contactJid: senderJid,
          messageText: text,
          decision: 'REPLY',
          reason,
          templateUsed: templateName,
          delayAppliedMs: delayMs,
          sentAt: Date.now()
        });
        // Schedule 2h owner reminder
        this.scheduleOwnerReminder(chatJid, senderJid, senderName, text, provider);
        logger.info(`[AutoReplyEngine] Auto-reply sent to ${chatJid} (${reason}, template: ${templateName})`);
      },

      onCanceled: () => {
        contactStore.addLog({
          contactJid: senderJid,
          messageText: text,
          decision: 'CANCELED',
          reason: 'OWNER_ACTIVE',
          sentAt: Date.now()
        });
      }
    });
  }

  // ─── OWNER NOTIFICATION ───────────────────────────────────────────────────────

  private async notifyOwner(
    chatJid: string,
    senderJid: string,
    senderName: string,
    text: string,
    keyword: string,
    provider: IWhatsAppProvider
  ): Promise<void> {
    const cleanOwnerPhone = config.botOwner.replace(/\D/g, '');
    const ownerJid = cleanOwnerPhone ? `${cleanOwnerPhone}@s.whatsapp.net` : null;
    if (!ownerJid || ownerJid === senderJid) return;

    const alert =
      `🚨 *MESSAGE URGENT DÉTECTÉ — ABEL-BOT*\n\n` +
      `👤 *De :* ${senderName || senderJid.split('@')[0]} (@${senderJid.split('@')[0]})\n` +
      `🏷️ *Mot-clé :* \`${keyword}\`\n\n` +
      `💬 *Message :*\n"${text.slice(0, 300)}"\n\n` +
      `⚡ *À répondre en priorité !*`;

    try {
      await provider.sendMessage(ownerJid, alert, { mentions: [senderJid] });
    } catch (err) {
      logger.error({ error: err }, '[AutoReplyEngine] Failed to send urgent alert');
    }
  }

  private scheduleOwnerReminder(
    chatJid: string,
    senderJid: string,
    senderName: string,
    text: string,
    provider: IWhatsAppProvider
  ): void {
    // Clear any previous reminder for this chat
    const existing = this.ownerReminderTimers.get(chatJid);
    if (existing) clearTimeout(existing);

    const reminderMs = 2 * 3600 * 1000; // 2 hours
    const timer = setTimeout(async () => {
      this.ownerReminderTimers.delete(chatJid);
      // Only notify if owner hasn't replied yet
      if (contactStore.isHumanActive(chatJid)) return;

      const cleanOwnerPhone = config.botOwner.replace(/\D/g, '');
      const ownerJid = cleanOwnerPhone ? `${cleanOwnerPhone}@s.whatsapp.net` : null;
      if (!ownerJid) return;

      const notif =
        `⏰ *RAPPEL 2H — MESSAGE EN ATTENTE*\n\n` +
        `👤 *Contact :* ${senderName || senderJid.split('@')[0]} (@${senderJid.split('@')[0]})\n` +
        `💬 *Dernier message :* "${text.slice(0, 200)}"\n\n` +
        `🤖 Une réponse automatique a été envoyée il y a 2h.\n` +
        `👉 Pensez à lui répondre personnellement dès que possible !`;

      try {
        await provider.sendMessage(ownerJid, notif, { mentions: [senderJid] });
      } catch (err) {
        logger.error({ error: err }, '[AutoReplyEngine] Failed to send 2h reminder');
      }
    }, reminderMs);

    this.ownerReminderTimers.set(chatJid, timer);
  }

  // ─── OWNER REPLY & READ HOOKS ─────────────────────────────────────────────────

  /**
   * Called when the owner sends a message in a chat (fromMe = true).
   * Marks the conversation as human-active, cancels queued auto-replies.
   */
  public registerOwnerReply(chatJid: string, text?: string): void {
    if (text) contextManager.addMessage(chatJid, 'owner', text);

    // Mark as human-active for `humanActiveWindowMinutes`
    contactStore.setHumanActive(chatJid, autoReplyConfig.humanActiveWindowMinutes);

    // Cancel any pending debounced message
    messageDebouncer.cancel(chatJid);

    // Cancel any pending queued auto-reply
    autoReplyQueue.cancelByChatJid(chatJid);

    // Dismiss owner reminder
    const existingReminder = this.ownerReminderTimers.get(chatJid);
    if (existingReminder) {
      clearTimeout(existingReminder);
      this.ownerReminderTimers.delete(chatJid);
    }

    logger.info(`[AutoReplyEngine] Owner active in ${chatJid}. Auto-reply paused for ${autoReplyConfig.humanActiveWindowMinutes}m.`);
  }

  /**
   * Called when a read receipt is received for a chat.
   * Owner read the message → cancel any pending auto-reply.
   */
  public registerOwnerRead(chatJid: string): void {
    this.humanReadChats.set(chatJid, Date.now());
    messageDebouncer.cancel(chatJid);
    autoReplyQueue.cancelByChatJid(chatJid);
    logger.debug(`[AutoReplyEngine] Read receipt received for ${chatJid}. Pending auto-reply canceled.`);
  }

  // ─── HELPER ───────────────────────────────────────────────────────────────────

  private logAndIgnore(chatJid: string, text: string, reason: any): void {
    this.stats.ignored++;
    contactStore.addLog({
      contactJid: chatJid,
      messageText: text,
      decision: 'IGNORE',
      reason,
      sentAt: Date.now()
    });
    logger.debug(`[AutoReplyEngine] IGNORE ${chatJid} — reason: ${reason}`);
  }

  // ─── LEGACY COMPAT (follow-ups / reminders) ───────────────────────────────────

  public addFollowUp(targetJid: string, targetName: string, durationStr: string): boolean {
    const match = durationStr.match(/^(\d+)(m|h|d)$/i);
    if (!match) return false;
    const val = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    let ms = val * 60_000;
    if (unit === 'h') ms = val * 3_600_000;
    if (unit === 'd') ms = val * 86_400_000;
    const item: FollowUpItem = {
      id: Math.random().toString(36).slice(7),
      targetJid, targetName, durationStr,
      remindAt: Date.now() + ms
    };
    this.followUps.push(item);
    return true;
  }

  public addReminder(text: string, durationStr: string): boolean {
    const match = durationStr.match(/^(\d+)(m|h|d)$/i);
    if (!match) return false;
    const val = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    let ms = val * 60_000;
    if (unit === 'h') ms = val * 3_600_000;
    if (unit === 'd') ms = val * 86_400_000;
    this.reminders.push({ id: Math.random().toString(36).slice(7), text, remindAt: Date.now() + ms });
    return true;
  }

  private startFollowUpTicker(): void {
    // Clear existing interval if already running
    if (this.followUpTickerInterval) {
      clearInterval(this.followUpTickerInterval);
    }

    this.followUpTickerInterval = setInterval(() => {
      const now = Date.now();

      this.followUps = this.followUps.filter(f => {
        if (now >= f.remindAt) {
          logger.info(`[AutoReplyEngine] Follow-up reminder fired for ${f.targetJid}`);
          return false;
        }
        return true;
      });

      this.reminders = this.reminders.filter(r => {
        if (now >= r.remindAt) {
          logger.info(`[AutoReplyEngine] Reminder fired: "${r.text}"`);
          return false;
        }
        return true;
      });

      // Auto-expire vacation
      if (autoReplyConfig.state === 'VACATION' &&
          autoReplyConfig.vacationUntil &&
          now > autoReplyConfig.vacationUntil.getTime()) {
        autoReplyConfig.setState('OFF');
        autoReplyConfig.vacationUntil = null;
        logger.info('[AutoReplyEngine] Vacation expired. AutoReply set to OFF.');
      }
    }, 60_000); // Run every 60s
  }

  private startContactFreqCleanup(): void {
    if (this.contactFreqCleanupTimer) clearInterval(this.contactFreqCleanupTimer);

    this.contactFreqCleanupTimer = setInterval(() => {
      if (this.stats.contactFrequency.size > AutoReplyEngine.MAX_CONTACT_FREQ) {
        logger.warn(
          `[AutoReplyEngine] Clearing contactFrequency Map (${this.stats.contactFrequency.size} entries > ${AutoReplyEngine.MAX_CONTACT_FREQ})`
        );
        this.stats.contactFrequency.clear();
      }
    }, 3_600_000); // Run hourly
  }

  private startMonitoring(): void {
    if (this.monitoringTimer) clearInterval(this.monitoringTimer);

    this.monitoringTimer = setInterval(() => {
      const providersSize = (this as any)._providers?.size || 0;
      const contactFreqSize = this.stats.contactFrequency.size;

      logger.info({
        event: 'HEARTBEAT_AUTOREPLY',
        stats: {
          received: this.stats.totalReceived,
          sent: this.stats.autoRepliesSent,
          aiReplies: this.stats.aiReplies,
          ignored: this.stats.ignored,
          urgentAlerts: this.stats.urgentAlertsSent
        },
        memory: {
          trackedContacts: contactFreqSize,
          activeProviders: providersSize,
          followUpsPending: this.followUps.length,
          remindersPending: this.reminders.length
        }
      }, '[AutoReplyEngine] Hourly health check');

      // Alert if maps are getting full (80% of MAX)
      if (contactFreqSize > AutoReplyEngine.MAX_CONTACT_FREQ * 0.8) {
        logger.warn(`[AutoReplyEngine] High memory usage: contactFrequency is at ${contactFreqSize}/${AutoReplyEngine.MAX_CONTACT_FREQ}`);
      }
      if (providersSize > 800) { // 80% of 1000
        logger.warn(`[AutoReplyEngine] High memory usage: _providers map is at ${providersSize}/1000`);
      }
    }, 3_600_000); // Hourly
  }

  public shutdown(): void {
    // Clean up all timers
    if (this.contactFreqCleanupTimer) clearInterval(this.contactFreqCleanupTimer);
    if (this.followUpTickerInterval) clearInterval(this.followUpTickerInterval);
    if (this.monitoringTimer) clearInterval(this.monitoringTimer);
    for (const timer of this.ownerReminderTimers.values()) {
      clearTimeout(timer);
    }
    this.ownerReminderTimers.clear();
    (this as any)._providers?.clear?.();
    logger.info('[AutoReplyEngine] Shutdown complete');
  }
}

export default AutoReplyEngine.getInstance();
