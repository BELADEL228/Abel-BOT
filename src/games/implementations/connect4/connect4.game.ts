/**
 * Connect 4 Game (Puissance 4 🔴🟡)
 */

import { IGame } from '../../core/game.interface.js';
import { GamePlayer, GameResult, ActionValidationResult, GameView } from '../../core/types.js';
import { GameSession } from '../../core/game-session.js';
import { Connect4State, Connect4Action, Connect4Cell } from './connect4.types.js';

const ROWS = 6;
const COLS = 7;

export class Connect4Game implements IGame<Connect4State, Connect4Action> {
  public readonly id = 'connect4';
  public readonly name = 'Puissance 4 (Connect 4)';
  public readonly aliases = ['c4', 'puissance4', 'connect-4', 'p4'];
  public readonly description = 'Alignez 4 jetons de votre couleur horizontalement, verticalement ou en diagonale.';
  public readonly icon = '🔴🟡';
  public readonly minPlayers = 2;
  public readonly maxPlayers = 2;
  public readonly isTurnBased = true;
  public readonly defaultTimeoutSeconds = 180; // 3 min

  public createInitialState(players: GamePlayer[]): Connect4State {
    players[0].symbol = '🔴';
    if (players[1]) players[1].symbol = '🟡';

    // Grille 6 x 7 initialisée à null
    const grid: Connect4Cell[][] = [];
    for (let r = 0; r < ROWS; r++) {
      grid.push(Array(COLS).fill(null));
    }

    return {
      grid,
      turnPlayerId: players[0].id,
      totalMoves: 0
    };
  }

  public parseAction(rawText: string, state: Connect4State, player: GamePlayer): Connect4Action | null {
    const clean = rawText.replace(/^\.play\s+/i, '').replace(/^\.c4\s+/i, '').replace(/col(?:onne)?\s*/i, '').trim();
    const col = parseInt(clean, 10);
    if (isNaN(col) || col < 1 || col > 7) return null;

    return { column: col - 1 };
  }

  public validateAction(state: Connect4State, player: GamePlayer, action: Connect4Action): ActionValidationResult {
    if (action.column < 0 || action.column >= COLS) {
      return { valid: false, reason: '❌ Choisissez un numéro de colonne entre 1 et 7.' };
    }

    // Vérifier si la colonne est pleine (la case tout en haut r=0 n'est pas vide)
    if (state.grid[0][action.column] !== null) {
      return { valid: false, reason: '❌ Cette colonne est déjà pleine ! Choisissez une autre colonne.' };
    }

    return { valid: true };
  }

  public applyAction(state: Connect4State, player: GamePlayer, action: Connect4Action): Connect4State {
    const symbol: Connect4Cell = player.symbol === '🟡' ? '🟡' : '🔴';
    const newGrid = state.grid.map(row => [...row]);

    // Gravité : trouver la rangée la plus basse disponible
    let targetRow = ROWS - 1;
    while (targetRow >= 0 && newGrid[targetRow][action.column] !== null) {
      targetRow--;
    }

    if (targetRow >= 0) {
      newGrid[targetRow][action.column] = symbol;
    }

    return {
      ...state,
      grid: newGrid,
      totalMoves: state.totalMoves + 1,
      lastMove: { row: targetRow, col: action.column }
    };
  }

