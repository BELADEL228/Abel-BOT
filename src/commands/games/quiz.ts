/**
 * Quiz Shortcut Command — .quiz / .trivia
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import gameManager from '../../games/core/game-manager.js';
import gameStatsService from '../../games/services/game-stats-service.js';
import WhatsAppGameRenderer from '../../games/renderers/whatsapp-game-renderer.js';

const QuizCommand: IPluginCommand = {
  name: 'quiz',
  aliases: ['trivia', 'culture'],
  category: 'Games',
  description: 'Lance un Quiz Culture & Tech — 5 questions, répondez A B C ou D !',
  usage: '.quiz | .trivia',
  cooldown: 3,

  async execute(ctx: CommandContext) {
    const chatJid = ctx.chat.id;
    const player = {
      id: ctx.sender.id,
      name: ctx.sender.name || ctx.sender.phone,
      joinedAt: Date.now()
    };

    const createRes = gameManager.createGame(chatJid, 'quiz', player);
    if (!createRes.success || !createRes.session) {
      await ctx.reply(createRes.error || '⚠️ Impossible de créer la partie.');
      return;
    }

    // Le Quiz démarre directement en solo
    const joinRes = gameManager.joinGame(chatJid, player);
    if (joinRes.started && joinRes.view) {
      await ctx.reply(WhatsAppGameRenderer.toFormattedText(joinRes.view));
    }
  }
};

export default QuizCommand;
