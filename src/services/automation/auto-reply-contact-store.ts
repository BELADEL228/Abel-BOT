/**
 * AutoReplyContactStore — Cache mémoire + persistance Prisma pour les contacts AutoReply.
 *
 * Gère : cooldowns, catégories, historique des réponses, whitelist/blacklist, templates personnalisés.
 * Lecture depuis le cache en mémoire pour la vitesse, écriture asynchrone en base Prisma.
 */

import logger from '../../core/logger/logger.js';
import prisma from '../../core/db/prisma.js';

export type ContactCategory = 'FRIEND' | 'WORK' | 'FAMILY' | 'PERSONAL' | 'UNKNOWN';

export interface ContactRecord {
  userJid: string;
  name?: string;
  category: ContactCategory;
  customTemplate?: string;
  lastMessageAt: number;
  lastReplyAt?: number;
  cooldownUntil?: number;
  replyCount: number;
  isAllowed: boolean;  // whitelist
  isBlocked: boolean;  // blacklist
  humanActiveUntil?: number;
}

export type DecisionReason =
  | 'FIRST_MESSAGE'
  | 'COOLDOWN_EXPIRED'
  | 'COOLDOWN_ACTIVE'
  | 'OWNER_ACTIVE'
  | 'MESSAGE_READ'
  | 'URGENT_KEYWORD'
  | 'SHORT_MESSAGE'
  | 'TRIVIAL_MESSAGE'
  | 'BOT_DETECTED'
  | 'BLACKLISTED'
  | 'BLACKLISTED_GLOBAL'
  | 'GLOBAL_RATE_LIMIT'
  | 'GROUP_DISABLED'
  | 'SYSTEM_MESSAGE'
  | 'OWN_MESSAGE'
  | 'AUTOREPLY_OFF'
  | 'SCHEDULE_INACTIVE'
  | 'WHITELIST_ONLY'
  | 'LOOP_PROTECTION';

export interface LogEntry {
  contactJid: string;
  messageText: string;
  decision: 'REPLY' | 'IGNORE' | 'NOTIFY_OWNER' | 'CANCELED';
  reason: DecisionReason;
  templateUsed?: string;
  delayAppliedMs?: number;
  sentAt: number;
}

class AutoReplyContactStore {
  private static instance: AutoReplyContactStore;
  private contacts: Map<string, ContactRecord> = new Map();
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 200;

  private constructor() {}

  public static getInstance(): AutoReplyContactStore {
    if (!AutoReplyContactStore.instance) {
      AutoReplyContactStore.instance = new AutoReplyContactStore();
    }
    return AutoReplyContactStore.instance;
  }

  /**
   * Loads all contacts from database into memory cache
   */
  public async load(): Promise<void> {
    try {
      logger.info('[AutoReplyContactStore] Synchronizing contacts from database...');
      const dbContacts = await prisma.autoReplyContact.findMany();

      this.contacts.clear();
      for (const c of dbContacts) {
        this.contacts.set(c.userJid, {
          userJid: c.userJid,
          name: c.name || undefined,
          category: c.category as ContactCategory,
          customTemplate: c.customTemplate || undefined,
          lastMessageAt: c.lastMessageAt.getTime(),
          lastReplyAt: c.lastReplyAt?.getTime(),
          cooldownUntil: c.cooldownUntil?.getTime(),
          replyCount: c.replyCount,
          isAllowed: c.isAllowed,
          isBlocked: c.isBlocked,
          humanActiveUntil: c.humanActiveUntil?.getTime()
        });
      }
      logger.info(`[AutoReplyContactStore] ${this.contacts.size} contacts loaded successfully.`);
    } catch (error) {
      logger.error({ error }, '[AutoReplyContactStore] Failed to load contacts from database');
    }
  }

  // ─── CONTACT CRUD ───────────────────────────────────────────────────────────

