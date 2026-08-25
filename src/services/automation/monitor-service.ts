/**
 * MonitorService — Surveillance de mots-clés dans les groupes WhatsApp.
 * Quand un mot surveillé apparaît dans un groupe, le propriétaire est alerté.
 */

import logger from '../../core/logger/logger.js';

export interface MonitorRule {
  keyword: string;
  groupJids: Set<string>; // empty = tous les groupes
  caseSensitive: boolean;
  addedAt: number;
  triggerCount: number;
}

export class MonitorService {
  private static instance: MonitorService;
  private rules: Map<string, MonitorRule> = new Map(); // keyword -> rule
  private alertCallback?: (groupJid: string, senderName: string, text: string, keyword: string) => void;

  private constructor() {}
  public static getInstance(): MonitorService {
    if (!MonitorService.instance) MonitorService.instance = new MonitorService();
    return MonitorService.instance;
  }

  // ── Register alert callback ───────────────────────────────────────────────────

  public onAlert(cb: (groupJid: string, senderName: string, text: string, keyword: string) => void): void {
    this.alertCallback = cb;
  }

  // ── Add/Remove rules ─────────────────────────────────────────────────────────

  public add(keyword: string, groupJid?: string, caseSensitive = false): void {
    const key = caseSensitive ? keyword : keyword.toLowerCase();
    if (this.rules.size >= 100 && !this.rules.has(key)) {
      const oldestKey = this.rules.keys().next().value;
      if (oldestKey) this.rules.delete(oldestKey);
    }
    if (!this.rules.has(key)) {
      this.rules.set(key, {
        keyword,
        groupJids: new Set(),
        caseSensitive,
        addedAt: Date.now(),
        triggerCount: 0
      });
    }
    if (groupJid) {
      this.rules.get(key)!.groupJids.add(groupJid);
    }
    logger.info(`[MonitorService] Added keyword monitor: "${keyword}"${groupJid ? ` in ${groupJid}` : ' (all groups)'}`);
  }

  public remove(keyword: string): boolean {
    const key = keyword.toLowerCase();
    return this.rules.delete(key) || this.rules.delete(keyword);
  }

  public list(): MonitorRule[] {
    return Array.from(this.rules.values());
  }

  public clear(): void {
    this.rules.clear();
  }

  // ── Check incoming message ───────────────────────────────────────────────────

  public check(chatJid: string, senderName: string, text: string): void {
    if (!chatJid.endsWith('@g.us') || !text) return;

    for (const [key, rule] of this.rules) {
      const haystack = rule.caseSensitive ? text : text.toLowerCase();
      const needle = rule.caseSensitive ? rule.keyword : key;

      // Check group filter (empty = all groups)
      const groupMatch = rule.groupJids.size === 0 || rule.groupJids.has(chatJid);
      if (!groupMatch) continue;

      if (haystack.includes(needle)) {
        rule.triggerCount++;
        logger.info(`[MonitorService] Keyword "${rule.keyword}" triggered in ${chatJid} by ${senderName}`);
        this.alertCallback?.(chatJid, senderName, text, rule.keyword);
      }
    }
  }
}

export default MonitorService.getInstance();
