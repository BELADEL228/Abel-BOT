import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import aiService from '../../services/ai/ai-service.js';
import contextManager from '../../services/automation/context-manager.js';
import chatHistoryService from '../../services/chat/chat-history-service.js';
import logger from '../../core/logger/logger.js';

// Limite pour éviter memory DOS + IA token overflow
const MAX_CONTEXT_LENGTH = 50_000;
const MAX_MESSAGES_PER_REQUEST = 300;

const SummarizeCommand: IPluginCommand = {
  name: 'summarize',
  aliases: ['summary', 'brief', 'résumé', 'recap'],
  category: 'AI',
  description: 'Résumé IA : analyse l\'historique du groupe/chat et extrait les points clés, idées principales et conclusions.',
  usage: '.summarize [today|24h|week] ou répondez à un message avec .summarize',
  cooldown: 5,
  permissions: ['canUseAI'],

  async execute(ctx: CommandContext) {
    await ctx.provider.sendPresence(ctx.chat.id, 'composing');

    // ── OPTION 1: Si on répond à un message, résumer ce message spécifiquement
    if (ctx.message?.quotedMessage?.text) {
      const textToSummarize = ctx.message.quotedMessage.text;

      if (textToSummarize.length < 30) {
        await ctx.reply('⚠️ Le message cité est trop court pour être résumé.');
        return;
      }

      try {
        const prompt =
          `Résume le texte suivant en français de manière claire et concise. ` +
          `Extrais les idées principales et conclusions sous forme de points structurés avec des emojis pertinents :\n\n"${textToSummarize}"`;

        const summary = await aiService.generateText(prompt);
        await ctx.reply(`📝 *RÉSUMÉ DU MESSAGE :*\n\n${summary}`);
      } catch (err) {
        logger.error({ error: err }, '[SummarizeCommand] Failed to summarize quoted message');
        await ctx.reply(`❌ Erreur lors du résumé : ${(err as Error).message}`);
      }
      return;
    }

    // ── OPTION 2: Résumer l'historique du groupe ou de la conversation
    let timeFilter: 'all' | 'today' | '24h' | 'week' = 'all';
    let timeRangeLabel = 'récent';

    for (const arg of ctx.args) {
      const lower = arg.toLowerCase();
      if (lower === 'today') {
        timeFilter = 'today';
        timeRangeLabel = "d'aujourd'hui";
        break;
      } else if (lower === '24h') {
        timeFilter = '24h';
        timeRangeLabel = 'des dernières 24h';
        break;
      } else if (lower === 'week' || lower === '7d') {
        timeFilter = 'week';
        timeRangeLabel = 'de la semaine';
        break;
      }
    }

    // Récupérer depuis contextManager ou charger depuis la base de données
    let rawMessages: { sender: string; text: string; timestamp: number }[] = contextManager.getRecentContext(ctx.chat.id);

    if (!rawMessages || rawMessages.length === 0) {
      const dbMsgs = await chatHistoryService.getRecentMessagesAsync(ctx.chat.id, 200);
      rawMessages = dbMsgs.map(m => ({
        sender: m.senderName,
        text: m.text,
        timestamp: m.timestamp
      }));
    }

    if (!rawMessages || rawMessages.length === 0) {
      await ctx.reply(
        `❌ *Aucun historique disponible.*\n\n` +
        `Le bot n'a pas encore de messages enregistrés dans ce chat.\n` +
        `Envoyez quelques messages et réessayez.`
      );
      return;
    }

    let filteredMessages = [...rawMessages];

    // Filtrage temporel
    switch (timeFilter) {
      case 'today': {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filteredMessages = filteredMessages.filter(m => m.timestamp >= today.getTime());
        if (filteredMessages.length === 0) {
          await ctx.reply('❌ Aucun message d\'aujourd\'hui à résumer.');
          return;
        }
        break;
      }
      case '24h': {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        filteredMessages = filteredMessages.filter(m => m.timestamp >= oneDayAgo);
        if (filteredMessages.length === 0) {
          await ctx.reply('❌ Aucun message dans les dernières 24h à résumer.');
          return;
        }
        break;
      }
      case 'week': {
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        filteredMessages = filteredMessages.filter(m => m.timestamp >= oneWeekAgo);
        if (filteredMessages.length === 0) {
          await ctx.reply('❌ Aucun message de cette semaine à résumer.');
          return;
        }
        break;
      }
      default:
        break;
    }

    if (filteredMessages.length > MAX_MESSAGES_PER_REQUEST) {
      filteredMessages = filteredMessages.slice(-MAX_MESSAGES_PER_REQUEST);
    }

    let historyText = filteredMessages
      .map(m => `[${new Date(m.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}] ${m.sender}: "${m.text}"`)
      .join('\n');

    if (historyText.length > MAX_CONTEXT_LENGTH) {
      historyText = historyText.slice(-MAX_CONTEXT_LENGTH);
    }

    try {
      const prompt =
        `Tu es un assistant expert qui résume les conversations WhatsApp.\n\n` +
        `Analyse la conversation suivante (${timeRangeLabel}) et génère un résumé vivant, précis et structuré en français :\n\n` +
        `1. 📝 *SYNTHÈSE GLOBALE* (qui a parlé de quoi, le fil conducteur des échanges)\n` +
        `2. 🧠 *POINTS ESSENTIELS* (les 3-5 faits marquants ou idées partagées)\n` +
        `3. ✅ *DÉCISIONS / CONCLUSIONS* (les points d'accord ou actions à retenir)\n\n` +
        `CONVERSATION :\n${historyText}\n\n` +
        `RÉSUMÉ STRUCTURÉ :`;

      const summary = await aiService.generateText(prompt);

      const response =
        `╭━━━〔 📝 RÉSUMÉ IA ${timeRangeLabel.toUpperCase()} 〕━━━╮\n` +
        `┃ 💬 Basé sur ${filteredMessages.length} messages récents\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        `${summary}`;

      await ctx.reply(response);
    } catch (err) {
      logger.error({ error: err }, '[SummarizeCommand] Failed to generate summary');
      await ctx.reply(`❌ Erreur lors de la génération du résumé : ${(err as Error).message}`);
    }
  }
};

export default SummarizeCommand;