  public getContact(jid: string): ContactRecord {
    if (!this.contacts.has(jid)) {
      const newContact: ContactRecord = {
        userJid: jid,
        category: 'UNKNOWN',
        lastMessageAt: Date.now(),
        replyCount: 0,
        isAllowed: false,
        isBlocked: false
      };
      this.contacts.set(jid, newContact);
      this.persistContact(newContact);
    }
    return this.contacts.get(jid)!;
  }

  public setCategory(jid: string, category: ContactCategory): void {
    const c = this.getContact(jid);
    c.category = category;
    this.persistContact(c);
  }

  public setCustomTemplate(jid: string, template: string): void {
    const c = this.getContact(jid);
    c.customTemplate = template;
    this.persistContact(c);
  }

  public removeCustomTemplate(jid: string): void {
    const c = this.getContact(jid);
    delete c.customTemplate;
    this.persistContact(c);
  }

  // ─── COOLDOWN ────────────────────────────────────────────────────────────────

  public isCooldownActive(jid: string): boolean {
    const c = this.getContact(jid);
    if (!c.cooldownUntil) return false;
    return Date.now() < c.cooldownUntil;
  }

  public setCooldown(jid: string, cooldownHours: number): void {
    const c = this.getContact(jid);
    c.cooldownUntil = Date.now() + cooldownHours * 3600 * 1000;
    c.lastReplyAt = Date.now();
    c.replyCount++;
    this.persistContact(c);
  }

  public resetCooldown(jid: string): void {
    const c = this.getContact(jid);
    c.cooldownUntil = undefined;
    this.persistContact(c);
  }

  public isFirstMessage(jid: string): boolean {
    const c = this.getContact(jid);
    return !c.lastReplyAt;
  }

  // ─── WHITELIST / BLACKLIST ───────────────────────────────────────────────────

  public allow(jid: string): void {
    const c = this.getContact(jid);
    c.isAllowed = true;
    c.isBlocked = false;
    this.persistContact(c);
  }

  public block(jid: string): void {
    const c = this.getContact(jid);
    c.isBlocked = true;
    c.isAllowed = false;
    this.persistContact(c);
  }

  public unallow(jid: string): void {
    const c = this.getContact(jid);
    c.isAllowed = false;
    this.persistContact(c);
  }

  public unblock(jid: string): void {
    const c = this.getContact(jid);
    c.isBlocked = false;
    this.persistContact(c);
  }

  public isBlocked(jid: string): boolean {
    return this.getContact(jid).isBlocked;
  }

  public isAllowed(jid: string): boolean {
    return this.getContact(jid).isAllowed;
  }

  public getWhitelist(): string[] {
    return Array.from(this.contacts.values())
      .filter(c => c.isAllowed)
      .map(c => c.userJid);
  }

  public getBlocklist(): string[] {
    return Array.from(this.contacts.values())
      .filter(c => c.isBlocked)
      .map(c => c.userJid);
  }

  // ─── HUMAN ACTIVE WINDOW ─────────────────────────────────────────────────────

  public setHumanActive(jid: string, windowMinutes: number): void {
    const c = this.getContact(jid);
    c.humanActiveUntil = Date.now() + windowMinutes * 60 * 1000;
    this.persistContact(c);
  }

  public isHumanActive(jid: string): boolean {
    const c = this.getContact(jid);
    if (!c.humanActiveUntil) return false;
    return Date.now() < c.humanActiveUntil;
  }

  public clearHumanActive(jid: string): void {
    const c = this.getContact(jid);
    delete c.humanActiveUntil;
    this.persistContact(c);
  }

  // ─── MESSAGE TRACKING ────────────────────────────────────────────────────────

  public recordIncomingMessage(jid: string, name?: string): void {
    const c = this.getContact(jid);
    c.lastMessageAt = Date.now();
    if (name) c.name = name;
    // Silent persist update of lastMessageAt
    this.persistContact(c);
  }

  // ─── AUDIT LOGS ─────────────────────────────────────────────────────────────

