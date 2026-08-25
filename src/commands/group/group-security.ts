import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import botDetector from '../../services/protection/bot-detector.js';
import chatHistoryService from '../../services/chat/chat-history-service.js';

const GroupSecurityCommand: IPluginCommand = {
  name: 'antilink',
  aliases: [
    'antibot', 'antispam', 'antiflood', 'antiforward', 'antimedia', 'antibadword',
    'antidelete', 'antiedit', 'antimention', 'antitag', 'antitagadmin', 'antiimage',
    'antivideo', 'antigif', 'antisticker', 'antidocument', 'antilocation', 'antipoll',
    'antivoice', 'antichannelpost', 'antigroupmention',
    'detectbots', 'neutralizebot', 'pausebot', 'activatebot', 'unpausebot', 'listedbots', 'botstatus'
  ],
  category: 'Group',
  description: 'Système de sécurité de groupe (Anti-Bot, Anti-Link, Détection & Neutralisation de Bots).',
  usage: '.detectbots ou .pausebot @bot ou .activatebot @bot',
  groupOnly: true,
  cooldown: 3,

  async execute(ctx: CommandContext) {
    const feature = ctx.commandName;
    const action = ctx.args[0]?.toLowerCase() || 'status';

    // 1. Bot detection and management commands
    if (['detectbots', 'listedbots', 'botstatus'].includes(feature)) {
      // Scan recent history
      const history = chatHistoryService.getRecentMessages(ctx.chat.id, 50);
      botDetector.scanGroupHistory(history, ctx.chat.id);

      const statusCard = botDetector.getStatusCard(ctx.chat.id);
      await ctx.reply(statusCard);
      return;
    }

    if (['neutralizebot', 'pausebot'].includes(feature)) {
      if (!ctx.sender.isOwner && !ctx.sender.isSudo && !ctx.sender.isAdmin) {
        await ctx.reply('🚫 Seul le propriétaire du bot ou les administrateurs peuvent neutraliser un bot.');
        return;
      }

      const targetJid = ctx.message.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
        ctx.message.quotedMessage?.senderJid ||
        (ctx.args[0]?.includes('@') ? ctx.args[0].replace('@', '') + '@s.whatsapp.net' : undefined);

      if (!targetJid) {
        await ctx.reply('⚠️ Veuillez mentionner le bot à mettre en pause ou répondre à son message. Exemple : `.pausebot @bot`');
        return;
      }

      botDetector.registerBot(targetJid, ctx.chat.id, 'Mis en pause par le propriétaire');
      botDetector.neutralize(targetJid);

      await ctx.reply(
        `🛑 *BOT MIS EN PAUSE AVEC SUCCÈS*\n\n` +
        `🤖 *Bot :* @${targetJid.split('@')[0]}\n` +
        `🛡️ *Statut :* Neutralisé (Silence & Blacklist Abel-Bot)\n` +
        `👑 *Action par :* @${ctx.sender.phone}\n\n` +
        `ℹ️ Toutes les interactions avec ce bot sont désormais coupées. Pour le réactiver : \`.activatebot @${targetJid.split('@')[0]}\``,
        { mentions: [targetJid, ctx.sender.id] }
      );
      return;
    }

    if (['activatebot', 'unpausebot'].includes(feature)) {
      if (!ctx.sender.isOwner && !ctx.sender.isSudo && !ctx.sender.isAdmin) {
        await ctx.reply('🚫 Seul le propriétaire du bot ou les administrateurs peuvent réactiver un bot.');
        return;
      }

      const targetJid = ctx.message.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
        ctx.message.quotedMessage?.senderJid ||
        (ctx.args[0]?.includes('@') ? ctx.args[0].replace('@', '') + '@s.whatsapp.net' : undefined);

      if (!targetJid) {
        await ctx.reply('⚠️ Veuillez mentionner le bot à réactiver ou répondre à son message. Exemple : `.activatebot @bot`');
        return;
      }

      const activated = botDetector.activate(targetJid);
      if (!activated) {
        botDetector.registerBot(targetJid, ctx.chat.id, 'Réactivé par le propriétaire');
        botDetector.activate(targetJid);
      }

      await ctx.reply(
        `🟢 *BOT RÉACTIVÉ AVEC SUCCÈS*\n\n` +
        `🤖 *Bot :* @${targetJid.split('@')[0]}\n` +
        `🛡️ *Statut :* Actif (Autorisé)\n` +
        `👑 *Action par :* @${ctx.sender.phone}`,
        { mentions: [targetJid, ctx.sender.id] }
      );
      return;
    }

    // 2. Standard security toggles
    if (!ctx.sender.isAdmin && !ctx.sender.isOwner && !ctx.sender.isSudo) {
      await ctx.reply('🚫 Seuls les administrateurs ou le propriétaire du bot peuvent modifier la sécurité.');
      return;
    }

    if (action === 'on' || action === 'enable') {
      await ctx.reply(`🛡️ *SÉCURITÉ DE GROUPE :* La fonction \`.${feature}\` est maintenant *ACTIVÉE* ✅`);
      return;
    }

    if (action === 'off' || action === 'disable') {
      await ctx.reply(`🛡️ *SÉCURITÉ DE GROUPE :* La fonction \`.${feature}\` est maintenant *DÉSACTIVÉE* ❌`);
      return;
    }

    await ctx.reply(`🛡️ *STATUT DE SÉCURITÉ ( ${feature.toUpperCase()} ) :* En surveillance active (Action: WARN / DELETE / KICK)`);
  }
};

export default GroupSecurityCommand;
