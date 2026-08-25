/**
 * Tic-Tac-Toe Game (Morpion ❌⭕)
 */

import { IGame } from '../../core/game.interface.js';
import { GamePlayer, GameResult, ActionValidationResult, GameView } from '../../core/types.js';
import { GameSession } from '../../core/game-session.js';
import { TicTacToeState, TicTacToeAction, CellValue } from './tictactoe.types.js';

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Lignes
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Colonnes
  [0, 4, 8], [2, 4, 6]             // Diagonales
];

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

export class TicTacToeGame implements IGame<TicTacToeState, TicTacToeAction> {
  public readonly id = 'tictactoe';
  public readonly name = 'Morpion (Tic-Tac-Toe)';
  public readonly aliases = ['ttt', 'morpion', 'tic-tac-toe'];
  public readonly description = 'Alignez 3 symboles identiques horizontalement, verticalement ou en diagonale.';
  public readonly icon = '❌⭕';
  public readonly minPlayers = 2;
  public readonly maxPlayers = 2;
  public readonly isTurnBased = true;
  public readonly defaultTimeoutSeconds = 180; // 3 min

  public createInitialState(players: GamePlayer[]): TicTacToeState {
    players[0].symbol = '❌';
    if (players[1]) players[1].symbol = '⭕';

    return {
      board: Array(9).fill(null),
      turnPlayerId: players[0].id,
      movesCount: 0
    };
  }

  public parseAction(rawText: string, state: TicTacToeState, player: GamePlayer): TicTacToeAction | null {
    // Nettoyer le texte (ex: "5", ".play 5", "case 5")
    const clean = rawText.replace(/^\.play\s+/i, '').replace(/^\.ttt\s+/i, '').trim();
    const pos = parseInt(clean, 10);
    if (isNaN(pos) || pos < 1 || pos > 9) return null;

    return { position: pos - 1 };
  }

  public validateAction(state: TicTacToeState, player: GamePlayer, action: TicTacToeAction): ActionValidationResult {
    if (action.position < 0 || action.position > 8) {
      return { valid: false, reason: '❌ Choisissez un numéro de case entre 1 et 9.' };
    }

    if (state.board[action.position] !== null) {
      return { valid: false, reason: '❌ Cette case est déjà occupée ! Choisissez une case libre.' };
    }

    return { valid: true };
  }

  public applyAction(state: TicTacToeState, player: GamePlayer, action: TicTacToeAction): TicTacToeState {
    const symbol: CellValue = (player.symbol === '⭕' ? '⭕' : '❌') as CellValue;
    const newBoard = [...state.board];
    newBoard[action.position] = symbol;

    return {
      ...state,
      board: newBoard,
      movesCount: state.movesCount + 1
    };
  }

  public checkResult(state: TicTacToeState, lastPlayer?: GamePlayer): GameResult {
    // Vérifier les combinaisons gagnantes
    for (const [a, b, c] of WINNING_COMBINATIONS) {
      if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
        state.winningLine = [a, b, c];
        return {
          type: 'WIN',
          winner: lastPlayer,
          reason: `🎉 Félicitations ! *${lastPlayer?.name || 'Le joueur'}* aligne 3 symboles et remporte la partie !`
        };
      }
    }

    // Vérifier l'égalité
    if (state.movesCount >= 9 || state.board.every(cell => cell !== null)) {
      return {
        type: 'DRAW',
        reason: '🤝 Match nul ! La grille est complète sans vainqueur.'
      };
    }

    return { type: 'IN_PROGRESS' };
  }

  public renderView(state: TicTacToeState, session: GameSession, viewer?: GamePlayer): GameView {
    const b = state.board;

    // Rendu de la grille
    const c = (idx: number) => b[idx] !== null ? b[idx]! : NUMBER_EMOJIS[idx];
    const boardText =
      `   ${c(0)} ┃ ${c(1)} ┃ ${c(2)}\n` +
      `  ━━━╋━━━╋━━━\n` +
      `   ${c(3)} ┃ ${c(4)} ┃ ${c(5)}\n` +
      `  ━━━╋━━━╋━━━\n` +
      `   ${c(6)} ┃ ${c(7)} ┃ ${c(8)}`;

    const p1 = session.players[0];
    const p2 = session.players[1];
    const current = session.getCurrentPlayer();

    let statusText = '';
    if (session.result) {
      statusText = session.result.reason || 'Partie terminée.';
    } else {
      statusText =
        `❌ *${p1?.name}*\n` +
        `⭕ *${p2?.name || 'En attente...'}*\n\n` +
        `👉 Au tour de : *${current?.name}* (${current?.symbol})`;
    }

    return {
      title: '❌⭕ MORPION (TIC-TAC-TOE)',
      subtitle: `${p1?.name || 'J1'} vs ${p2?.name || 'J2'}`,
      boardText,
      statusText,
      instructionText: session.status === 'IN_PROGRESS' ? 'Répondez simplement avec un chiffre de 1 à 9 pour jouer !' : undefined,
      mentions: session.players.map(p => p.id).filter(id => id.includes('@'))
    };
  }

  public generateAIMove(state: TicTacToeState, aiPlayer: GamePlayer): TicTacToeAction | null {
    // 1. Chercher un coup gagnant
    const emptyIndices: number[] = [];
    state.board.forEach((val, idx) => {
      if (val === null) emptyIndices.push(idx);
    });

    if (emptyIndices.length === 0) return null;

    const aiSymbol = (aiPlayer.symbol || '⭕') as CellValue;
    const opponentSymbol = (aiSymbol === '⭕' ? '❌' : '⭕') as CellValue;

    // Peut-on gagner immédiatement ?
    for (const idx of emptyIndices) {
      const testBoard = [...state.board];
      testBoard[idx] = aiSymbol;
      if (WINNING_COMBINATIONS.some(([a, b, c]) => testBoard[a] === aiSymbol && testBoard[b] === aiSymbol && testBoard[c] === aiSymbol)) {
        return { position: idx };
      }
    }

    // Doit-on bloquer l'adversaire ?
    for (const idx of emptyIndices) {
      const testBoard = [...state.board];
      testBoard[idx] = opponentSymbol;
      if (WINNING_COMBINATIONS.some(([a, b, c]) => testBoard[a] === opponentSymbol && testBoard[b] === opponentSymbol && testBoard[c] === opponentSymbol)) {
        return { position: idx };
      }
    }

    // Prendre le centre (case 4) si libre
    if (state.board[4] === null) return { position: 4 };

    // Coup aléatoire parmi les cases libres
    const randomPos = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    return { position: randomPos };
  }
}

export default TicTacToeGame;
