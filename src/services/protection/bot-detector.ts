/**
 * BotDetector — Détection et neutralisation intelligente des bots WhatsApp dans les groupes.
 *
 * Stratégie : Mode Silencieux (anti-ban safe)
 *   - Les bots neutralisés sont blacklistés dans Abel-Bot (ignorés, aucune réponse)
 *   - Pas de contre-messages (évite le spam et le ban)
 *   - L'Owner peut activer/désactiver chaque bot manuellement
 *
 * Détection automatique basée sur :
 *   1. Préfixes de bots courants au début du message (!, /, #, $, ?)
 *   2. Absence de pushName (les bots n'ont généralement pas de nom affiché)
 *   3. Patterns de réponse mécaniques (réponses identiques, intervalles réguliers)
 *   4. JID de type @lid (identifiant lié non-standard, souvent utilisé par des bots)
 *   5. Contenu correspondant aux menus/réponses auto de bots connus
 */

import logger from '../../core/logger/logger.js';

export type BotStatus = 'detected' | 'neutralized' | 'whitelisted';

export interface DetectedBot {
  jid: string;
  phone: string;
  detectedAt: number;
  groupJid: string;
  status: BotStatus;
  detectionReason: string;
  messageCount: number;
  lastSeenAt: number;
}

// Common bot command prefixes
const BOT_PREFIXES = ['!', '/', '#', '$', '?', '\\', '~', '=', '>', '§', '%'];

// Patterns typical of bot responses or menus
const BOT_RESPONSE_PATTERNS = [
  /^\[Menu\]/i,
  /^(Prefix|Commandes|Commands)\s*:/i,
  /^(╔|╗|═|║|╚|╝){3,}/,
  /^(👉|📌|🔰|⭐|✅)\s*.{0,5}(menu|aide|help|commandes?)/i,
  /^(Welcome to|Bienvenue sur)\s+\w+bot/i,
  /^BOT[\s_-]?(ONLINE|READY|STARTED)/i,
  /^(Powered by|Made with)\s+/i,
  /━{5,}|─{5,}|={5,}/,        // Bot-style separators
];

class BotDetector {
  private static instance: BotDetector;

  // Registry of detected bots: jid → DetectedBot
  private registry: Map<string, DetectedBot> = new Map();

  // Message timing tracker per sender for mechanical pattern detection
  private messageTimings: Map<string, number[]> = new Map();

  private constructor() {}

  public static getInstance(): BotDetector {
    if (!BotDetector.instance) {
      BotDetector.instance = new BotDetector();
    }
    return BotDetector.instance;
  }

  /**
   * Analyzes an incoming message and checks if it originates from a bot.
   * Returns a DetectedBot record if a bot is detected, null otherwise.
   * Should be called from the message handler for every group message.
   */
  public analyzeMessage(
    senderJid: string,
    senderName: string | undefined,
    messageText: string,
    groupJid: string
  ): DetectedBot | null {
    // Already in registry
    const existing = this.registry.get(senderJid);
    if (existing) {
      existing.messageCount++;
      existing.lastSeenAt = Date.now();
      return existing;
    }

    const reasons: string[] = [];

    // 1. Check for bot-like prefixes at message start
    const trimmed = messageText.trim();
    if (BOT_PREFIXES.some(p => trimmed.startsWith(p))) {
      reasons.push(`Préfixe bot détecté : "${trimmed[0]}"`);
    }

    // 2. No pushName (bots rarely have display names)
    if (!senderName || senderName.trim() === '') {
      reasons.push('Aucun nom affiché (pushName absent)');
    }

    // 3. Bot-like response patterns in the message body
    const matchedPattern = BOT_RESPONSE_PATTERNS.find(p => p.test(trimmed));
    if (matchedPattern) {
      reasons.push('Contenu correspondant à un pattern de menu/bot');
    }

    // 4. LID-type JID (non-standard, often used by bots)
    if (senderJid.endsWith('@lid')) {
      reasons.push('JID de type @lid (identifiant non-standard)');
    }

    // 5. Mechanical timing detection: ≥4 messages within 10-second windows
    const now = Date.now();
    const timings = this.messageTimings.get(senderJid) || [];
    timings.push(now);
    // Keep only last 10 timestamps
    const recent = timings.filter(t => now - t < 10_000).slice(-10);
    this.messageTimings.set(senderJid, timings.slice(-20));

    if (recent.length >= 4) {
      reasons.push(`Rythme mécanique détecté (${recent.length} messages en <10s)`);
    }

    // Needs at least 2 distinct signals to be classified as a bot
    if (reasons.length < 2) {
      return null;
    }

    const bot: DetectedBot = {
      jid: senderJid,
      phone: senderJid.split('@')[0],
      detectedAt: now,
      groupJid,
      status: 'detected',
      detectionReason: reasons.join(' | '),
      messageCount: 1,
      lastSeenAt: now
    };

    this.registry.set(senderJid, bot);
    logger.warn(
      { jid: senderJid, groupJid, reasons },
      '[BotDetector] Bot detected in group'
    );

    return bot;
  }