  public checkResult(state: Connect4State, lastPlayer?: GamePlayer): GameResult {
    const g = state.grid;

    // Fonction de vérification d'alignement de 4
    const checkLine = (r1: number, c1: number, r2: number, c2: number, r3: number, c3: number, r4: number, c4: number): boolean => {
      const v = g[r1][c1];
      return v !== null && v === g[r2][c2] && v === g[r3][c3] && v === g[r4][c4];
    };

    // 1. Horizontal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        if (checkLine(r, c, r, c + 1, r, c + 2, r, c + 3)) {
          return {
            type: 'WIN',
            winner: lastPlayer,
            reason: `🎉 Félicitations ! *${lastPlayer?.name || 'Le joueur'}* aligne 4 jetons et remporte la partie !`
          };
        }
      }
    }

    // 2. Vertical
    for (let r = 0; r <= ROWS - 4; r++) {
      for (let c = 0; c < COLS; c++) {
        if (checkLine(r, c, r + 1, c, r + 2, c, r + 3, c)) {
          return {
            type: 'WIN',
            winner: lastPlayer,
            reason: `🎉 Félicitations ! *${lastPlayer?.name || 'Le joueur'}* aligne 4 jetons et remporte la partie !`
          };
        }
      }
    }

    // 3. Diagonale bas-droite ↘
    for (let r = 0; r <= ROWS - 4; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        if (checkLine(r, c, r + 1, c + 1, r + 2, c + 2, r + 3, c + 3)) {
          return {
            type: 'WIN',
            winner: lastPlayer,
            reason: `🎉 Félicitations ! *${lastPlayer?.name || 'Le joueur'}* aligne 4 jetons et remporte la partie !`
          };
        }
      }
    }

    // 4. Diagonale haut-droite ↗
    for (let r = 3; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 4; c++) {
        if (checkLine(r, c, r - 1, c + 1, r - 2, c + 2, r - 3, c + 3)) {
          return {
            type: 'WIN',
            winner: lastPlayer,
            reason: `🎉 Félicitations ! *${lastPlayer?.name || 'Le joueur'}* aligne 4 jetons et remporte la partie !`
          };
        }
      }
    }

    // Égalité : plateau plein (42 coups)
    if (state.totalMoves >= ROWS * COLS || state.grid[0].every(c => c !== null)) {
      return {
        type: 'DRAW',
        reason: '🤝 Match nul ! La grille est pleine sans alignement.'
      };
    }

    return { type: 'IN_PROGRESS' };
  }

  public renderView(state: Connect4State, session: GameSession, viewer?: GamePlayer): GameView {
    const gridLines: string[] = [];

    gridLines.push(' 1️⃣  2️⃣  3️⃣  4️⃣  5️⃣  6️⃣  7️⃣');

    for (let r = 0; r < ROWS; r++) {
      const rowStr = state.grid[r].map(cell => cell !== null ? cell : '⚪').join(' ');
      gridLines.push(` ${rowStr}`);
    }

    const p1 = session.players[0];
    const p2 = session.players[1];
    const current = session.getCurrentPlayer();

    let statusText = '';
    if (session.result) {
      statusText = session.result.reason || 'Partie terminée.';
    } else {
      statusText =
        `🔴 *${p1?.name}*\n` +
        `🟡 *${p2?.name || 'En attente...'}*\n\n` +
        `👉 Au tour de : *${current?.name}* (${current?.symbol})`;
    }

    return {
      title: '🔴🟡 PUISSANCE 4 (CONNECT 4)',
      subtitle: `${p1?.name || 'J1'} vs ${p2?.name || 'J2'}`,
      boardText: gridLines.join('\n'),
      statusText,
      instructionText: session.status === 'IN_PROGRESS' ? 'Répondez avec le numéro de la colonne (1 à 7) pour insérer votre jeton !' : undefined,
      mentions: session.players.map(p => p.id).filter(id => id.includes('@'))
    };
  }

  public generateAIMove(state: Connect4State, aiPlayer: GamePlayer): Connect4Action | null {
    const validCols: number[] = [];
    for (let c = 0; c < COLS; c++) {
      if (state.grid[0][c] === null) validCols.push(c);
    }
    if (validCols.length === 0) return null;

    // Priorité au centre (colonne 3)
    if (validCols.includes(3) && Math.random() < 0.5) return { column: 3 };

    // Choix aléatoire parmi les colonnes valides
    const col = validCols[Math.floor(Math.random() * validCols.length)];
    return { column: col };
  }
}

export default Connect4Game;
