/**
 * BirthdayService — Gestion et envoi automatique des souhaits d'anniversaire personnalisés.
 *
 * Fonctionnalités :
 * - Stockage persistant (Fichier JSON sécurisé + Base de données Prisma)
 * - Message programmé spécifique et sur-mesure pour chaque personne
 * - Envoi automatique direct dans la discussion WhatsApp du destinataire
 * - Support des variables : {name}, {firstName}, {age}, {year}
 * - Notification de confirmation envoyée au propriétaire du bot
 * - Protection anti-doublon annuelle (lastSentYear)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import prisma from '../../core/db/prisma.js';
import logger from '../../core/logger/logger.js';

export interface BirthdayEntry {
  id: string;
  ownerJid: string;
  contactJid: string;
  contactName: string;
  day: number;           // 1-31
  month: number;         // 1-12
  year?: number;         // Optionnel (ex: 2000 pour calculer l'âge)
  customMessage?: string; // Message personnalisé programmé pour la personne
  autoSendDirect: boolean; // Envoi direct au contact (défaut: true)
  sendHour: number;      // Heure d'envoi (0-23, défaut: 8 pour 08h00)
  lastSentYear?: number; // Année du dernier envoi réussi
  createdAt: number;
  updatedAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'birthdays.json');

const DEFAULT_WISH_TEMPLATE =
  `🎉 *JOYEUX ANNIVERSAIRE {name} !* 🎂✨\n\n` +
  `Que cette nouvelle année t'apporte beaucoup de bonheur, de santé, de paix et de grandes réussites dans tous tes projets ! 🥳🎁\n\n` +
  `Profite pleinement de ta journée exceptionnelle ! 🥂🌟`;

function parseDateString(input: string): { day: number; month: number; year?: number } | null {
  const clean = input.trim().replace(/[.\-]/g, '/');
  const m = clean.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = m[3] ? parseInt(m[3], 10) : undefined;

  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  if (year && (year < 1900 || year > new Date().getFullYear())) return null;

  return { day, month, year };
}

export class BirthdayService {
  private static instance: BirthdayService;
  private entries: BirthdayEntry[] = [];
  private checkInterval?: NodeJS.Timeout;
  private dispatchHandler?: (entry: BirthdayEntry, formattedMessage: string) => Promise<void>;

  private constructor() {
    this.ensureStorage();
    this.loadEntries();
    this.startScheduler();
  }

  public static getInstance(): BirthdayService {
    if (!BirthdayService.instance) {
      BirthdayService.instance = new BirthdayService();
    }
    return BirthdayService.instance;
  }

  // ── Initialisation et Stockage Persistant ────────────────────────────────────

  private ensureStorage(): void {
    if (!existsSync(DATA_DIR)) {
      try {
        mkdirSync(DATA_DIR, { recursive: true });
      } catch (err) {
        logger.error({ error: err }, '[BirthdayService] Failed to create data directory');
      }
    }
  }

  private loadEntries(): void {
    try {
      if (existsSync(DATA_FILE)) {
        const raw = readFileSync(DATA_FILE, 'utf-8');
        this.entries = JSON.parse(raw);
        logger.info(`[BirthdayService] Loaded ${this.entries.length} birthdays from persistent storage.`);
      }
    } catch (err) {
      logger.error({ error: err }, '[BirthdayService] Failed to read birthdays.json');
      this.entries = [];
    }
  }

  private saveEntries(): void {
    try {
      this.ensureStorage();
      writeFileSync(DATA_FILE, JSON.stringify(this.entries, null, 2), 'utf-8');
    } catch (err) {
      logger.error({ error: err }, '[BirthdayService] Failed to persist birthdays to file');
    }

    // Synchronisation asynchrone avec Prisma en arrière-plan
    this.syncWithDatabase().catch(() => {});
  }

  private async syncWithDatabase(): Promise<void> {
    try {
      if ((prisma as any)?.birthday) {
        for (const entry of this.entries) {
          await (prisma as any).birthday.upsert({
            where: {
              ownerJid_contactJid: {
                ownerJid: entry.ownerJid,
                contactJid: entry.contactJid,
              }
            },
            update: {
              contactName: entry.contactName,
              day: entry.day,
              month: entry.month,
              year: entry.year,
              customMessage: entry.customMessage,
              autoSendDirect: entry.autoSendDirect,
              sendHour: entry.sendHour,
              lastSentYear: entry.lastSentYear,
              updatedAt: new Date(),
            },
            create: {
              id: entry.id,
              ownerJid: entry.ownerJid,
              contactJid: entry.contactJid,
              contactName: entry.contactName,
              day: entry.day,
              month: entry.month,
              year: entry.year,
              customMessage: entry.customMessage,
              autoSendDirect: entry.autoSendDirect,
              sendHour: entry.sendHour,
              lastSentYear: entry.lastSentYear,
            }
          });
        }
      }
    } catch {
      // Ignore si la table DB n'est pas encore migrée
    }
  }

  // ── Gestionnaire d'alerte et d'envoi ──────────────────────────────────────────

  public onDispatch(handler: (entry: BirthdayEntry, formattedMessage: string) => Promise<void>): void {
    this.dispatchHandler = handler;
  }

  // ── Formatage du message avec variables ──────────────────────────────────────

  public formatWish(entry: BirthdayEntry): string {
    const currentYear = new Date().getFullYear();
    const template = entry.customMessage && entry.customMessage.trim().length > 0
      ? entry.customMessage.trim()
      : DEFAULT_WISH_TEMPLATE;

    const firstName = entry.contactName.split(' ')[0] || entry.contactName;
    const age = entry.year ? `${currentYear - entry.year} ans` : '';

    return template
      .replace(/{name}/gi, entry.contactName)
      .replace(/{firstName}/gi, firstName)
      .replace(/{prenom}/gi, firstName)
      .replace(/{age}/gi, age)
      .replace(/{year}/gi, String(currentYear));
  }

  // ── CRUD : Ajouter / Modifier / Supprimer ────────────────────────────────────

  public addOrUpdate(
    ownerJid: string,
    contactJid: string,
    contactName: string,
    dateStr: string,
    customMessage?: string,
    sendHour = 8
  ): BirthdayEntry | null {
    const parsed = parseDateString(dateStr);
    if (!parsed) return null;

    const now = Date.now();
    const existingIndex = this.entries.findIndex(
      e => e.ownerJid === ownerJid && e.contactJid === contactJid
    );

    if (existingIndex >= 0) {
      const existing = this.entries[existingIndex];
      existing.contactName = contactName;
      existing.day = parsed.day;
      existing.month = parsed.month;
      existing.year = parsed.year;
      if (customMessage !== undefined) {
        existing.customMessage = customMessage.trim() || undefined;
      }
      existing.sendHour = sendHour;
      existing.updatedAt = now;
      this.saveEntries();
      logger.info(`[BirthdayService] Updated birthday for ${contactName} (${contactJid})`);
      return existing;
    }

    const newEntry: BirthdayEntry = {
      id: Math.random().toString(36).slice(2, 10),
      ownerJid,
      contactJid,
      contactName,
      day: parsed.day,
      month: parsed.month,
      year: parsed.year,
      customMessage: customMessage?.trim() || undefined,
      autoSendDirect: true,
      sendHour,
      createdAt: now,
      updatedAt: now,
    };

    this.entries.push(newEntry);
    this.saveEntries();
    logger.info(`[BirthdayService] Added new birthday for ${contactName} on ${parsed.day}/${parsed.month}`);
    return newEntry;
  }

  public setCustomMessage(ownerJid: string, contactJid: string, message: string): boolean {
    const entry = this.entries.find(e => e.ownerJid === ownerJid && e.contactJid === contactJid);
    if (!entry) return false;

    entry.customMessage = message.trim() || undefined;
    entry.updatedAt = Date.now();
    this.saveEntries();
    return true;
  }

  public setAutoSend(ownerJid: string, contactJid: string, enable: boolean): boolean {
    const entry = this.entries.find(e => e.ownerJid === ownerJid && e.contactJid === contactJid);
    if (!entry) return false;

    entry.autoSendDirect = enable;
    entry.updatedAt = Date.now();
    this.saveEntries();
    return true;
  }

  public setSendHour(ownerJid: string, contactJid: string, hour: number): boolean {
    const entry = this.entries.find(e => e.ownerJid === ownerJid && e.contactJid === contactJid);
    if (!entry || hour < 0 || hour > 23) return false;

    entry.sendHour = hour;
    entry.updatedAt = Date.now();
    this.saveEntries();
    return true;
  }

  public remove(ownerJid: string, contactJid: string): boolean {
    const initialLen = this.entries.length;
    this.entries = this.entries.filter(e => !(e.ownerJid === ownerJid && e.contactJid === contactJid));
    if (this.entries.length < initialLen) {
      this.saveEntries();
      return true;
    }
    return false;
  }

  public get(ownerJid: string, contactJid: string): BirthdayEntry | undefined {
    return this.entries.find(e => e.ownerJid === ownerJid && e.contactJid === contactJid);
  }

  public list(ownerJid: string): BirthdayEntry[] {
    return this.entries
      .filter(e => e.ownerJid === ownerJid)
      .sort((a, b) => (a.month !== b.month ? a.month - b.month : a.day - b.day));
  }

  // ── Requêtes de calendrier ───────────────────────────────────────────────────

  public getTodaysBirthdays(): BirthdayEntry[] {
    const now = new Date();
    const todayDay = now.getDate();
    const todayMonth = now.getMonth() + 1;
    return this.entries.filter(e => e.day === todayDay && e.month === todayMonth);
  }

  public getUpcoming(ownerJid: string, withinDays = 7): BirthdayEntry[] {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return this.entries
      .filter(e => e.ownerJid === ownerJid)
      .filter(e => {
        let nextBday = new Date(now.getFullYear(), e.month - 1, e.day).getTime();
        if (nextBday < startOfToday) {
          nextBday = new Date(now.getFullYear() + 1, e.month - 1, e.day).getTime();
        }
        const diffDays = Math.round((nextBday - startOfToday) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= withinDays;
      })
      .sort((a, b) => {
        const dateA = new Date(now.getFullYear(), a.month - 1, a.day).getTime();
        const dateB = new Date(now.getFullYear(), b.month - 1, b.day).getTime();
        return dateA - dateB;
      });
  }

  // ── Planificateur & Exécution Automatique ─────────────────────────────────────

  private startScheduler(): void {
    // Vérifier toutes les 15 minutes pour envoyer à l'heure exacte programmée
    this.checkInterval = setInterval(() => {
      this.checkAndDispatchBirthdays().catch(err => {
        logger.error({ error: err }, '[BirthdayService] Error in scheduled check');
      });
    }, 15 * 60 * 1000);

    // Première vérification après 10 secondes au démarrage
    setTimeout(() => {
      this.checkAndDispatchBirthdays().catch(() => {});
    }, 10_000);
  }

  public async checkAndDispatchBirthdays(): Promise<void> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentHour = now.getHours();

    const todays = this.getTodaysBirthdays();

    for (const entry of todays) {
      // Si déjà envoyé cette année, passer
      if (entry.lastSentYear === currentYear) continue;

      // Si l'heure programmée n'est pas encore atteinte, attendre
      if (currentHour < entry.sendHour) continue;

      logger.info(`[BirthdayService] 🎂 Birthday trigger for ${entry.contactName} (${entry.contactJid})!`);

      const message = this.formatWish(entry);

      // Marquer comme envoyé immédiatement pour éviter les envois en double
      entry.lastSentYear = currentYear;
      entry.updatedAt = Date.now();
      this.saveEntries();

      if (this.dispatchHandler) {
        try {
          await this.dispatchHandler(entry, message);
          logger.info(`[BirthdayService] Successfully dispatched birthday wish for ${entry.contactName}`);
        } catch (err: any) {
          logger.error({ error: err.message || err }, `[BirthdayService] Failed to dispatch birthday wish for ${entry.contactName}`);
        }
      }
    }
  }

  /**
   * Forcer l'envoi immédiat d'un test
   */
  public async testDispatch(ownerJid: string, contactJid: string): Promise<{ success: boolean; message: string; error?: string }> {
    const entry = this.get(ownerJid, contactJid);
    if (!entry) {
      return { success: false, message: '', error: 'Anniversaire non trouvé pour ce contact.' };
    }

    const formatted = this.formatWish(entry);
    if (this.dispatchHandler) {
      try {
        await this.dispatchHandler(entry, formatted);
        return { success: true, message: formatted };
      } catch (err: any) {
        return { success: false, message: formatted, error: err.message };
      }
    }

    return { success: false, message: formatted, error: 'Gestionnaire d\'envoi non initialisé.' };
  }
}

export default BirthdayService.getInstance();
