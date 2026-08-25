import logger from '../../core/logger/logger.js';
import prisma from '../../core/db/prisma.js';

export type AutoReplyState = 'OFF' | 'ON' | 'BUSY' | 'AWAY' | 'VACATION' | 'SCHEDULED' | 'PAUSED';

export interface ScheduleConfig {
  days: string[];  // ['monday', 'tuesday', ...]
  startTime: string; // 'HH:MM'
  endTime: string;   // 'HH:MM'
  rawString: string;
}

const DAY_NAMES: Record<string, number> = {
  sunday: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6
};

export class AutoReplyConfig {
  private static instance: AutoReplyConfig;

  // ── Machine à états ───────────────────────────────────────────────────
  public state: AutoReplyState = 'OFF';
  private _previousState: AutoReplyState = 'OFF';  // ✅ Sauvegarde le dernier état avant PAUSED

  // ── Paramètres ────────────────────────────────────────────────────────
  public cooldownHours: number = 6;
  public maxPerHour: number = 20;
  private hourlyCount: number = 0;
  private hourlyWindowStart: number = Date.now();
  public minDelaySeconds: number = 5;
  public maxDelaySeconds: number = 20;
  public humanActiveWindowMinutes: number = 15;
  public vacationUntil: Date | null = null;
  public schedule: ScheduleConfig | null = null;
  public groupsEnabled: boolean = false;
  private prismaAvailable: boolean = true;  // ✅ Track Prisma availability

  public urgentKeywords: Set<string> = new Set([
    'urgent', 'urgence', 'serveur', 'paiement', 'deadline',
    'bloquant', 'sos', 'problème critique', 'appelle-moi', 'appel moi',
    'appelle moi', 'help', 'au secours'
  ]);

  public ignoredGroups: Set<string> = new Set();

