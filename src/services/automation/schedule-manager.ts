import logger from '../../core/logger/logger.js';

export interface TimeSchedule {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  rawString: string;
}

export class ScheduleManager {
  private static instance: ScheduleManager;

  public activeSchedule: TimeSchedule | null = null;
  public temporaryUntilTimestamp: number | null = null;

  private constructor() {}

  public static getInstance(): ScheduleManager {
    if (!ScheduleManager.instance) {
      ScheduleManager.instance = new ScheduleManager();
    }
    return ScheduleManager.instance;
  }

  /**
   * Sets daily schedule (e.g. "18:00-08:00" or "09:00-17:00")
   */
  public setSchedule(scheduleStr: string): boolean {
    const parts = scheduleStr.split('-');
    if (parts.length !== 2) return false;

    const [startH, startM] = parts[0].split(':').map(Number);
    const [endH, endM] = parts[1].split(':').map(Number);

    if (
      isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM) ||
      startH < 0 || startH > 23 || startM < 0 || startM > 59 ||
      endH < 0 || endH > 23 || endM < 0 || endM > 59
    ) {
      return false;
    }

    this.activeSchedule = {
      startHour: startH,
      startMinute: startM,
      endHour: endH,
      endMinute: endM,
      rawString: scheduleStr
    };

    logger.info(`[ScheduleManager] Schedule set to ${scheduleStr}`);
    return true;
  }

  public clearSchedule(): void {
    this.activeSchedule = null;
  }

  /**
   * Sets temporary auto-reply until a specific timestamp (or HH:MM)
   */
  public setUntil(timeStr: string): boolean {
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      return false;
    }

    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);

    // If target time is earlier today, assume it's tomorrow
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    this.temporaryUntilTimestamp = target.getTime();
    logger.info(`[ScheduleManager] Auto-reply active until ${target.toLocaleTimeString()}`);
    return true;
  }

  /**
   * Sets temporary auto-reply for a duration (e.g. "30m", "2h", "3d")
   */
  public setForDuration(durationStr: string): boolean {
    const match = durationStr.match(/^(\d+)(s|m|h|d)$/i);
    if (!match) return false;

    const val = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    let ms = 0;
    if (unit === 's') ms = val * 1000;
    else if (unit === 'm') ms = val * 60 * 1000;
    else if (unit === 'h') ms = val * 3600 * 1000;
    else if (unit === 'd') ms = val * 86400 * 1000;

    this.temporaryUntilTimestamp = Date.now() + ms;
    return true;
  }

  public clearTemporary(): void {
    this.temporaryUntilTimestamp = null;
  }

  /**
   * Evaluates if auto-reply is currently active based on schedule or temporary timers
   */
  public isAllowedNow(): boolean {
    const now = Date.now();

    // 1. Temporary timer check (.until / .for)
    if (this.temporaryUntilTimestamp) {
      if (now <= this.temporaryUntilTimestamp) {
        return true;
      } else {
        // Expired
        this.temporaryUntilTimestamp = null;
      }
    }

    // 2. Schedule check (e.g. 18:00-08:00)
    if (!this.activeSchedule) {
      return true; // No schedule restriction
    }

    const currentDate = new Date();
    const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

    const startMinutes = this.activeSchedule.startHour * 60 + this.activeSchedule.startMinute;
    const endMinutes = this.activeSchedule.endHour * 60 + this.activeSchedule.endMinute;

    if (startMinutes <= endMinutes) {
      // Intra-day schedule (e.g. 09:00 - 18:00)
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Overnight schedule (e.g. 18:00 - 08:00)
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }
}

export default ScheduleManager.getInstance();
