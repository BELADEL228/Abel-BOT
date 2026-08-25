/**
 * Game Engine Types — Modèles de données pour le moteur de jeux Abel-Bot
 */

import { UIButton } from '../../ui/types/ui.types.js';

export type GameStatus =
  | 'WAITING_FOR_PLAYERS' // En attente d'acceptation d'invitation ou d'autres joueurs
  | 'IN_PROGRESS'         // Partie en cours
  | 'FINISHED'            // Partie terminée normalement
  | 'ABANDONED'           // Un joueur a abandonné
  | 'EXPIRED'             // Temps limite dépassé
  | 'CANCELLED';          // Annulée

export interface GamePlayer {
  id: string;             // JID WhatsApp (ex: 228xxxx@s.whatsapp.net ou 'ai_bot')
  name: string;           // Nom d'affichage
  score?: number;         // Score éventuel
  isAI?: boolean;         // Indique si le joueur est un bot IA
  symbol?: string;        // Symbole (ex: '❌', '⭕', '🔴', '🟡')
  joinedAt: number;       // Timestamp d'entrée dans la partie
}

export type GameResultType = 'WIN' | 'DRAW' | 'IN_PROGRESS' | 'CANCELLED' | 'TIMEOUT';

export interface GameResult {
  type: GameResultType;
  winner?: GamePlayer;
  losers?: GamePlayer[];
  reason?: string;
  xpRewards?: Map<string, number>; // playerId -> XP gagné
}

export interface ActionValidationResult {
  valid: boolean;
  reason?: string;
}

export interface GameView {
  title: string;
  subtitle?: string;
  boardText: string;
  statusText: string;
  instructionText?: string;
  footerText?: string;
  buttons?: UIButton[];
  mentions?: string[];
  isGameOver?: boolean;
}

export interface PlayerStats {
  userId: string;
  name: string;
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  xp: number;
  level: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayedAt: number;
  gameBreakdown: Record<string, { wins: number; losses: number; draws: number }>;
}
