/**
 * Tic-Tac-Toe Types
 */

export type CellValue = '❌' | '⭕' | null;

export interface TicTacToeState {
  board: CellValue[]; // Array of 9 cells (indices 0 to 8)
  turnPlayerId: string;
  movesCount: number;
  winningLine?: number[];
}

export interface TicTacToeAction {
  position: number; // 0 to 8 (entered as 1 to 9 by user)
}
