/**
 * conversation.ts — CORRIGÉ v2.1
 *
 * FIXES APPLIQUÉS:
 * 1. ✅ Error handling global sur tous les appels conversationIntelligence
 * 2. ✅ Memory leak userMemories - ajout de cleanup + limit
 * 3. ✅ Extraction de mention robuste (avec validation)
 * 4. ✅ Import aiService en haut (performance)
 * 5. ✅ Alias clarifiés (context = afficher, clearcontext = effacer)
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import conversationIntelligence, { SummarizeOptions, SummaryMode } from '../../services/ai/conversation-intelligence-service.js';
import aiService from '../../services/ai/ai-service.js';
import logger from '../../core/logger/logger.js';

// Per-user memory (lightweight, in-memory) avec LIMITE pour éviter memory leak
const userMemories: Map<string, Map<string, string>> = new Map();
const MAX_USER_MEMORIES = 1000; // Max 1000 utilisateurs
const MAX_KEYS_PER_USER = 50; // Max 50 clés par utilisateur

// ── Helper: Cleanup userMemories si trop grand
function cleanupUserMemories(): void {
  if (userMemories.size > MAX_USER_MEMORIES) {
    // Supprimer les 10 plus anciens utilisateurs (rough cleanup)
    let count = 0;
    for (const [userId] of userMemories) {
      if (count >= 10) break;
      userMemories.delete(userId);
      count++;
    }
    logger.warn(`[ConversationCommand] Cleaned up userMemories (exceeded ${MAX_USER_MEMORIES} users)`);
  }
}

// ── Helper: Extraire la mention de manière robuste
function extractMentionedJid(ctx: CommandContext): string | null {
  try {
    // Essayer plusieurs chemins possibles selon la version du provider
    const mentioned =
      ctx.message.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
      (ctx.message.raw as any)?.mentionedJid?.[0] ||
      null;

    if (mentioned && typeof mentioned === 'string' && mentioned.includes('@')) {
      return mentioned;
    }
  } catch {
    // Silent fail - retourner null
  }
  return null;
}

const ConversationIntelCommand: IPluginCommand = {
  name: 'groupsummary',
  aliases: [
    'group-summary', 'groupsummarize', 'groupdigest', 'summarizechat',
    'actionitems', 'decisions', 'deadlines', 'questions',
    'highlights', 'timeline', 'chatstats', 'groupstats', 'personsummary', 'topicsummary',
    'showcontext', 'context', 'clearcontext', 'remember', 'forget', 'memory'
  ],
  category: 'AI',
  description: 'Intelligence conversationnelle avancée : résumé structuré, extraction de décisions/tâches/dates/questions, chronologie, statistiques, traçabilité des sources.',
  usage: '.groupsummary [short|normal|detailed|full] [today|24h|week] | .decisions | .tasks | .deadlines | .questions | .highlights | .timeline | .chatstats',
  cooldown: 8,
  permissions: ['canUseAI'],

  async execute(ctx: CommandContext) {
    const sub = ctx.commandName;
    const args = ctx.args;
    const chatJid = ctx.chat.id;

    // ── 1. MEMORY MANAGEMENT ─────────────────────────────────────────────────
    if (sub === 'remember') {
      const input = args.join(' ');
      const parts = input.split('=');
      if (parts.length < 2) {
        await ctx.reply('⚠️ Format requis : `.remember <clé> = <valeur>`. Exemple : `.remember anniversaire = 15 Mars`');
        return;
      }
      const key = parts[0].trim().toLowerCase();
      const val = parts.slice(1).join('=').trim();

      // Initialiser ou récupérer
      if (!userMemories.has(ctx.sender.id)) userMemories.set(ctx.sender.id, new Map());
      const userMap = userMemories.get(ctx.sender.id)!;

      // Vérifier limite de clés par utilisateur
      if (userMap.size >= MAX_KEYS_PER_USER && !userMap.has(key)) {
        await ctx.reply(`⚠️ Limite atteinte : max ${MAX_KEYS_PER_USER} clés par utilisateur. Oubliez une clé avec \`.forget <clé>\`.`);
        return;
      }

      userMap.set(key, val);
      cleanupUserMemories(); // Cleanup périodiquement

      await ctx.reply(`🧠 *MÉMORISÉ !*\n• *${key}* → ${val}`);
      return;
    }

    if (sub === 'memory') {
      const userMap = userMemories.get(ctx.sender.id);
      if (!userMap || userMap.size === 0) {
        await ctx.reply('🧠 *Votre mémoire est vide.*\nUtilisez `.remember <clé> = <valeur>` pour mémoriser.');
        return;
      }
      let out = `🧠 *MÉMOIRE ENREGISTRÉE (${userMap.size}) :*\n\n`;
      for (const [k, v] of userMap.entries()) out += `• *${k}* : ${v}\n`;
      await ctx.reply(out);
      return;
    }

    if (sub === 'forget') {
      const keyToForget = args.join(' ').toLowerCase();
      const userMap = userMemories.get(ctx.sender.id);
      if (userMap?.has(keyToForget)) {
        userMap.delete(keyToForget);
        await ctx.reply(`🗑️ \`${keyToForget}\` oublié avec succès.`);
      } else {
        await ctx.reply(`⚠️ Clé \`${keyToForget}\` introuvable dans votre mémoire.`);
      }
      return;
    }

    // ── 2. CLEAR CACHE / CONTEXT vs SHOW CONTEXT ─────────────────────────────
    if (sub === 'clearcontext') {
      conversationIntelligence.clearCache(chatJid);
      await ctx.reply('🗑️ Contexte de conversation effacé. Le prochain résumé repartira de zéro.');
      return;
    }

    if (sub === 'context') {
      // ✅ FIX: context = afficher le contexte, pas l'effacer
      try {
        const contextInfo = await conversationIntelligence.showContext(chatJid, 'summary', 0) || 'Aucun contexte disponible.';
        await ctx.reply(`📋 *CONTEXTE ACTUEL :*\n\n${contextInfo}`);
      } catch (err: any) {
        logger.error({ error: err }, '[ConversationCommand] Failed to show context');
        await ctx.reply(`❌ Erreur lors de l'affichage du contexte : ${err.message || 'Erreur inconnue'}`);
      }
      return;
    }

    // ── 3. SHOW CONTEXT (traceability) ───────────────────────────────────────
    if (sub === 'showcontext') {
      const type = args[0]?.toLowerCase();
      const id = parseInt(args[1] || '1');
      if (!type || isNaN(id)) {
        await ctx.reply('⚠️ Usage : `.showcontext <type> <id>`\nTypes : `decision`, `task`, `deadline`, `question`\nEx : `.showcontext decision 1`');
        return;
      }
      await ctx.provider.sendPresence(chatJid, 'composing');
      try {
        const result = await conversationIntelligence.showContext(chatJid, type, id);
        await ctx.reply(result);
      } catch (err: any) {
        logger.error({ error: err }, '[ConversationCommand] Failed to show context');
        await ctx.reply(`❌ Erreur : ${err.message || 'Erreur inconnue'}`);
      }
      return;
    }

    // ── 4. CHAT / GROUP STATS ────────────────────────────────────────────────
    if (sub === 'chatstats' || sub === 'groupstats') {
      await ctx.provider.sendPresence(chatJid, 'composing');
      try {
        const result = await conversationIntelligence.getChatStats(chatJid);
        await ctx.reply(result);
      } catch (err: any) {
        logger.error({ error: err }, '[ConversationCommand] Failed to get chat stats');
        await ctx.reply(`❌ Erreur : ${err.message || 'Erreur inconnue'}`);
      }
      return;
    }

    // ── 5. PERSON SUMMARY ───────────────────────────────────────────────────
    if (sub === 'personsummary') {
      // ✅ FIX: Extraction de mention robuste
      const mentioned = extractMentionedJid(ctx);
      const nameArg = args.filter(a => !a.startsWith('@')).join(' ');

      if (!mentioned && !nameArg) {
        await ctx.reply('⚠️ Usage : `.personsummary @contact` ou `.personsummary Prénom`');
        return;
      }

      const targetJid = mentioned || '';
      const targetName = nameArg || (mentioned?.split('@')[0]) || 'Inconnu';

      await ctx.provider.sendPresence(chatJid, 'composing');
      try {
        const result = await conversationIntelligence.summarizePerson(chatJid, targetJid, targetName);
        await ctx.reply(result);
      } catch (err: any) {
        logger.error({ error: err }, '[ConversationCommand] Failed to summarize person');
        await ctx.reply(`❌ Erreur : ${err.message || 'Erreur inconnue'}`);
      }
      return;
    }

    // ── 6. TOPIC SUMMARY ────────────────────────────────────────────────────
    if (sub === 'topicsummary') {
      const keyword = args.join(' ').replace(/['"]/g, '').trim();
      if (!keyword) {
        await ctx.reply('⚠️ Usage : `.topicsummary "Mot-clé"` — ex : `.topicsummary réunion`');
        return;
      }
      await ctx.provider.sendPresence(chatJid, 'composing');
      try {
        const result = await conversationIntelligence.summarizeTopic(chatJid, keyword);
        await ctx.reply(result);
      } catch (err: any) {
        logger.error({ error: err }, '[ConversationCommand] Failed to summarize topic');
        await ctx.reply(`❌ Erreur : ${err.message || 'Erreur inconnue'}`);
      }
      return;
    }

    // ── 7. EXTRACT DECISIONS ─────────────────────────────────────────────────
    if (sub === 'decisions') {
      await ctx.provider.sendPresence(chatJid, 'composing');
      try {
        const opts = buildOptions(args);
        const result = await conversationIntelligence.getDecisions(chatJid, opts);
        await ctx.reply(result);
      } catch (err: any) {
        logger.error({ error: err }, '[ConversationCommand] Failed to extract decisions');
        await ctx.reply(`❌ Erreur : ${err.message || 'Erreur inconnue'}`);
      }
      return;
    }

    // ── 8. EXTRACT TASKS / ACTION ITEMS ─────────────────────────────────────
    if (sub === 'tasks' || sub === 'actionitems') {
      await ctx.provider.sendPresence(chatJid, 'composing');
      try {
        const opts = buildOptions(args);
        const result = await conversationIntelligence.getTasks(chatJid, opts);
        await ctx.reply(result);
      } catch (err: any) {
        logger.error({ error: err }, '[ConversationCommand] Failed to extract tasks');
        await ctx.reply(`❌ Erreur : ${err.message || 'Erreur inconnue'}`);
      }
      return;
    }

    // ── 9. EXTRACT DEADLINES ─────────────────────────────────────────────────
    if (sub === 'deadlines') {
      await ctx.provider.sendPresence(chatJid, 'composing');
      try {
        const opts = buildOptions(args);
        const result = await conversationIntelligence.getDeadlines(chatJid, opts);
        await ctx.reply(result);
      } catch (err: any) {
        logger.error({ error: err }, '[ConversationCommand] Failed to extract deadlines');
        await ctx.reply(`❌ Erreur : ${err.message || 'Erreur inconnue'}`);
      }
      return;
    }

    // ── 10. EXTRACT QUESTIONS ────────────────────────────────────────────────
    if (sub === 'questions') {
      await ctx.provider.sendPresence(chatJid, 'composing');
      try {
        const opts = buildOptions(args);
        const result = await conversationIntelligence.getQuestions(chatJid, opts);
        await ctx.reply(result);
      } catch (err: any) {
        logger.error({ error: err }, '[ConversationCommand] Failed to extract questions');
        await ctx.reply(`❌ Erreur : ${err.message || 'Erreur inconnue'}`);
      }
      return;
    }

    // ── 11. HIGHLIGHTS ───────────────────────────────────────────────────────
    if (sub === 'highlights') {
      await ctx.provider.sendPresence(chatJid, 'composing');
      try {
        const opts = buildOptions(args);
        const result = await conversationIntelligence.getHighlights(chatJid, opts);
        await ctx.reply(result);
      } catch (err: any) {
        logger.error({ error: err }, '[ConversationCommand] Failed to get highlights');
        await ctx.reply(`❌ Erreur : ${err.message || 'Erreur inconnue'}`);
      }
      return;
    }

    // ── 12. TIMELINE ─────────────────────────────────────────────────────────
    if (sub === 'timeline') {
      await ctx.provider.sendPresence(chatJid, 'composing');
      try {
        const opts = buildOptions(args);
        const result = await conversationIntelligence.getTimeline(chatJid, opts);
        await ctx.reply(result);
      } catch (err: any) {
        logger.error({ error: err }, '[ConversationCommand] Failed to get timeline');
        await ctx.reply(`❌ Erreur : ${err.message || 'Erreur inconnue'}`);
      }
      return;
    }

    // ── 13. DIGEST ───────────────────────────────────────────────────────────
    if (sub === 'groupdigest' || sub === 'digest') {
      await ctx.provider.sendPresence(chatJid, 'composing');
      try {
        const opts = buildOptions(args);
        const result = await conversationIntelligence.generateDigest(chatJid, opts);
        await ctx.reply(result);
      } catch (err: any) {
        logger.error({ error: err }, '[ConversationCommand] Failed to generate digest');
        await ctx.reply(`❌ Erreur : ${err.message || 'Erreur inconnue'}`);
      }
      return;
    }

    // ── 14. DEFAULT: GROUP SUMMARY / SUMMARY / BRIEF / EXTRACT ──────────────
    // (.groupsummary, .group-summary, .summarizechat, .summary, .summarize, .brief, .extract)
    await ctx.provider.sendPresence(chatJid, 'composing');
    const opts = buildOptions(args);

    // Allow quoted text to be summarized directly
    // ✅ FIX: Vérifier que ctx.message existe
    const quotedText = ctx.message?.quotedMessage?.text;
    if (quotedText && ['summary', 'summarize', 'brief', 'extract'].includes(sub)) {
      try {
        const prompt =
          `Résume ce texte de façon claire et concise en français. ` +
          `Conserve les informations clés. AUCUNE invention.\n\n${quotedText}`;
        // ✅ FIX: aiService déjà importé en haut
        const raw = await aiService.generateText(prompt);
        await ctx.reply(`📝 *RÉSUMÉ :*\n\n${raw}`);
        return;
      } catch (err: any) {
        logger.error({ error: err }, '[ConversationCommand] Failed to summarize quoted message');
        await ctx.reply(`❌ Erreur lors du résumé : ${err.message || 'Erreur inconnue'}`);
        return;
      }
    }

    // ✅ FIX: Try-catch global sur conversationIntelligence.summarize()
    try {
      const result = await conversationIntelligence.summarize(chatJid, opts);
      await ctx.reply(result);
    } catch (err: any) {
      logger.error({ error: err }, '[ConversationCommand] Failed to summarize conversation');
      await ctx.reply(`❌ Erreur lors du résumé : ${err.message || 'Erreur inconnue'}`);
    }
  }
};

// ── Helper: parse CLI args into SummarizeOptions ─────────────────────────────
function buildOptions(args: string[]): SummarizeOptions {
  const opts: SummarizeOptions = { mode: 'normal' };

  for (const arg of args) {
    const lower = arg.toLowerCase();

    // Mode
    if (['short', 'normal', 'detailed', 'full'].includes(lower)) {
      opts.mode = lower as SummaryMode;
    }

    // Time periods
    if (lower === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      opts.fromTimestamp = start.getTime();
    }
    if (lower === 'yesterday') {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(0, 0, 0, 0);
      opts.fromTimestamp = start.getTime();
      opts.toTimestamp = end.getTime();
    }
    if (lower === '24h') opts.fromTimestamp = Date.now() - 24 * 60 * 60 * 1000;
    if (lower === '3d') opts.fromTimestamp = Date.now() - 3 * 24 * 60 * 60 * 1000;
    if (lower === '7d' || lower === 'week') opts.fromTimestamp = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Language
    if (['fr', 'en', 'es', 'de', 'pt', 'ar'].includes(lower)) opts.language = lower;
  }

  return opts;
}

export default ConversationIntelCommand;