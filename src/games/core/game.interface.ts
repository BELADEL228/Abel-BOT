/**
 * Game Interface — Contrat universel que chaque jeu doit implémenter
 */

import { GamePlayer, GameResult, ActionValidationResult, GameView } from './types.js';
import { GameSession } from './game-session.js';

export interface IGame<TState = any, TAction = any> {
  /** Identifiant unique du jeu (ex: 'tictactoe', 'connect4') */
  readonly id: string;

  /** Nom d'affichage (ex: 'Morpion ❌⭕') */
  readonly name: string;

  /** Alias de commandes (ex: ['ttt', 'morpion']) */
  readonly aliases: string[];

  /** Description courte des règles */
  readonly description: string;

  /** Icône emoji */
  readonly icon: string;

  /** Nombre minimum de joueurs requis */
  readonly minPlayers: number;

  /** Nombre maximum de joueurs autorisés */
  readonly maxPlayers: number;

  /** Indique si le jeu se joue au tour par tour */
  readonly isTurnBased: boolean;

  /** Durée d'inactivité avant expiration (en secondes) */
  readonly defaultTimeoutSeconds: number;

  /**
   * Crée l'état initial d'une nouvelle partie
   */
  createInitialState(players: GamePlayer[], options?: Record<string, any>): TState;

  /**
   * Parse une action textuelle envoyée par un joueur
   */
  parseAction(rawText: string, state: TState, player: GamePlayer): TAction | null;

  /**
   * Valide si l'action du joueur est autorisée selon les règles
   */
  validateAction(state: TState, player: GamePlayer, action: TAction): ActionValidationResult;

  /**
   * Applique l'action et retourne le nouvel état du jeu
   */
  applyAction(state: TState, player: GamePlayer, action: TAction): TState;

  /**
   * Vérifie si la partie est terminée (victoire, défaite, égalité)
   */
  checkResult(state: TState, lastPlayer?: GamePlayer): GameResult;

  /**
   * Génère la vue à afficher sur WhatsApp
   */
  renderView(state: TState, session: GameSession, viewer?: GamePlayer): GameView;

  /**
   * (Optionnel) Génère le coup automatique pour une IA
   */
  generateAIMove?(state: TState, aiPlayer: GamePlayer): TAction | null;
}
