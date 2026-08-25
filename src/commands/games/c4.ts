/**
 * Connect 4 Shortcut Command — .c4 [@adversaire] [ai]
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import gameManager from '../../games/core/game-manager.js';
import WhatsAppGameRenderer from '../../games/renderers/whatsapp-game-renderer.js';
import { config } from '../../config/env.js';

const Connect4Command: IPluginCommand = {
  name: 'c4',
  aliases: ['connect4', 'puissance4', 'p4'],
  category: 'Games',
  description: 'Lance une partie de Puissance 4 — alignez 4 jetons pour gagner !',
  usage: '.c4 [@adversaire] | .c4 ai',
  cooldown: 3,

  async execute(ctx: CommandContext) {
    const p = config.botPrefix;
    const chatJid = ctx.chat.id;
    const player = {
      id: ctx.sender.id,
      name: ctx.sender.name || ctx.sender.phone,
      joinedAt: Date.now()
    };

    const createRes = gameManager.createGame(chatJid, 'connect4', player);
    if (!createRes.success || !createRes.session) {
      await ctx.reply(createRes.error || '⚠️ Impossible de créer la partie.');
      return;
    }

    const session = createRes.session;
    const isSolo = ctx.args.includes('ai') || ctx.args.includes('bot') || ctx.args.includes('solo');
    const mentionedJid = ctx.message.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (isSolo) {
      const aiPlayer = {
        id: 'ai_bot@s.whatsapp.net',
        name: '🤖 Bot IA',
        isAI: true,
        joinedAt: Date.now()
      };
      const joinRes = gameManager.joinGame(chatJid, aiPlayer);
      if (joinRes.started && joinRes.view) {
        await ctx.reply(WhatsAppGameRenderer.toFormattedText(joinRes.view));
      }
      return;
    }

    if (mentionedJid) {
      const opponentPhone = mentionedJid.split('@')[0];
      session.invitePlayer({ id: mentionedJid, name: `@${opponentPhone}`, joinedAt: Date.now() });
      await ctx.reply(
        `╭━━━〔 🔴🟡 DÉFI PUISSANCE 4 〕━━━╮\n` +
        `┃\n┃ 👤 *${player.name}* défie *@${opponentPhone}* !\n┃\n` +
        `┃ Répondez *1* ou \`${p}games accept\` pour accepter.\n` +
        `┃ Répondez *2* ou \`${p}games decline\` pour refuser.\n` +
        `┃\n┃ ⏰ _Expire dans 3 minutes._\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
        { mentions: [mentionedJid] }
      );
      return;
    }

    await ctx.reply(
      `╭━━━〔 🔴🟡 PARTIE PUISSANCE 4 CRÉÉE 〕━━━╮\n` +
      `┃\n┃ 👤 *${player.name}* a lancé une partie !\n┃\n` +
      `┃ 💬 Envoyez *1* ou \`${p}games accept\` pour rejoindre.\n` +
      `┃ 🤖 Tapez \`${p}c4 ai\` pour jouer contre le bot.\n` +
      `┃\n┃ ⏰ _Expire dans 3 minutes._\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`
    );
  }
};

export default Connect4Command;
