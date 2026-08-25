import aiService, { AIService } from './ai-service.js';
import chatHistoryService, { StoredChatMessage } from '../chat/chat-history-service.js';
import logger from '../../core/logger/logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedSubject {
  title: string;
  percentage: number;
}

export interface ExtractedDecision {
  id: number;
  text: string;
  confidence: number;
  sourceMsgId?: string;
}

export interface ExtractedTask {
  id: number;
  task: string;
  assignee: string;
  deadline: string;
  status: 'pending' | 'done' | 'unknown';
  sourceMsgId?: string;
}

export interface ExtractedDeadline {
  id: number;
  event: string;
  time: string;
  sourceMsgId?: string;
}

export interface ExtractedQuestion {
  id: number;
  question: string;
  askedBy: string;
  sourceMsgId?: string;
}

export interface ExtractedLink {
  url: string;
  context: string;
}

export interface ConversationAnalysis {
  narrativeSummary?: string;
  subjects: ExtractedSubject[];
  decisions: ExtractedDecision[];
  tasks: ExtractedTask[];
  deadlines: ExtractedDeadline[];
  questions: {
    unanswered: ExtractedQuestion[];
    answered: { question: string; answer: string; answeredBy: string }[];
  };
  importantLinks: ExtractedLink[];
  mediaHighlights: string[];
  attentionPoints: string[];
  participantCount: number;
  messageCount: number;
  periodStart?: string;
  periodEnd?: string;
}

export type SummaryMode = 'short' | 'normal' | 'detailed' | 'full';
export type SummaryStyle = 'professional' | 'casual' | 'bullet' | 'report';

export interface SummarizeOptions {
  mode?: SummaryMode;
  style?: SummaryStyle;
  language?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
  senderFilter?: string;
  topicFilter?: string;
  excludeBots?: boolean;
}

// ── Context Cache: per-chat in-memory store of the last analysis result ─────
interface AnalysisCache {
  analysis: ConversationAnalysis;
  messages: StoredChatMessage[];
  generatedAt: number;
}

const analysisCache: Map<string, AnalysisCache> = new Map();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache validity

// ── Chunk size: max messages per LLM call (to avoid token overflows) ─────────
const CHUNK_SIZE = 80;

// ── Main Service ─────────────────────────────────────────────────────────────

export class ConversationIntelligenceService {
  private static instance: ConversationIntelligenceService;

  private constructor() {}

  public static getInstance(): ConversationIntelligenceService {
    if (!ConversationIntelligenceService.instance) {
      ConversationIntelligenceService.instance = new ConversationIntelligenceService();
    }
    return ConversationIntelligenceService.instance;
  }

  // ── 1. Get & Filter messages (Async DB-backed) ───────────────────────────
  private async getMessages(chatJid: string, opts: SummarizeOptions): Promise<StoredChatMessage[]> {
    let messages: StoredChatMessage[];

    if (opts.fromTimestamp) {
      messages = await chatHistoryService.getMessagesInTimeRangeAsync(chatJid, opts.fromTimestamp, opts.toTimestamp);
    } else if (opts.senderFilter) {
      await chatHistoryService.getRecentMessagesAsync(chatJid, 200);
      messages = chatHistoryService.getMessagesBySender(chatJid, opts.senderFilter);
    } else if (opts.topicFilter) {
      await chatHistoryService.getRecentMessagesAsync(chatJid, 200);
      messages = chatHistoryService.getMessagesByTopic(chatJid, opts.topicFilter);
    } else {
      messages = await chatHistoryService.getRecentMessagesAsync(chatJid, 200);
    }

    return messages;
  }

  // ── 2. Format messages for LLM ──────────────────────────────────────────
  private formatForLLM(messages: StoredChatMessage[]): string {
    return messages.map(m => {
      const t = new Date(m.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const media = m.isMedia ? ` [📎 ${m.mediaType || 'média'}]` : '';
      return `[${t}] (${m.id}) ${m.senderName}: ${m.text}${media}`;
    }).join('\n');
  }

  // ── 3. Hierarchical chunking for very long conversations ─────────────────
  private async summarizeChunked(messages: StoredChatMessage[]): Promise<string> {
    if (messages.length <= CHUNK_SIZE) {
      return this.formatForLLM(messages);
    }

    const chunks: StoredChatMessage[][] = [];
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      chunks.push(messages.slice(i, i + CHUNK_SIZE));
    }

    const chunkSummaries: string[] = [];
    for (const chunk of chunks) {
      const chunkText = this.formatForLLM(chunk);
      const prompt =
        `Extrais les faits et discussions clés de cette portion de conversation WhatsApp en 4-6 points structurés. ` +
        `Mentionne qui a exprimé quelle idée importante. Ne rien inventer.\n\n${chunkText}`;
      try {
        const partial = await aiService.generateText(prompt);
        chunkSummaries.push(AIService.cleanAiOutput(partial));
      } catch {
        chunkSummaries.push(chunkText.split('\n').slice(-10).join('\n'));
      }
    }
    return chunkSummaries.join('\n\n--- Segment suivant ---\n\n');
  }