  public addLog(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }
    this.persistLog(entry);
  }

  public getLogs(limit = 10): LogEntry[] {
    return this.logs.slice(-limit).reverse();
  }

  public getStats(): {
    totalLogs: number;
    replied: number;
    ignored: number;
    canceled: number;
    notified: number;
    topContact: { jid: string; count: number } | null;
  } {
    const replied = this.logs.filter(l => l.decision === 'REPLY').length;
    const ignored = this.logs.filter(l => l.decision === 'IGNORE').length;
    const canceled = this.logs.filter(l => l.decision === 'CANCELED').length;
    const notified = this.logs.filter(l => l.decision === 'NOTIFY_OWNER').length;

    const freq = new Map<string, number>();
    for (const l of this.logs) {
      freq.set(l.contactJid, (freq.get(l.contactJid) || 0) + 1);
    }
    let topContact: { jid: string; count: number } | null = null;
    for (const [jid, count] of freq) {
      if (!topContact || count > topContact.count) {
        topContact = { jid, count };
      }
    }

    return { totalLogs: this.logs.length, replied, ignored, canceled, notified, topContact };
  }

  // ─── PERSISTENCE (fire-and-forget) ──────────────────────────────────────────

  private persistContact(c: ContactRecord): void {
    prisma.autoReplyContact.upsert({
      where: { userJid: c.userJid },
      create: {
        userJid: c.userJid,
        name: c.name,
        category: c.category,
        customTemplate: c.customTemplate,
        lastMessageAt: new Date(c.lastMessageAt),
        lastReplyAt: c.lastReplyAt ? new Date(c.lastReplyAt) : null,
        cooldownUntil: c.cooldownUntil ? new Date(c.cooldownUntil) : null,
        replyCount: c.replyCount,
        isAllowed: c.isAllowed,
        isBlocked: c.isBlocked,
        humanActiveUntil: c.humanActiveUntil ? new Date(c.humanActiveUntil) : null
      },
      update: {
        name: c.name,
        category: c.category,
        customTemplate: c.customTemplate,
        lastMessageAt: new Date(c.lastMessageAt),
        lastReplyAt: c.lastReplyAt ? new Date(c.lastReplyAt) : null,
        cooldownUntil: c.cooldownUntil ? new Date(c.cooldownUntil) : null,
        replyCount: c.replyCount,
        isAllowed: c.isAllowed,
        isBlocked: c.isBlocked,
        humanActiveUntil: c.humanActiveUntil ? new Date(c.humanActiveUntil) : null
      }
    }).catch((err: any) => {
      logger.debug({ error: err.message, jid: c.userJid }, '[AutoReplyContactStore] Persist contact failed');
    });
  }

  private async persistLog(entry: LogEntry): Promise<void> {
    try {
      // 1. Ensure the contact row exists in DB to prevent foreign key violation
      const contact = this.getContact(entry.contactJid);
      await prisma.autoReplyContact.upsert({
        where: { userJid: entry.contactJid },
        create: {
          userJid: entry.contactJid,
          name: contact.name,
          category: contact.category,
          customTemplate: contact.customTemplate,
          lastMessageAt: new Date(contact.lastMessageAt),
          lastReplyAt: contact.lastReplyAt ? new Date(contact.lastReplyAt) : null,
          cooldownUntil: contact.cooldownUntil ? new Date(contact.cooldownUntil) : null,
          replyCount: contact.replyCount,
          isAllowed: contact.isAllowed,
          isBlocked: contact.isBlocked,
          humanActiveUntil: contact.humanActiveUntil ? new Date(contact.humanActiveUntil) : null
        },
        update: {}
      }).catch(() => {});

      // 2. Insert audit log
      await prisma.autoReplyLog.create({
        data: {
          contactJid: entry.contactJid,
          messageText: (entry.messageText || '').slice(0, 500),
          decision: entry.decision,
          reason: entry.reason,
          templateUsed: entry.templateUsed,
          delayAppliedMs: entry.delayAppliedMs,
          sentAt: new Date(entry.sentAt)
        }
      });
    } catch (err: any) {
      logger.debug({ error: err.message, jid: entry.contactJid }, '[AutoReplyContactStore] Persist log failed');
    }
  }
}

export default AutoReplyContactStore.getInstance();
