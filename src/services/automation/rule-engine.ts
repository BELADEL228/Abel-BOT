import { config } from '../../config/env.js';

export interface InterpolationContext {
  fullName: string;
  phone: string;
}

export class RuleEngine {
  private static instance: RuleEngine;

  public defaultMessage: string =
    "Salut {firstName} ! Je suis actuellement occupé. J'ai bien reçu ton message et je reviens vers toi au plus vite.";

  public customContacts: Map<string, string> = new Map();
  public customGroups: Map<string, string> = new Map();
  public keywords: Map<string, string> = new Map();
  
  public whitelist: Set<string> = new Set();
  public blacklist: Set<string> = new Set();

  private urgentKeywords: string[] = [
    'urgent', 'urgence', 'important', 'appelle-moi', 'appel-moi',
    'appelle moi', 'appel moi', 'deadline', 'bloquant', 'sos', 'urgence médicale'
  ];

  private constructor() {}

  public static getInstance(): RuleEngine {
    if (!RuleEngine.instance) {
      RuleEngine.instance = new RuleEngine();
    }
    return RuleEngine.instance;
  }

  // 1. Variable Interpolation
  public interpolateVariables(template: string, ctx: InterpolationContext): string {
    const parts = (ctx.fullName || '').trim().split(' ');
    const firstName = parts[0] || 'l\'ami';
    const lastName = parts.slice(1).join(' ') || '';

    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const dayStr = now.toLocaleDateString('fr-FR', { weekday: 'long' });

    return template
      .replace(/{name}/gi, ctx.fullName || ctx.phone)
      .replace(/{firstName}/gi, firstName)
      .replace(/{lastName}/gi, lastName)
      .replace(/{time}/gi, timeStr)
      .replace(/{date}/gi, dateStr)
      .replace(/{day}/gi, dayStr)
      .replace(/{botName}/gi, config.botName);
  }

  // 2. Contact Overrides
  public setContactReply(contactJid: string, text: string): void {
    this.customContacts.set(contactJid, text);
  }

  public removeContactReply(contactJid: string): boolean {
    return this.customContacts.delete(contactJid);
  }

  public getContactReply(contactJid: string): string | undefined {
    return this.customContacts.get(contactJid);
  }

  // 3. Group Overrides
  public setGroupReply(groupJid: string, text: string): void {
    this.customGroups.set(groupJid, text);
  }

  public removeGroupReply(groupJid: string): boolean {
    return this.customGroups.delete(groupJid);
  }

  public getGroupReply(groupJid: string): string | undefined {
    return this.customGroups.get(groupJid);
  }

  // 4. Keyword Matcher
  public setKeyword(keyword: string, text: string): void {
    this.keywords.set(keyword.toLowerCase().trim(), text);
  }

  public removeKeyword(keyword: string): boolean {
    return this.keywords.delete(keyword.toLowerCase().trim());
  }

  public matchKeyword(text: string): { keyword: string; reply: string } | null {
    const lower = text.toLowerCase();
    for (const [kw, reply] of this.keywords.entries()) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(lower) || lower.includes(kw)) {
        return { keyword: kw, reply };
      }
    }
    return null;
  }

  // 5. Urgency Detector
  public checkUrgency(text: string): { isUrgent: boolean; matchedKeyword?: string } {
    const lower = text.toLowerCase();
    for (const kw of this.urgentKeywords) {
      if (lower.includes(kw)) {
        return { isUrgent: true, matchedKeyword: kw };
      }
    }
    return { isUrgent: false };
  }

  // 6. Whitelist / Blacklist
  public isBlacklisted(jid: string): boolean {
    return this.blacklist.has(jid);
  }

  public isWhitelisted(jid: string): boolean {
    return this.whitelist.has(jid);
  }

  public addToBlacklist(jid: string): void { this.blacklist.add(jid); }
  public removeFromBlacklist(jid: string): boolean { return this.blacklist.delete(jid); }

  public addToWhitelist(jid: string): void { this.whitelist.add(jid); }
  public removeFromWhitelist(jid: string): boolean { return this.whitelist.delete(jid); }
}

export default RuleEngine.getInstance();
