/**
 * Game Engine — Moteur générique de cycle de vie et d'exécution des parties
 */

import { IGame } from './game.interface.js';
import { GameSession } from './game-session.js';
import { GamePlayer, GameResult, GameView } from './types.js';
import logger from '../../core/logger/logger.js';

export interface ActionResult {
  success: boolean;
  message?: string;
  view?: GameView;
  isGameOver?: boolean;
  result?: GameResult;
}

export class GameEngine {
  private static instance: GameEngine;

  private constructor() {}

  public static getInstance(): GameEngine {
    if (!GameEngine.instance) {
      GameEngine.instance = new GameEngine();
    }
    return GameEngine.instance;
  }

  /**
   * Traite une action utilisateur envoyée dans une session de jeu
   */
  public processAction(
    session: GameSession,
    game: IGame,
    player: GamePlayer,
    rawText: string
  ): ActionResult {
    if (session.status !== 'IN_PROGRESS') {
      return {
        success: false,
        message: '⚠️ Cette partie n\'est pas en cours.'
      };
    }

    // 1. Vérification du tour (pour les jeux au tour par tour)
    if (game.isTurnBased && !session.isPlayerTurn(player.id)) {
      const current = session.getCurrentPlayer();
      return {
        success: false,
        message: `⏳ Ce n'est pas votre tour ! C'est au tour de *${current?.name || 'l\'autre joueur'}*.`
      };
    }

    // 2. Parsing de l'action
    const action = game.parseAction(rawText, session.state, player);
    if (action === null) {
      return {
        success: false,
        message: '❌ Action non reconnue. Veuillez suivre les instructions de jeu.'
      };
    }

    // 3. Validation de l'action selon les règles du jeu
    const validation = game.validateAction(session.state, player, action);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.reason || '❌ Action invalide selon les règles du jeu.'
      };
    }

    // 4. Application de l'action
    session.state = game.applyAction(session.state, player, action);
    session.touch();

    // 5. Vérification du résultat (Victoire, Égalité, En cours)
    const result = game.checkResult(session.state, player);

    if (result.type !== 'IN_PROGRESS') {
      session.finish(result);
      logger.info(
        { gameId: game.id, sessionId: session.id, resultType: result.type, winner: result.winner?.name },
        `[GameEngine] Match completed: ${result.type}`
      );

      const finalView = game.renderView(session.state, session, player);
      finalView.isGameOver = true;

      return {
        success: true,
        isGameOver: true,
        result,
        view: finalView
      };
    }

    // 6. Si le jeu continue, passer au tour suivant
    if (game.isTurnBased) {
      session.nextTurn();
    }

    // 7. Tour automatique de l'IA si le prochain joueur est un bot
    let current = session.getCurrentPlayer();
    if (current && current.isAI && game.generateAIMove) {
      const aiAction = game.generateAIMove(session.state, current);
      if (aiAction) {
        session.state = game.applyAction(session.state, current, aiAction);
        const aiResult = game.checkResult(session.state, current);
        if (aiResult.type !== 'IN_PROGRESS') {
          session.finish(aiResult);
          const finalView = game.renderView(session.state, session, player);
          finalView.isGameOver = true;
          return {
            success: true,
            isGameOver: true,
            result: aiResult,
            view: finalView
          };
        }
        if (game.isTurnBased) {
          session.nextTurn();
        }
      }
    }

    const updatedView = game.renderView(session.state, session, player);
    return {
      success: true,
      isGameOver: false,
      view: updatedView
    };
  }

  /**
   * Gère l'abandon d'un joueur
   */
  public handleSurrender(session: GameSession, game: IGame, surrenderingPlayer: GamePlayer): ActionResult {
    if (session.status !== 'IN_PROGRESS') {
      return {
        success: false,
        message: '⚠️ La partie n\'est pas en cours.'
      };
    }

    const winner = session.players.find(p => p.id !== surrenderingPlayer.id);
    const result: GameResult = {
      type: 'WIN',
      winner,
      losers: [surrenderingPlayer],
      reason: `🏳️ *${surrenderingPlayer.name}* a abandonné la partie.`
    };

    session.finish(result);

    const view = game.renderView(session.state, session);
    view.isGameOver = true;
    view.statusText = `🏳️ *${surrenderingPlayer.name}* a déclaré forfait.\n🏆 *${winner?.name || 'Personne'}* remporte la victoire !`;

    return {
      success: true,
      isGameOver: true,
      result,
      view
    };
  }
}

export default GameEngine.getInstance();
