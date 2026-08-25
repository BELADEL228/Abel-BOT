/**
 * PollService — Gestion des sondages WhatsApp dans les groupes.
 * Un sondage écoute les réponses (1, 2, 3...) et comptabilise les votes.
 * Évite les fuites de mémoire grâce à un nettoyage automatique des anciens sondages.
 */

import logger from '../../core/logger/logger.js';

export interface PollOption {
  index: number;
  text: string;
  votes: Set<string>; // JIDs who voted
}

export interface ActivePoll {
  id: string;
  groupJid: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  createdAt: number;
  endsAt?: number;
  closed: boolean;
  anonymous: boolean;
}

const MAX_ACTIVE_POLLS = 100;
const POLL_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

export class PollService {
  private static instance: PollService;
  private polls: Map<string, ActivePoll> = new Map(); // groupJid -> poll
  private cleanupTimer?: NodeJS.Timeout;

  private constructor() {
    this.startPeriodicCleanup();
  }

  public static getInstance(): PollService {
    if (!PollService.instance) PollService.instance = new PollService();
    return PollService.instance;
  }

  // ── Periodic cleanup ─────────────────────────────────────────────────────────

  private startPeriodicCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [groupJid, poll] of this.polls.entries()) {
        if (poll.closed && now - poll.createdAt > POLL_RETENTION_MS) {
          this.polls.delete(groupJid);
        }
      }
    }, 60 * 60 * 1000); // Hourly
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  public create(
    groupJid: string,
    question: string,
    options: string[],
    createdBy: string,
    durationMinutes?: number,
    anonymous = false
  ): ActivePoll {
    // Purge if limit exceeded
    if (this.polls.size >= MAX_ACTIVE_POLLS) {
      const oldestKey = this.polls.keys().next().value;
      if (oldestKey) this.polls.delete(oldestKey);
    }

    const poll: ActivePoll = {
      id: Math.random().toString(36).slice(2, 8),
      groupJid,
      question,
      options: options.map((text, i) => ({
        index: i + 1,
        text: text.trim(),
        votes: new Set()
      })),
      createdBy,
      createdAt: Date.now(),
      endsAt: durationMinutes ? Date.now() + durationMinutes * 60 * 1000 : undefined,
      closed: false,
      anonymous
    };

    this.polls.set(groupJid, poll);
    logger.info(`[PollService] Poll created in ${groupJid}: "${question}"`);

    if (durationMinutes) {
      setTimeout(() => this.close(groupJid), durationMinutes * 60 * 1000);
    }

    return poll;
  }

  // ── Vote ──────────────────────────────────────────────────────────────────────

  public vote(groupJid: string, voterJid: string, choice: number): { success: boolean; message: string } {
    const poll = this.polls.get(groupJid);
    if (!poll || poll.closed) return { success: false, message: 'Aucun sondage actif dans ce groupe.' };

    const option = poll.options.find(o => o.index === choice);
    if (!option) return { success: false, message: `Option invalide. Choisissez entre 1 et ${poll.options.length}.` };

    // Remove previous vote
    poll.options.forEach(o => o.votes.delete(voterJid));
    option.votes.add(voterJid);

    logger.debug(`[PollService] ${voterJid} voted ${choice} in ${groupJid}`);
    return { success: true, message: '' };
  }

  // ── Get results ───────────────────────────────────────────────────────────────

  public getResults(groupJid: string): ActivePoll | null {
    return this.polls.get(groupJid) || null;
  }

  public formatResults(poll: ActivePoll, showingFinal = false): string {
    const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.size, 0);
    const header = showingFinal
      ? `🏁 *RÉSULTATS FINAUX — ${poll.question}*\n`
      : `📊 *SONDAGE EN COURS — ${poll.question}*\n`;

    let out = header + `\n`;
    let winner: PollOption | null = null;

    const sorted = [...poll.options].sort((a, b) => b.votes.size - a.votes.size);

    for (const opt of poll.options) {
      const pct = totalVotes > 0 ? Math.round((opt.votes.size / totalVotes) * 100) : 0;
      const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
      const isWinner = showingFinal && sorted[0] === opt && opt.votes.size > 0;
      out += `${isWinner ? '🏆 ' : ''}*${opt.index}.* ${opt.text}\n`;
      out += `${bar} ${pct}% (${opt.votes.size} vote${opt.votes.size !== 1 ? 's' : ''})\n\n`;
      if (isWinner) winner = opt;
    }

    out += `📥 *Total :* ${totalVotes} vote${totalVotes !== 1 ? 's' : ''}`;
    if (showingFinal && winner) {
      out += `\n🥇 *Gagnant :* ${winner.text}`;
    } else if (!showingFinal) {
      out += `\n\n_Votez avec :_ *1*, *2*, *3*... pour chaque option.`;
    }

    return out;
  }

  // ── Close ─────────────────────────────────────────────────────────────────────

  public close(groupJid: string): ActivePoll | null {
    const poll = this.polls.get(groupJid);
    if (!poll || poll.closed) return null;
    poll.closed = true;
    logger.info(`[PollService] Poll closed in ${groupJid}`);
    return poll;
  }

  public hasPoll(groupJid: string): boolean {
    const poll = this.polls.get(groupJid);
    return !!(poll && !poll.closed);
  }

  public isVoteMessage(text: string, poll: ActivePoll): number {
    const t = text.trim();
    // Accept "1", "2", "Option 1", etc.
    const num = parseInt(t, 10);
    if (!isNaN(num) && num >= 1 && num <= poll.options.length) return num;
    // Also check if it matches option text
    const match = poll.options.find(o => t.toLowerCase() === o.text.toLowerCase());
    return match ? match.index : -1;
  }

  public shutdown(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
}

export default PollService.getInstance();
