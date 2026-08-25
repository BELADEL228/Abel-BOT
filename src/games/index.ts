/**
 * Games Module Bootstrap — Enregistrement automatique de tous les jeux au démarrage
 */

import gameRegistry from './core/game-registry.js';
import gameManager from './core/game-manager.js';
import TicTacToeGame from './implementations/tictactoe/tictactoe.game.js';
import Connect4Game from './implementations/connect4/connect4.game.js';
import HangmanGame from './implementations/hangman/hangman.game.js';
import QuizGame from './implementations/quiz/quiz.game.js';

// Singletons explicitly named for direct imports from message-handler
export { default as gameStatsService } from './services/game-stats-service.js';
export { default as WhatsAppGameRenderer } from './renderers/whatsapp-game-renderer.js';

export function initializeGames(): void {
  // Enregistrer les 4 premiers jeux
  gameRegistry.register(new TicTacToeGame());
  gameRegistry.register(new Connect4Game());
  gameRegistry.register(new HangmanGame());
  gameRegistry.register(new QuizGame());
}

// Initialiser immédiatement à l'import
initializeGames();

export * from './core/types.js';
export * from './core/game.interface.js';
export * from './core/game-session.js';
export * from './core/game-engine.js';
export * from './core/game-registry.js';
export * from './core/game-manager.js';
export * from './services/game-xp-service.js';
export * from './services/game-ranking-service.js';

export default gameManager;
