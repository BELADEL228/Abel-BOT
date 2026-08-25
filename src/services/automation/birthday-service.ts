/**
 * BirthdayService — Stockage et déclenchement des rappels d'anniversaire.
 * Vérifie chaque jour à 8h du matin si un anniversaire a lieu aujourd'hui.
 */

import logger from '../../core/logger/logger.js';

export interface BirthdayEntry {
  id: string;
  ownerJid: string;
  contactJid: string;
  contactName: string;
  day: number;   // 1-31
  month: number; // 1-12
  year?: number; // Optionnel (pour calculer l'âge)
  addedAt: number;
  customMessage?: string;
  lastAlertYear?: number;
}

function parseDate(input: string): { day: number; month: number; year?: number } | null {
  // Supports: 25/08, 25/08/2000, 25-08, 25-08-2000
  const m = input.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = m[3] ? parseInt(m[3], 10) : undefined;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return { day, month, year };
}

export class BirthdayService {
  private static instance: BirthdayService;
  private entries: BirthdayEntry[] = [];
  private checkTimer?: NodeJS.Timeout;
  private alertCallback?: (entry: BirthdayEntry) => void;

  private constructor() {}
  public static getInstance(): BirthdayService {
    if (!BirthdayService.instance) BirthdayService.instance = new BirthdayService();
    return BirthdayService.instance;
  }

  // ── Alert callback ────────────────────────────────────────────────────────────

  public onAlert(cb: (entry: BirthdayEntry) => void): void {
    this.alertCallback = cb;
    this.startDailyCheck();
  }

  // ── Add / Remove ─────────────────────────────────────────────────────────────

  public add(ownerJid: string, contactJid: string, contactName: string, dateStr: string, customMsg?: string): BirthdayEntry | null {
    const parsed = parseDate(dateStr);
    if (!parsed) return null;

    // Cap entries to 500 to avoid unbounded memory growth
    if (this.entries.length >= 500) {
      this.entries.shift();
    }

    const existing = this.entries.find(e => e.ownerJid === ownerJid && e.contactJid === contactJid);
    if (existing) {
      existing.day = parsed.day;
      existing.month = parsed.month;
      existing.year = parsed.year;
      existing.customMessage = customMsg;
      return existing;
    }

    const entry: BirthdayEntry = {
      id: Math.random().toString(36).slice(2, 8),
      ownerJid,
      contactJid,
      contactName,
      ...parsed,
      addedAt: Date.now(),
      customMessage: customMsg
    };
    this.entries.push(entry);
    logger.info(`[BirthdayService] Added birthday for ${contactName} on ${parsed.day}/${parsed.month}`);
    return entry;
  }

  public remove(ownerJid: string, contactJid: string): boolean {
    const before = this.entries.length;
    this.entries = this.entries.filter(e => !(e.ownerJid === ownerJid && e.contactJid === contactJid));
    return this.entries.length < before;
  }

  public list(ownerJid: string): BirthdayEntry[] {
    return this.entries.filter(e => e.ownerJid === ownerJid)
      .sort((a, b) => a.month !== b.month ? a.month - b.month : a.day - b.day);
  }

  // ── Today's birthdays ────────────────────────────────────────────────────────

  public getTodaysBirthdays(): BirthdayEntry[] {
    const now = new Date();
    const todayDay = now.getDate();
    const todayMonth = now.getMonth() + 1;
    return this.entries.filter(e => e.day === todayDay && e.month === todayMonth);
  }

  // ── Upcoming (within N days) ────────────────────────────────────────────────

  public getUpcoming(ownerJid: string, withinDays: number = 7): BirthdayEntry[] {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return this.entries.filter(e => {
      if (e.ownerJid !== ownerJid) return false;

      let nextBday = new Date(now.getFullYear(), e.month - 1, e.day).getTime();
      if (nextBday < startOfToday) {
        nextBday = new Date(now.getFullYear() + 1, e.month - 1, e.day).getTime();
      }

      const diffDays = Math.round((nextBday - startOfToday) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= withinDays;
    });
  }

  // ── Daily check loop ─────────────────────────────────────────────────────────

  private startDailyCheck(): void {
    if (this.checkTimer) return;

    const scheduleNext = () => {
      const now = new Date();
      const nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
      if (nextRun.getTime() <= now.getTime()) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      const delay = nextRun.getTime() - now.getTime();

      this.checkTimer = setTimeout(() => {
        this.runDailyCheck();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }

  private runDailyCheck(): void {
    const currentYear = new Date().getFullYear();
    const todays = this.getTodaysBirthdays();

    for (const entry of todays) {
      if (entry.lastAlertYear === currentYear) continue; // Alert once per year
      entry.lastAlertYear = currentYear;

      logger.info(`[BirthdayService] 🎂 Today is ${entry.contactName}'s birthday!`);
      try {
        this.alertCallback?.(entry);
      } catch (err) {
        logger.error({ error: err }, '[BirthdayService] Error in alert callback');
      }
    }
  }
}

export default BirthdayService.getInstance();