  /**
   * Manually register a JID as a bot (by owner command).
   */
  public registerBot(jid: string, groupJid: string, reason = 'Signalé manuellement par le propriétaire'): DetectedBot {
    const existing = this.registry.get(jid);
    if (existing) {
      existing.status = 'neutralized';
      return existing;
    }

    const bot: DetectedBot = {
      jid,
      phone: jid.split('@')[0],
      detectedAt: Date.now(),
      groupJid,
      status: 'neutralized',
      detectionReason: reason,
      messageCount: 0,
      lastSeenAt: Date.now()
    };
    this.registry.set(jid, bot);
    return bot;
  }

  /**
   * Neutralize a bot — sets its status to 'neutralized' (silent blacklist in Abel-Bot).
   */
  public neutralize(jid: string): boolean {
    const bot = this.registry.get(jid);
    if (!bot) return false;
    bot.status = 'neutralized';
    logger.info(`[BotDetector] Bot neutralized: ${jid}`);
    return true;
  }

  /**
   * Reactivate a previously neutralized bot.
   */
  public activate(jid: string): boolean {
    const bot = this.registry.get(jid);
    if (!bot) return false;
    bot.status = 'whitelisted';
    logger.info(`[BotDetector] Bot reactivated (whitelisted): ${jid}`);
    return true;
  }

  /**
   * Remove a bot from the registry entirely.
   */
  public remove(jid: string): boolean {
    return this.registry.delete(jid);
  }

  /**
   * Returns true if this JID is a neutralized bot.
   * Use this to silently drop messages from neutralized bots.
   */
  public isNeutralized(jid: string): boolean {
    const bot = this.registry.get(jid);
    return bot?.status === 'neutralized';
  }

  /**
   * Returns all bots in a given group, or all bots if no groupJid given.
   */
  public getBots(groupJid?: string): DetectedBot[] {
    const all = Array.from(this.registry.values());
    return groupJid ? all.filter(b => b.groupJid === groupJid) : all;
  }

  /**
   * Returns a formatted status card for a given group (or all groups).
   */
  public getStatusCard(groupJid?: string): string {
    const bots = this.getBots(groupJid);
    if (bots.length === 0) {
      return '🤖 *DÉTECTEUR DE BOTS :* Aucun bot détecté dans ce groupe pour le moment.';
    }

    const statusEmoji: Record<BotStatus, string> = {
      detected: '🟡',
      neutralized: '🔴',
      whitelisted: '🟢'
    };

    let card = `🤖 *BOTS DÉTECTÉS (${bots.length}) :*\n\n`;
    bots.forEach((b, i) => {
      card += `${i + 1}. ${statusEmoji[b.status]} @${b.phone}\n`;
      card += `   ├─ *Statut :* ${b.status === 'neutralized' ? 'NEUTRALISÉ 🔴' : b.status === 'whitelisted' ? 'RÉACTIVÉ 🟢' : 'DÉTECTÉ 🟡'}\n`;
      card += `   ├─ *Raison :* ${b.detectionReason}\n`;
      card += `   ├─ *Messages :* ${b.messageCount}\n`;
      card += `   └─ *Détecté le :* ${new Date(b.detectedAt).toLocaleString('fr-FR')}\n\n`;
    });
    card += "💡 Utilisez '.neutralizebot @bot' pour neutraliser ou '.activatebot @bot' pour réactiver.";
    return card;
  }

  /**
   * Scan recent messages from ChatHistoryService to detect bots retroactively.
   * Returns number of newly detected bots.
   */
  public scanGroupHistory(
    messages: Array<{ senderJid: string; senderName: string; text: string; timestamp: number }>,
    groupJid: string
  ): DetectedBot[] {
    const newDetections: DetectedBot[] = [];

    for (const msg of messages) {
      if (this.registry.has(msg.senderJid)) continue;
      const result = this.analyzeMessage(msg.senderJid, msg.senderName, msg.text, groupJid);
      if (result) newDetections.push(result);
    }

    return newDetections;
  }
}

export default BotDetector.getInstance();
