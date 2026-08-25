/**
 * Connect 4 Types (Puissance 4 🔴🟡)
 */

export type Connect4Cell = '🔴' | '🟡' | null;

export interface Connect4State {
  // Matrice 6 lignes x 7 colonnes (0 = haut, 5 = bas, 0 = gauche, 6 = droite)
  grid: Connect4Cell[][];
  turnPlayerId: string;
  totalMoves: number;
  lastMove?: { row: number; col: number };
}

export interface Connect4Action {
  column: number; // 0 to 6 (entered as 1 to 7 by user)
}
