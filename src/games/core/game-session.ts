/**
 * Game Session — Instance isolée et autonome d'une partie en cours
 */

import { GamePlayer, GameStatus, GameResult } from './types.js';

export interface GameSessionProps<TState = any> {
  id: string;
  gameId: string;
  chatJid: string;
  hostPlayer: GamePlayer;
  state?: TState;
  minPlayers?: number;
  maxPlayers?: number;
  timeoutSeconds?: number;
}

export class GameSession<TState = any> {
  public readonly id: string;
  public readonly gameId: string;
  public readonly chatJid: string;
  public readonly hostPlayer: GamePlayer;
  public players: GamePlayer[] = [];
  public invitedPlayers: GamePlayer[] = [];
  public state: TState;
  public status: GameStatus = 'WAITING_FOR_PLAYERS';
  public currentTurnPlayerIndex: number = 0;
  public result?: GameResult;
  public readonly createdAt: number = Date.now();
  public startedAt?: number;
  public lastActivityAt: number = Date.now();
  public timeoutSeconds: number;
  public readonly minPlayers: number;
  public readonly maxPlayers: number;

  constructor(props: GameSessionProps<TState>) {
    this.id = props.id;
    this.gameId = props.gameId;
    this.chatJid = props.chatJid;
    this.hostPlayer = props.hostPlayer;
    this.players = [props.hostPlayer];
    this.state = props.state as TState;
    this.minPlayers = props.minPlayers || 2;
    this.maxPlayers = props.maxPlayers || 2;
    this.timeoutSeconds = props.timeoutSeconds || 300; // 5 min par défaut
  }

  /**
   * Retourne le joueur dont c'est actuellement le tour
   */
  public getCurrentPlayer(): GamePlayer | undefined {
    if (this.players.length === 0) return undefined;
    return this.players[this.currentTurnPlayerIndex % this.players.length];
  }

  /**
   * Passe le tour au joueur suivant
   */
  public nextTurn(): GamePlayer {
    this.currentTurnPlayerIndex = (this.currentTurnPlayerIndex + 1) % this.players.length;
    this.touch();
    return this.getCurrentPlayer()!;
  }

  /**
   * Ajoute un joueur à la partie
   */
  public addPlayer(player: GamePlayer): boolean {
    if (this.players.some(p => p.id === player.id)) return false;
    if (this.players.length >= this.maxPlayers) return false;
    
    this.players.push(player);
    // Retirer des invités si présent
    this.invitedPlayers = this.invitedPlayers.filter(p => p.id !== player.id);
    this.touch();
    return true;
  }

  /**
   * Ajoute un joueur invité
   */
  public invitePlayer(player: GamePlayer): void {
    if (!this.invitedPlayers.some(p => p.id === player.id) && !this.players.some(p => p.id === player.id)) {
      this.invitedPlayers.push(player);
      this.touch();
    }
  }

  /**
   * Vérifie si un joueur est dans la partie
   */
  public hasPlayer(userId: string): boolean {
    return this.players.some(p => p.id === userId);
  }

  /**
   * Vérifie si un joueur a été invité
   */
  public isInvited(userId: string): boolean {
    return this.invitedPlayers.some(p => p.id === userId);
  }

  /**
   * Vérifie si c'est le tour de ce joueur
   */
  public isPlayerTurn(userId: string): boolean {
    const current = this.getCurrentPlayer();
    return current !== undefined && current.id === userId;
  }

  /**
   * Actualise le timestamp de dernière activité
   */
  public touch(): void {
    this.lastActivityAt = Date.now();
  }

  /**
   * Détermine si la session a expiré
   */
  public isExpired(): boolean {
    return (Date.now() - this.lastActivityAt) > (this.timeoutSeconds * 1000);
  }

  /**
   * Démarre la partie
   */
  public start(initialState: TState): void {
    this.state = initialState;
    this.status = 'IN_PROGRESS';
    this.startedAt = Date.now();
    this.touch();
  }

  /**
   * Clôture la partie avec un résultat
   */
  public finish(result: GameResult): void {
    this.result = result;
    this.status = result.type === 'TIMEOUT' ? 'EXPIRED' : (result.type === 'CANCELLED' ? 'ABANDONED' : 'FINISHED');
    this.touch();
  }
}

export default GameSession;
