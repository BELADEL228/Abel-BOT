/**
 * Tic-Tac-Toe Shortcut Command — .ttt [@adversaire] [ai]
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import gameManager from '../../games/core/game-manager.js';
import gameStatsService from '../../games/services/game-stats-service.js';
import WhatsAppGameRenderer from '../../games/renderers/whatsapp-game-renderer.js';
import { config } from '../../config/env.js';

const TicTacToeCommand: IPluginCommand = {
  name: 'ttt',
  aliases: ['tictactoe', 'morpion'],
  category: 'Games',
  description: 'Lance une partie de Morpion (Tic-Tac-Toe) en 1v1 ou contre le bot IA.',
  usage: '.ttt [@adversaire] | .ttt ai | .ttt solo',
  cooldown: 3,

  async execute(ctx: CommandContext) {
    const p = config.botPrefix;
    const chatJid = ctx.chat.id;
    const player = {
      id: ctx.sender.id,
      name: ctx.sender.name || ctx.sender.phone,
      joinedAt: Date.now()
    };

    const createRes = gameManager.createGame(chatJid, 'tictactoe', player);
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
        `╭━━━〔 ❌⭕ DÉFI MORPION 〕━━━╮\n` +
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
      `╭━━━〔 ❌⭕ PARTIE MORPION CRÉÉE 〕━━━╮\n` +
      `┃\n┃ 👤 *${player.name}* a lancé une partie !\n┃\n` +
      `┃ 💬 Envoyez *1* ou \`${p}games accept\` pour rejoindre.\n` +
      `┃ 🤖 Tapez \`${p}ttt ai\` pour jouer contre le bot.\n` +
      `┃\n┃ ⏰ _Expire dans 3 minutes._\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`
    );
  }
};

export default TicTacToeCommand;