  // ── 4. Central extraction: returns structured JSON with narrative summary ─
  private async extract(chatJid: string, opts: SummarizeOptions): Promise<{ analysis: ConversationAnalysis; messages: StoredChatMessage[] }> {
    // Check cache first
    const cached = analysisCache.get(chatJid);
    if (cached && !opts.fromTimestamp && !opts.senderFilter && !opts.topicFilter) {
      if (Date.now() - cached.generatedAt < CACHE_TTL_MS) {
        return { analysis: cached.analysis, messages: cached.messages };
      }
    }

    const messages = await this.getMessages(chatJid, opts);
    if (messages.length === 0) return { analysis: this.emptyAnalysis(), messages: [] };

    const participants = new Set(messages.map(m => m.senderJid || m.senderName)).size;
    const startTime = new Date(messages[0].timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(messages[messages.length - 1].timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const historyText = messages.length > CHUNK_SIZE
      ? await this.summarizeChunked(messages)
      : this.formatForLLM(messages);

    const extractionPrompt =
      `Tu es un analyste expert de conversations WhatsApp.\n` +
      `Analyse les messages suivants du groupe et retourne UNIQUEMENT un objet JSON valide sans balises Markdown.\n\n` +
      `INSTRUCTIONS D'ANALYSE :\n` +
      `1. "narrativeSummary" : Rédige une synthèse narrative vivante, claire et fidèle (2 à 4 paragraphes courts ou points structurés) expliquant l'essentiel des échanges : les discussions en cours, les avis partagés, les anecdotes, le fil conducteur du groupe.\n` +
      `2. "subjects" : Liste les 2 à 5 sujets majeurs abordés avec une estimation en pourcentage (ex: 40%).\n` +
      `3. "decisions" : Décisions claires ou accords trouvés (laisser [] si aucune décision explicite).\n` +
      `4. "tasks" : Tâches ou actions convenues avec responsable et échéance si mentionnés (laisser [] si aucune).\n` +
      `5. "deadlines" : Événements avec date/heure (laisser [] si aucune).\n` +
      `6. "questions" : Questions posées restées sans réponse ou questions importantes répondues.\n` +
      `7. "attentionPoints" : Alertes, points de vigilance ou tensions (laisser [] si rien de particulier).\n\n` +
      `FORMAT JSON ATTENDU :\n` +
      `{\n` +
      `  "narrativeSummary": "...",\n` +
      `  "subjects": [{"title": "...", "percentage": 50}],\n` +
      `  "decisions": [{"id": 1, "text": "...", "confidence": 0.95}],\n` +
      `  "tasks": [{"id": 1, "task": "...", "assignee": "...", "deadline": "...", "status": "pending"}],\n` +
      `  "deadlines": [{"id": 1, "event": "...", "time": "..."}],\n` +
      `  "questions": {\n` +
      `    "unanswered": [{"id": 1, "question": "...", "askedBy": "..."}],\n` +
      `    "answered": [{"question": "...", "answer": "...", "answeredBy": "..."}]\n` +
      `  },\n` +
      `  "importantLinks": [{"url": "...", "context": "..."}],\n` +
      `  "mediaHighlights": ["..."],\n` +
      `  "attentionPoints": ["..."]\n` +
      `}\n\n` +
      `Messages de la conversation :\n${historyText}`;

    try {
      const raw = await aiService.generateText(extractionPrompt, "Tu es un extracteur JSON pur. Réponds uniquement avec l'objet JSON.");
      const cleaned = AIService.cleanAiOutput(raw);

      // Extract JSON from response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      let data: any = {};
      if (jsonMatch) {
        try {
          data = JSON.parse(jsonMatch[0]);
        } catch {
          data = {};
        }
      }

      let narrative = data.narrativeSummary;
      if (!narrative || narrative.trim().length < 20) {
        // Fallback: direct narrative summary
        const narrativePrompt =
          `Voici les messages récents d'un groupe WhatsApp :\n\n${historyText}\n\n` +
          `Fais un résumé clair, vivant et structuré en français de tout ce qui a été dit. Explique qui a parlé de quoi et les points essentiels.`;
        const directText = await aiService.generateText(narrativePrompt);
        narrative = AIService.cleanAiOutput(directText);
      }

      const analysis: ConversationAnalysis = {
        narrativeSummary: narrative,
        subjects: data.subjects || [],
        decisions: data.decisions || [],
        tasks: data.tasks || [],
        deadlines: data.deadlines || [],
        questions: {
          unanswered: data.questions?.unanswered || [],
          answered: data.questions?.answered || []
        },
        importantLinks: data.importantLinks || [],
        mediaHighlights: data.mediaHighlights || [],
        attentionPoints: data.attentionPoints || [],
        participantCount: participants,
        messageCount: messages.length,
        periodStart: startTime,
        periodEnd: endTime
      };

      // Cache for future calls
      if (!opts.fromTimestamp && !opts.senderFilter && !opts.topicFilter) {
        analysisCache.set(chatJid, { analysis, messages, generatedAt: Date.now() });
      }

      return { analysis, messages };
    } catch (err: any) {
      logger.error({ error: err.message }, '[ConversationIntel] Extraction failed, attempting fallback');

      // Robust fallback if LLM extraction threw
      let fallbackNarrative = '';
      try {
        const fallbackPrompt =
          `Voici une conversation WhatsApp de groupe :\n\n${historyText}\n\n` +
          `Fais un résumé complet et fidèle des échanges du groupe en français avec des tirets ou paragraphes clairs.`;
        fallbackNarrative = AIService.cleanAiOutput(await aiService.generateText(fallbackPrompt));
      } catch {
        fallbackNarrative = 'Discussion de groupe portant sur plusieurs sujets récents.';
      }

      const fallbackAnalysis: ConversationAnalysis = {
        narrativeSummary: fallbackNarrative,
        subjects: [],
        decisions: [],
        tasks: [],
        deadlines: [],
        questions: { unanswered: [], answered: [] },
        importantLinks: [],
        mediaHighlights: [],
        attentionPoints: [],
        participantCount: participants,
        messageCount: messages.length,
        periodStart: startTime,
        periodEnd: endTime
      };

      return { analysis: fallbackAnalysis, messages };
    }
  }

  private emptyAnalysis(participants = 0, msgCount = 0, start?: string, end?: string): ConversationAnalysis {
    return {
      narrativeSummary: undefined,
      subjects: [], decisions: [], tasks: [], deadlines: [],
      questions: { unanswered: [], answered: [] },
      importantLinks: [], mediaHighlights: [], attentionPoints: [],
      participantCount: participants, messageCount: msgCount,
      periodStart: start, periodEnd: end
    };
  }

  // ── 5. Public: Full Group Summary ─────────────────────────────────────────
  public async summarize(chatJid: string, opts: SummarizeOptions = {}): Promise<string> {
    const { analysis, messages } = await this.extract(chatJid, opts);
    const mode = opts.mode || 'normal';
    const p = analysis;

    if (messages.length === 0) {
      return (
        '⚠️ *Aucun message disponible dans l\'historique.*\n\n' +
        'Le bot n\'a pas encore enregistré de messages pour ce chat ou cette période.\n' +
        'Envoyez quelques messages dans le groupe, puis relancez `.groupsummary` !'
      );
    }

    let out = `╭━━━〔 📊 RÉSUMÉ DU GROUPE 〕━━━╮\n`;
    if (p.periodStart && p.periodEnd) out += `┃ 📅 Période : ${p.periodStart} → ${p.periodEnd}\n`;
    out += `┃ 💬 ${p.messageCount} messages analysés · ${p.participantCount} participant(s)\n`;
    out += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;

    // NARRATIVE SUMMARY (ALWAYS DISPLAYED)
    if (p.narrativeSummary) {
      out += `📝 *SYNTHÈSE DES DISCUSSIONS :*\n${p.narrativeSummary}\n\n`;
    }

    // SUBJECTS
    if (p.subjects.length > 0) {
      out += `━━━━━━━━━━━━━━━━\n🧠 *SUJETS PRINCIPAUX*\n`;
      p.subjects.forEach((s, i) => {
        out += `${i + 1}️⃣ ${s.title} — ${s.percentage}%\n`;
      });
      out += '\n';
    }

    // DECISIONS
    if (p.decisions.length > 0) {
      out += `━━━━━━━━━━━━━━━━\n✅ *DÉCISIONS ACTÉES*\n`;
      p.decisions.forEach(d => {
        out += `• ${d.text}\n`;
      });
      out += '\n';
    }

    if (mode === 'short') {
      return out + `_💡 Tapez \`.groupsummary detailed\` pour le rapport complet._`;
    }

    // TASKS
    if (p.tasks.length > 0) {
      out += `━━━━━━━━━━━━━━━━\n📋 *ACTIONS & TÂCHES*\n`;
      p.tasks.forEach(t => {
        const icon = t.status === 'done' ? '🟢' : '🟡';
        const deadline = t.deadline && t.deadline !== 'Non défini' ? ` (${t.deadline})` : '';
        out += `${icon} *${t.assignee}* → ${t.task}${deadline}\n`;
      });
      out += '\n';
    }

    // DEADLINES
    if (p.deadlines.length > 0) {
      out += `━━━━━━━━━━━━━━━━\n⏰ *ÉCHÉANCES & DATES*\n`;
      p.deadlines.forEach(d => {
        out += `• *${d.time}* → ${d.event}\n`;
      });
      out += '\n';
    }

    // QUESTIONS
    if (p.questions.unanswered.length > 0) {
      out += `━━━━━━━━━━━━━━━━\n❓ *QUESTIONS EN SUSPENS*\n`;
      p.questions.unanswered.forEach(q => {
        out += `• ${q.question}${q.askedBy && q.askedBy !== 'Non défini' ? ` _(par ${q.askedBy})_` : ''}\n`;
      });
      out += '\n';
    }

    if (p.questions.answered.length > 0 && mode === 'full') {
      out += `━━━━━━━━━━━━━━━━\n✅ *QUESTIONS RÉPONDUES*\n`;
      p.questions.answered.forEach(q => {
        out += `• ${q.question} → *${q.answer}*\n`;
      });
      out += '\n';
    }

    // LINKS
    if (p.importantLinks.length > 0) {
      out += `━━━━━━━━━━━━━━━━\n🔗 *LIENS PARTAGÉS*\n`;
      p.importantLinks.forEach(l => {
        out += `• ${l.url} _(${l.context})_\n`;
      });
      out += '\n';
    }

    // ATTENTION
    if (p.attentionPoints.length > 0) {
      out += `━━━━━━━━━━━━━━━━\n⚠️ *POINTS D'ATTENTION*\n`;
      p.attentionPoints.forEach(a => { out += `• ${a}\n`; });
      out += '\n';
    }

    return out.trim();
  }

  // ── 6. Decisions Only ───────────────────────────────────────────────────
  public async getDecisions(chatJid: string, opts: SummarizeOptions = {}): Promise<string> {
    const { analysis } = await this.extract(chatJid, opts);
    if (analysis.decisions.length === 0) return '✅ Aucune décision formelle identifiée dans les messages récents.';
    let out = `╭━━━〔 ✅ DÉCISIONS 〕━━━╮\n`;
    analysis.decisions.forEach(d => {
      out += `┃ ${d.id}. ${d.text}\n`;
    });
    out += `╰━━━━━━━━━━━━━━━━━━━━━━╯`;
    return out;
  }

  // ── 7. Tasks Only ───────────────────────────────────────────────────────
  public async getTasks(chatJid: string, opts: SummarizeOptions = {}): Promise<string> {
    const { analysis } = await this.extract(chatJid, opts);
    if (analysis.tasks.length === 0) return '📋 Aucune tâche identifiée dans les messages récents.';
    let out = `╭━━━〔 📋 TÂCHES 〕━━━╮\n`;
    analysis.tasks.forEach(t => {
      const icon = t.status === 'done' ? '🟢' : '🟡';
      out += `┃ ${icon} *${t.assignee}*\n`;
      out += `┃   Tâche : ${t.task}\n`;
      if (t.deadline && t.deadline !== 'Non défini') out += `┃   Échéance : ${t.deadline}\n`;
      out += `┃\n`;
    });
    out += `╰━━━━━━━━━━━━━━━━━━━━━━╯`;
    return out;
  }

  // ── 8. Deadlines Only ───────────────────────────────────────────────────
  public async getDeadlines(chatJid: string, opts: SummarizeOptions = {}): Promise<string> {
    const { analysis } = await this.extract(chatJid, opts);
    if (analysis.deadlines.length === 0) return '⏰ Aucune échéance ou date détectée dans les messages récents.';
    let out = `╭━━━〔 ⏰ ÉCHÉANCES 〕━━━╮\n`;
    analysis.deadlines.forEach(d => {
      out += `┃ • *${d.time}* ➜ ${d.event}\n`;
    });
    out += `╰━━━━━━━━━━━━━━━━━━━━━━╯`;
    return out;
  }

  // ── 9. Questions Only ───────────────────────────────────────────────────
  public async getQuestions(chatJid: string, opts: SummarizeOptions = {}): Promise<string> {
    const { analysis } = await this.extract(chatJid, opts);
    const { unanswered, answered } = analysis.questions;
    if (unanswered.length === 0 && answered.length === 0) return '❓ Aucune question identifiée dans les messages récents.';

    let out = `╭━━━〔 ❓ QUESTIONS DU GROUPE 〕━━━╮\n`;
    if (unanswered.length > 0) {
      out += `┃ ⚠️ *SANS RÉPONSE :*\n`;
      unanswered.forEach(q => {
        out += `┃ • ${q.question} _(${q.askedBy})_\n`;
      });
    }
    if (answered.length > 0) {
      out += `┃\n┃ ✅ *RÉPONDUES :*\n`;
      answered.forEach(q => {
        out += `┃ • ${q.question}\n┃   ↳ *${q.answer}*\n`;
      });
    }
    out += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    return out;
  }

  // ── 10. Highlights ──────────────────────────────────────────────────────
  public async getHighlights(chatJid: string, opts: SummarizeOptions = {}): Promise<string> {
    const { analysis } = await this.extract(chatJid, opts);
    const items = [
      ...analysis.decisions.map(d => `✅ Décision : ${d.text}`),
      ...analysis.tasks.map(t => `📋 Tâche : ${t.task} (${t.assignee})`),
      ...analysis.deadlines.map(d => `⏰ Échéance : ${d.event} (${d.time})`),
      ...analysis.attentionPoints.map(a => `⚠️ Attention : ${a}`)
    ];

    if (items.length === 0) {
      return analysis.narrativeSummary || '✨ Pas de points saillants spécifiques détectés.';
    }

    let out = `╭━━━〔 ✨ FAITS SAILLANTS 〕━━━╮\n`;
    items.forEach(it => { out += `┃ • ${it}\n`; });
    out += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    return out;
  }

  // ── 11. Timeline ────────────────────────────────────────────────────────
  public async getTimeline(chatJid: string, opts: SummarizeOptions = {}): Promise<string> {
    const messages = await this.getMessages(chatJid, opts);
    if (messages.length === 0) return '📅 Aucun historique pour générer une chronologie.';

    const formatted = this.formatForLLM(messages.slice(-50));
    const prompt =
      `Génère une chronologie claire des événements et discussions principales à partir de cette conversation :\n\n${formatted}\n\n` +
      `Format : [HH:MM] Événement / discussion`;

    try {
      const result = await aiService.generateText(prompt);
      return `╭━━━〔 ⏱️ CHRONOLOGIE 〕━━━╮\n\n${AIService.cleanAiOutput(result)}\n\n╰━━━━━━━━━━━━━━━━━━━━━━━╯`;
    } catch (err: any) {
      return `❌ Erreur : ${err.message}`;
    }
  }

  // ── 12. Digest ──────────────────────────────────────────────────────────
  public async generateDigest(chatJid: string, opts: SummarizeOptions = {}): Promise<string> {
    opts.mode = 'short';
    return this.summarize(chatJid, opts);
  }

  // ── 13. Summarize by Person ─────────────────────────────────────────────
  public async summarizePerson(chatJid: string, targetJid: string, targetName: string): Promise<string> {
    await chatHistoryService.getRecentMessagesAsync(chatJid, 200);
    const messages = chatHistoryService.getMessagesBySender(chatJid, targetJid);
    if (messages.length === 0) {
      return `👤 Aucun message trouvé pour *${targetName}* dans l'historique récent de ce chat.`;
    }

    const formatted = this.formatForLLM(messages);
    const prompt =
      `Analyse les interventions de ${targetName} dans cette conversation WhatsApp :\n\n${formatted}\n\n` +
      `Résume en français :\n1. Ses sujets de discussion principaux\n2. Ses avis / propositions\n3. Ses engagements / tâches\n4. Ton général de ses messages`;

    try {
      const summary = await aiService.generateText(prompt);
      return `╭━━━〔 👤 PROFIL : ${targetName.toUpperCase()} 〕━━━╮\n\n${AIService.cleanAiOutput(summary)}\n\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    } catch (err: any) {
      return `❌ Erreur : ${err.message}`;
    }
  }

  // ── 14. Summarize by Topic ──────────────────────────────────────────────
  public async summarizeTopic(chatJid: string, keyword: string): Promise<string> {
    await chatHistoryService.getRecentMessagesAsync(chatJid, 200);
    const messages = chatHistoryService.getMessagesByTopic(chatJid, keyword);
    if (messages.length === 0) {
      return `🔍 Aucun message trouvé concernant "${keyword}" dans l'historique récent.`;
    }

    const formatted = this.formatForLLM(messages);
    const prompt =
      `Résume tout ce qui a été dit sur le sujet "${keyword}" dans cette conversation WhatsApp :\n\n${formatted}`;

    try {
      const summary = await aiService.generateText(prompt);
      return `╭━━━〔 🔍 SUJET : "${keyword.toUpperCase()}" 〕━━━╮\n\n${AIService.cleanAiOutput(summary)}\n\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    } catch (err: any) {
      return `❌ Erreur : ${err.message}`;
    }
  }

  // ── 15. Chat Stats ──────────────────────────────────────────────────────
  public async getChatStats(chatJid: string): Promise<string> {
    const messages = await chatHistoryService.getRecentMessagesAsync(chatJid, 300);
    if (messages.length === 0) return '📊 Pas assez de données pour générer des statistiques.';

    const senders = new Map<string, number>();
    let mediaCount = 0;
    messages.forEach(m => {
      senders.set(m.senderName, (senders.get(m.senderName) || 0) + 1);
      if (m.isMedia) mediaCount++;
    });

    const topSenders = Array.from(senders.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    let out = `╭━━━━〔 📊 STATISTIQUES DU CHAT 〕━━━━╮\n`;
    out += `┃ 💬 *Messages analysés :* ${messages.length}\n`;
    out += `┃ 👥 *Participants actifs :* ${senders.size}\n`;
    out += `┃ 📎 *Médias partagés :* ${mediaCount}\n`;
    out += `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n`;
    out += `┃ 🏆 *TOP PARTICIPANTS :*\n`;
    topSenders.forEach(([name, count], i) => {
      const pct = Math.round((count / messages.length) * 100);
      out += `┃ ${i + 1}. *${name}* ➜ ${count} msgs (${pct}%)\n`;
    });
    out += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
    return out;
  }

  // ── 16. Show Context / Traceability ─────────────────────────────────────
  public async showContext(chatJid: string, type: string, id: number): Promise<string> {
    const cached = analysisCache.get(chatJid);
    if (!cached) return '⚠️ Aucun contexte en cache. Lancez `.groupsummary` d\'abord.';

    if (type === 'summary') {
      return cached.analysis.narrativeSummary || 'Synthèse disponible dans le dernier résumé.';
    }

    if (type === 'decision') {
      const d = cached.analysis.decisions.find(x => x.id === id);
      if (!d) return `⚠️ Décision #${id} introuvable.`;
      const msg = d.sourceMsgId ? chatHistoryService.getMessageById(chatJid, d.sourceMsgId) : null;
      return `📌 *DÉCISION #${id} :* ${d.text}\n` + (msg ? `💬 *Message source :* [${msg.senderName}] "${msg.text}"` : '');
    }

    if (type === 'task') {
      const t = cached.analysis.tasks.find(x => x.id === id);
      if (!t) return `⚠️ Tâche #${id} introuvable.`;
      const msg = t.sourceMsgId ? chatHistoryService.getMessageById(chatJid, t.sourceMsgId) : null;
      return `📋 *TÂCHE #${id} :* ${t.task} (${t.assignee})\n` + (msg ? `💬 *Message source :* [${msg.senderName}] "${msg.text}"` : '');
    }

    return `⚠️ Type '${type}' inconnu (utilisez 'decision', 'task', 'summary').`;
  }

  public clearCache(chatJid: string): void {
    analysisCache.delete(chatJid);
  }
}

export const conversationIntelligence = ConversationIntelligenceService.getInstance();
export default conversationIntelligence;