  public trivialPatterns: RegExp[] = [
    /^(ok|okay|ок|d'acc(ord)?|dac|👍|🙏|😂|😅|🤣|👌|haha|mdr|lol|rires?|xd|✅|🔥|❤️|😍|🥰|😘|😊|😁|yep|ouais|oui|non|no|yes|nope|tkt|np|ça va|ca va|bien|bien reçu|reçu|compris|noted)$/i
  ];

  private constructor() {}

  public static getInstance(): AutoReplyConfig {
    if (!AutoReplyConfig.instance) {
      AutoReplyConfig.instance = new AutoReplyConfig();
    }
    return AutoReplyConfig.instance;
  }

  /**
   * Loads configuration from database
   * ✅ GESTION ROBUSTE SANS PRISMA
   */
  public async load(): Promise<void> {
    if (!this.prismaAvailable || !prisma) {
      logger.warn('[AutoReplyConfig] Prisma not available, using in-memory only');
      return;
    }

    try {
      const dbConfig = await prisma.autoReplyConfig.findUnique({
        where: { id: 'default' }
      }).catch((err: any) => {
        if (err.code === 'P2012' || err.message?.includes('autoReplyConfig')) {
          logger.debug('[AutoReplyConfig] Model not in Prisma schema, using in-memory only');
          this.prismaAvailable = false;
          return null;
        }
        throw err;
      });

      if (dbConfig) {
        this.state = dbConfig.state as AutoReplyState;
        this._previousState = this.state;
        this.cooldownHours = dbConfig.cooldownHours;
        this.maxPerHour = dbConfig.maxPerHour;
        this.minDelaySeconds = dbConfig.minDelaySeconds;
        this.maxDelaySeconds = dbConfig.maxDelaySeconds;
        this.humanActiveWindowMinutes = dbConfig.humanActiveWindowMin;
        this.vacationUntil = dbConfig.vacationUntil;
        this.groupsEnabled = dbConfig.groupsEnabled;
        this.urgentKeywords = new Set(dbConfig.urgentKeywords);

        if (dbConfig.scheduleStart && dbConfig.scheduleEnd) {
          this.schedule = {
            days: dbConfig.scheduleDays,
            startTime: dbConfig.scheduleStart,
            endTime: dbConfig.scheduleEnd,
            rawString: `${dbConfig.scheduleDays.join(',')} ${dbConfig.scheduleStart}-${dbConfig.scheduleEnd}`
          };
        }

        // Load ignored groups
        try {
          const ignored = await prisma.group.findMany({
            where: { isAutoReplyIgnored: true },
            select: { id: true }
          });
          this.ignoredGroups = new Set(ignored.map(g => g.id));
        } catch (err: any) {
          if (!err.message?.includes('group')) throw err;
          logger.debug('[AutoReplyConfig] Group model not available');
        }

        logger.info(`[AutoReplyConfig] Configuration loaded (state: ${this.state}, ignored groups: ${this.ignoredGroups.size})`);
      } else {
        // Initialize default row if not exists
        await this.save();
        logger.info('[AutoReplyConfig] Default configuration initialized in database.');
      }
    } catch (error: any) {
      logger.warn({ error: error.message }, '[AutoReplyConfig] Failed to load from database, using in-memory only');
      this.prismaAvailable = false;
    }
  }

  /**
   * Persists current configuration to database
   * ✅ SILENCIEUX SI PRISMA N'EST PAS DISPO
   */
  public async save(): Promise<void> {
    if (!this.prismaAvailable || !prisma) return;

    try {
      await prisma.autoReplyConfig.upsert({
        where: { id: 'default' },
        update: {
          state: this.state,
          cooldownHours: this.cooldownHours,
          maxPerHour: this.maxPerHour,
          minDelaySeconds: this.minDelaySeconds,
          maxDelaySeconds: this.maxDelaySeconds,
          humanActiveWindowMin: this.humanActiveWindowMinutes,
          vacationUntil: this.vacationUntil,
          urgentKeywords: Array.from(this.urgentKeywords),
          groupsEnabled: this.groupsEnabled,
          scheduleDays: this.schedule?.days || [],
          scheduleStart: this.schedule?.startTime || null,
          scheduleEnd: this.schedule?.endTime || null
        },
        create: {
          id: 'default',
          state: this.state,
          cooldownHours: this.cooldownHours,
          maxPerHour: this.maxPerHour,
          minDelaySeconds: this.minDelaySeconds,
          maxDelaySeconds: this.maxDelaySeconds,
          humanActiveWindowMin: this.humanActiveWindowMinutes,
          vacationUntil: this.vacationUntil,
          urgentKeywords: Array.from(this.urgentKeywords),
          groupsEnabled: this.groupsEnabled
        }
      }).catch((err: any) => {
        if (err.code === 'P2012' || err.message?.includes('autoReplyConfig')) {
          this.prismaAvailable = false;
          logger.debug('[AutoReplyConfig] Model not available, continuing with in-memory');
          return;
        }
        throw err;
      });
    } catch (error: any) {
      logger.debug({ error: error.message }, '[AutoReplyConfig] Save failed, using in-memory');
      this.prismaAvailable = false;
    }
  }

  public async setState(newState: AutoReplyState): Promise<void> {
    const old = this.state;

    // ✅ SI ON SORT DE PAUSED, ON NE CHANGE PAS LE PREVIOUSSTATE
    if (old !== 'PAUSED') {
      this._previousState = old;
    }

    this.state = newState;
    await this.save();
    logger.info(`[AutoReplyConfig] State changed: ${old} → ${newState}`);
  }

  public async pause(): Promise<void> {
    if (this.state !== 'PAUSED') {
      this._previousState = this.state;  // ✅ SAUVEGARDER L'ÉTAT ACTUEL
      this.state = 'PAUSED';
      await this.save();
      logger.info(`[AutoReplyConfig] Paused (will resume to: ${this._previousState})`);
    }
  }

  public async resume(): Promise<void> {
    if (this.state === 'PAUSED') {
      this.state = this._previousState;  // ✅ RESTAURER L'ÉTAT PRÉCÉDENT
      await this.save();
      logger.info(`[AutoReplyConfig] Resumed → ${this.state}`);
    }
  }

  public isActive(): boolean {
    if (this.state === 'OFF' || this.state === 'PAUSED') return false;
    if (this.state === 'VACATION') {
      if (this.vacationUntil && Date.now() > this.vacationUntil.getTime()) {
        this.state = 'OFF';
        this.vacationUntil = null;
        this.save().catch(() => {});
        return false;
      }
      return true;
    }
    if (this.state === 'SCHEDULED') {
      return this.isInScheduleWindow();
    }
    return true;
  }

  public async setSchedule(scheduleStr: string): Promise<boolean> {
    const parts = scheduleStr.trim().split(' ');
    let daysPart: string | null = null;
    let timePart: string;

    if (parts.length === 2) {
      daysPart = parts[0];
      timePart = parts[1];
    } else {
      timePart = parts[0];
    }

    const timeSplit = timePart.split('-');
    if (timeSplit.length !== 2) return false;

    const [startH, startM] = timeSplit[0].split(':').map(Number);
    const [endH, endM] = timeSplit[1].split(':').map(Number);

    if ([startH, startM, endH, endM].some(n => isNaN(n))) return false;

    let days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (daysPart) {
      const range = daysPart.toLowerCase().split('-');
      if (range.length === 2) {
        const start = DAY_NAMES[range[0]];
        const end = DAY_NAMES[range[1]];
        if (start !== undefined && end !== undefined) {
          days = Object.keys(DAY_NAMES).filter(d => {
            const n = DAY_NAMES[d];
            return n >= start && n <= end;
          });
        }
      }
    }

    this.schedule = {
      days,
      startTime: `${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}`,
      endTime: `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`,
      rawString: scheduleStr
    };

    await this.save();
    return true;
  }

  public async clearSchedule(): Promise<void> {
    this.schedule = null;
    await this.save();
  }

  public isInScheduleWindow(): boolean {
    if (!this.schedule) return true;
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    if (!this.schedule.days.includes(dayName)) return false;

    const currentMin = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = this.schedule.startTime.split(':').map(Number);
    const [eh, em] = this.schedule.endTime.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    if (startMin <= endMin) {
      return currentMin >= startMin && currentMin <= endMin;
    } else {
      return currentMin >= startMin || currentMin <= endMin;
    }
  }

  public async setVacationUntil(dateStr: string): Promise<boolean> {
    const durationMatch = dateStr.match(/^\+(\d+)(d|w)$/i);
    if (durationMatch) {
      const val = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();
      const ms = unit === 'w' ? val * 7 * 86400 * 1000 : val * 86400 * 1000;
      this.vacationUntil = new Date(Date.now() + ms);
      await this.save();
      return true;
    }

    const dmyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmyMatch) {
      const d = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
      if (!isNaN(d.getTime())) {
        this.vacationUntil = d;
        await this.save();
        return true;
      }
    }

    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
      this.vacationUntil = isoDate;
      await this.save();
      return true;
    }
    return false;
  }

  public checkAndIncrementRateLimit(): boolean {
    const now = Date.now();
    if (now - this.hourlyWindowStart > 3600_000) {
      this.hourlyWindowStart = now;
      this.hourlyCount = 0;
    }
    if (this.hourlyCount >= this.maxPerHour) return false;
    this.hourlyCount++;
    return true;
  }

  public getHourlyCount(): number {
    return this.hourlyCount;
  }

  public isTrivialMessage(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.split(/\s+/).length <= 1) return true;
    for (const pattern of this.trivialPatterns) {
      if (pattern.test(trimmed)) return true;
    }
    return false;
  }

  public checkUrgency(text: string): { isUrgent: boolean; keyword?: string } {
    const lower = text.toLowerCase();
    for (const kw of this.urgentKeywords) {
      if (lower.includes(kw)) return { isUrgent: true, keyword: kw };
    }
    return { isUrgent: false };
  }

  public async ignoreGroup(jid: string): Promise<void> {
    this.ignoredGroups.add(jid);

    if (!this.prismaAvailable || !prisma) return;

    try {
      await prisma.group.upsert({
        where: { id: jid },
        update: { isAutoReplyIgnored: true },
        create: { id: jid, name: 'Unknown Group', isAutoReplyIgnored: true }
      }).catch((err: any) => {
        if (err.code === 'P2012' || err.message?.includes('group')) {
          this.prismaAvailable = false;
          return;
        }
        throw err;
      });
    } catch (error: any) {
      logger.debug({ error: error.message, jid }, '[AutoReplyConfig] Failed to persist ignored group');
      this.prismaAvailable = false;
    }
  }

  public async unignoreGroup(jid: string): Promise<void> {
    this.ignoredGroups.delete(jid);

    if (!this.prismaAvailable || !prisma) return;

    try {
      await prisma.group.updateMany({
        where: { id: jid },
        data: { isAutoReplyIgnored: false }
      }).catch((err: any) => {
        if (err.code === 'P2012' || err.message?.includes('group')) {
          this.prismaAvailable = false;
          return;
        }
        throw err;
      });
    } catch (error: any) {
      logger.debug({ error: error.message, jid }, '[AutoReplyConfig] Failed to remove ignored group');
      this.prismaAvailable = false;
    }
  }

  public isGroupIgnored(jid: string): boolean {
    return this.ignoredGroups.has(jid);
  }

  public isBotMessage(text: string): boolean {
    const botPatterns = [
      /^(🤖|BOT|AUTO-?REPLY|AUTOREPLY|AUTOMATIC|MESSAGE AUTOMATIQUE)/i,
      /tapez\s+!?(help|aide|start)/i,
      /^(NOTICE|ALERT|NOTIFICATION|SYSTEM):/i
    ];
    return botPatterns.some(p => p.test(text.trim()));
  }
}

export class AutoReplyConfigFactory {
    public static getInstance(): AutoReplyConfig {
        return AutoReplyConfig.getInstance();
    }
}

export default AutoReplyConfig.getInstance();
