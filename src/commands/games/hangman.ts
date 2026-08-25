/**
 * Hangman Shortcut Command — .hangman / .pendu
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import gameManager from '../../games/core/game-manager.js';
import gameStatsService from '../../games/services/game-stats-service.js';
import WhatsAppGameRenderer from '../../games/renderers/whatsapp-game-renderer.js';

const HangmanCommand: IPluginCommand = {
  name: 'hangman',
  aliases: ['pendu', 'mot'],
  category: 'Games',
  description: 'Lance le Jeu du Pendu — devinez le mot secret lettre par lettre !',
  usage: '.hangman | .pendu',
  cooldown: 3,

  async execute(ctx: CommandContext) {
    const chatJid = ctx.chat.id;
    const player = {
      id: ctx.sender.id,
      name: ctx.sender.name || ctx.sender.phone,
      joinedAt: Date.now()
    };

    const createRes = gameManager.createGame(chatJid, 'hangman', player);
    if (!createRes.success || !createRes.session) {
      await ctx.reply(createRes.error || '⚠️ Impossible de créer la partie.');
      return;
    }

    // Le Pendu est solo : rejoindre directement pour lancer la partie
    const joinRes = gameManager.joinGame(chatJid, player);
    if (joinRes.started && joinRes.view) {
      await ctx.reply(WhatsAppGameRenderer.toFormattedText(joinRes.view));
    }
  }
};

export default HangmanCommand;
