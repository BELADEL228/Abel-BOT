import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import chatHistoryService, { StoredChatMessage } from '../../services/chat/chat-history-service.js';
import conversationIntelligence from '../../services/ai/conversation-intelligence-service.js';
import logger from '../../core/logger/logger.js';

const PurgeCommand: IPluginCommand = {
  name: 'purge',
  aliases: ['del', 'delete', 'dlt', 'supprimer', 'clear', 'clearchat', 'clearhistory', 'purgeme', 'purgebot'],
  category: 'Group',
  description: 'Supprime en masse des messages récents ou un message cité dans le groupe/discussion.',
  usage: '.purge [nombre] | .purge @contact [nombre] | .del (en répondant à un message) | .clearchat',
  cooldown: 5,

  async execute(ctx: CommandContext) {
    const sub = ctx.commandName;
    const chatJid = ctx.chat.id;
    const isGroup = ctx.chat.isGroup;

    // ── Check Admin / Owner Permissions in Groups ────────────────────────────
    if (isGroup) {
      const isAllowed = ctx.sender.isAdmin || ctx.sender.isOwner || ctx.sender.isSudo;
      if (!isAllowed) {
        await ctx.reply('🚫 Seuls les administrateurs du groupe ou le propriétaire du bot peuvent purger les messages.');
        return;
      }
    }

    // ── 1. CLEAR HISTORY / CHAT MEMORY ──────────────────────────────────────
    if (sub === 'clearchat' || sub === 'clearhistory') {
      chatHistoryService.clearHistory(chatJid);
      conversationIntelligence.clearCache(chatJid);
      await ctx.reply('🧹 *Mémoire et historique du chat effacés avec succès.*');
      return;
    }

    // ── 2. DELETE SINGLE QUOTED MESSAGE (.del / .delete / .dlt / .supprimer) ─
    if (sub === 'del' || sub === 'delete' || sub === 'dlt' || sub === 'supprimer') {
      const quoted = ctx.message.quotedMessage;
      if (!quoted || !quoted.id) {
        await ctx.reply('⚠️ Veuillez répondre (citer) au message que vous souhaitez supprimer avec `.del`.');
        return;
      }

      try {
        const isFromMe = quoted.senderJid.includes(ctx.sender.phone) || quoted.senderJid === ctx.sender.id;
        await ctx.provider.deleteMessage(chatJid, quoted.id, isFromMe, quoted.senderJid);
        chatHistoryService.removeMessage(chatJid, quoted.id);
      } catch (err: any) {
        logger.error({ error: err.message }, '[PurgeCommand] Failed to delete quoted message');
        await ctx.reply('❌ Impossible de supprimer ce message. Vérifiez que le bot est administrateur du groupe.');
      }
      return;
    }

    // ── 3. PURGE FROM QUOTED MESSAGE TO NOW ─────────────────────────────────
    const quoted = ctx.message.quotedMessage;
    if (quoted && quoted.id && (sub === 'purge' || sub === 'clear') && ctx.args.length === 0) {
      const messagesToDelete = chatHistoryService.removeMessagesSince(chatJid, quoted.id);
      if (messagesToDelete.length === 0) {
        // Fallback: delete at least the quoted message
        await ctx.provider.deleteMessage(chatJid, quoted.id, false, quoted.senderJid);
        await ctx.reply('🧹 1 message supprimé.');
        return;
      }

      let deletedCount = 0;
      for (const msg of messagesToDelete) {
        try {
          const isFromMe = msg.senderJid === ctx.sender.id;
          await ctx.provider.deleteMessage(chatJid, msg.id, isFromMe, msg.senderJid);
          deletedCount++;
          await new Promise(r => setTimeout(r, 60)); // Small throttle to prevent rate limit
        } catch {
          // continue
        }
      }

      await ctx.reply(`🧹 *Purge terminée :* ${deletedCount} message(s) supprimé(s).`);
      return;
    }

    // ── 4. PURGE BY SENDER OR BOT (.purge @user, .purgeme, .purgebot) ────────
    const mentionedJid = ctx.message.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const isBotPurge = sub === 'purgeme' || sub === 'purgebot' || (ctx.args[0]?.toLowerCase() === 'bot' || ctx.args[0]?.toLowerCase() === 'me');

    if (mentionedJid || isBotPurge) {
      const targetJid = isBotPurge ? ctx.sender.id : mentionedJid!;
      const countArg = ctx.args.find(a => /^\d+$/.test(a));
      const targetCount = countArg ? Math.min(parseInt(countArg, 10), 100) : 20;

      const userMessages = chatHistoryService.getMessagesBySender(chatJid, targetJid, targetCount);
      if (userMessages.length === 0) {
        await ctx.reply(`⚠️ Aucun message récent trouvé pour ce contact.`);
        return;
      }

      let deletedCount = 0;
      for (const msg of userMessages) {
        try {
          const isFromMe = isBotPurge;
          await ctx.provider.deleteMessage(chatJid, msg.id, isFromMe, msg.senderJid);
          chatHistoryService.removeMessage(chatJid, msg.id);
          deletedCount++;
          await new Promise(r => setTimeout(r, 60));
        } catch {
          // continue
        }
      }

      await ctx.reply(`🧹 *Purge ciblée terminée :* ${deletedCount} message(s) de @${targetJid.split('@')[0]} supprimé(s).`, {
        mentions: [targetJid]
      });
      return;
    }

    // ── 5. BULK PURGE BY COUNT (.purge [nombre]) ─────────────────────────────
    let count = 10;
    const numArg = ctx.args.find(a => /^\d+$/.test(a));
    if (numArg) {
      count = Math.min(Math.max(parseInt(numArg, 10), 1), 100);
    }

    const messages = chatHistoryService.removeRecentMessages(chatJid, count);
    if (messages.length === 0) {
      await ctx.reply('⚠️ Aucun message récent enregistré dans l\'historique du bot à purger.\n_Astuce : vous pouvez aussi citer un message et faire `.del`._');
      return;
    }

    let deletedCount = 0;
    for (const msg of messages) {
      try {
        const isFromMe = msg.senderJid === ctx.sender.id;
        await ctx.provider.deleteMessage(chatJid, msg.id, isFromMe, msg.senderJid);
        deletedCount++;
        await new Promise(r => setTimeout(r, 60));
      } catch {
        // continue
      }
    }

    await ctx.reply(`🧹 *Purge terminée :* ${deletedCount} message(s) supprimé(s).`);
  }
};

export default PurgeCommand;
