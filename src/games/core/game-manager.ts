/**
 * Game Manager — Gestionnaire centralisé des parties multijoueurs simultanées et de leur cycle de vie
 */

import { GameSession } from './game-session.js';
import { IGame } from './game.interface.js';
import { GamePlayer, GameResult, GameView } from './types.js';
import gameRegistry from './game-registry.js';
import gameEngine, { ActionResult } from './game-engine.js';
import logger from '../../core/logger/logger.js';

export class GameManager {
  private static instance: GameManager;
  
  // chatJid -> Active GameSession
  private activeSessionsByChat: Map<string, GameSession> = new Map();
  // sessionId -> GameSession
  private sessionsById: Map<string, GameSession> = new Map();

  private cleanupInterval: NodeJS.Timeout | null = null;
  private onSessionExpiredCallback?: (session: GameSession, view: GameView) => Promise<void>;

  private constructor() {
    this.startCleanupTimer();
  }

  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  /**
   * Enregistre un callback appelé lorsqu'une session expire
   */
  public onSessionExpired(cb: (session: GameSession, view: GameView) => Promise<void>): void {
    this.onSessionExpiredCallback = cb;
  }

  /**
   * Récupère la partie active dans une discussion WhatsApp
   */
  public getActiveGame(chatJid: string): GameSession | undefined {
    return this.activeSessionsByChat.get(chatJid);
  }

  /**
   * Crée une nouvelle partie dans une discussion
   */
  public createGame(
    chatJid: string,
    gameIdOrAlias: string,
    hostPlayer: GamePlayer,
    options?: Record<string, any>
  ): { success: boolean; session?: GameSession; error?: string } {
    const existing = this.activeSessionsByChat.get(chatJid);
    if (existing && (existing.status === 'IN_PROGRESS' || existing.status === 'WAITING_FOR_PLAYERS')) {
      return {
        success: false,
        error: '⚠️ Une partie est déjà en cours dans cette discussion. Terminez-la ou utilisez `.games surrender` avant d\'en démarrer une nouvelle.'
      };
    }

    const game = gameRegistry.get(gameIdOrAlias);
    if (!game) {
      return {
        success: false,
        error: `❌ Jeu introuvable : "${gameIdOrAlias}". Tapez \`.games\` pour voir la liste des jeux.`
      };
    }

    const sessionId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const session = new GameSession({
      id: sessionId,
      gameId: game.id,
      chatJid,
      hostPlayer,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      timeoutSeconds: game.defaultTimeoutSeconds
    });

    this.activeSessionsByChat.set(chatJid, session);
    this.sessionsById.set(sessionId, session);

    logger.info({ sessionId, gameId: game.id, chatJid, host: hostPlayer.name }, '[GameManager] Game session created.');

    return {
      success: true,
      session
    };
  }

  /**
   * Rejoint ou accepte l'invitation à une partie en attente
   */
  public joinGame(
    chatJid: string,
    player: GamePlayer
  ): { success: boolean; started: boolean; session?: GameSession; view?: GameView; error?: string } {
    const session = this.activeSessionsByChat.get(chatJid);
    if (!session) {
      return { success: false, started: false, error: '⚠️ Aucune partie en attente dans ce chat.' };
    }

    if (session.status !== 'WAITING_FOR_PLAYERS') {
      return { success: false, started: false, error: '⚠️ Cette partie a déjà commencé ou est terminée.' };
    }

    if (session.hasPlayer(player.id)) {
      return { success: false, started: false, error: '⚠️ Vous êtes déjà dans cette partie.' };
    }

    const game = gameRegistry.get(session.gameId);
    if (!game) {
      return { success: false, started: false, error: '❌ Jeu introuvable.' };
    }

    const added = session.addPlayer(player);
    if (!added) {
      return { success: false, started: false, error: '⚠️ La partie est déjà complète.' };
    }

    logger.info({ sessionId: session.id, player: player.name }, '[GameManager] Player joined match.');

    // Si le nombre minimum de joueurs est atteint, démarrer la partie !
    if (session.players.length >= session.minPlayers) {
      const initialState = game.createInitialState(session.players);
      session.start(initialState);
      const view = game.renderView(session.state, session);

      return {
        success: true,
        started: true,
        session,
        view
      };
    }

    return {
      success: true,
      started: false,
      session
    };
  }

  /**
   * Refuse une invitation de jeu
   */
  public declineInvite(chatJid: string, player: GamePlayer): { success: boolean; error?: string } {
    const session = this.activeSessionsByChat.get(chatJid);
    if (!session || session.status !== 'WAITING_FOR_PLAYERS') {
      return { success: false, error: '⚠️ Aucune invitation en attente pour vous dans ce chat.' };
    }

    session.invitedPlayers = session.invitedPlayers.filter(p => p.id !== player.id);
    this.endGame(chatJid);
    return { success: true };
  }

  /**
   * Transmet une action de jeu au GameEngine
   */
  public handleAction(chatJid: string, player: GamePlayer, text: string): ActionResult {
    const session = this.activeSessionsByChat.get(chatJid);
    if (!session) {
      return { success: false, message: '⚠️ Aucune partie en cours dans ce chat.' };
    }

    const game = gameRegistry.get(session.gameId);
    if (!game) {
      return { success: false, message: '❌ Jeu introuvable.' };
    }

    const result = gameEngine.processAction(session, game, player, text);

    // Si la partie est finie, nettoyer la session active
    if (result.isGameOver) {
      this.activeSessionsByChat.delete(chatJid);
    }

    return result;
  }

  /**
   * Abandonne la partie en cours
   */
  public surrender(chatJid: string, player: GamePlayer): ActionResult {
    const session = this.activeSessionsByChat.get(chatJid);
    if (!session) {
      return { success: false, message: '⚠️ Aucune partie en cours dans ce chat.' };
    }

    if (!session.hasPlayer(player.id)) {
      return { success: false, message: '⚠️ Vous ne participez pas à cette partie.' };
    }

    const game = gameRegistry.get(session.gameId);
    if (!game) {
      return { success: false, message: '❌ Jeu introuvable.' };
    }

    const result = gameEngine.handleSurrender(session, game, player);
    this.activeSessionsByChat.delete(chatJid);
    return result;
  }

  /**
   * Annule ou clôture une partie
   */
  public endGame(chatJid: string): boolean {
    const session = this.activeSessionsByChat.get(chatJid);
    if (!session) return false;

    this.activeSessionsByChat.delete(chatJid);
    this.sessionsById.delete(session.id);
    return true;
  }

  /**
   * Timer centralisé de nettoyage des parties inactives / expirées
   */
  private startCleanupTimer(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(async () => {
      const now = Date.now();
      for (const [chatJid, session] of this.activeSessionsByChat.entries()) {
        if (session.isExpired()) {
          logger.info({ sessionId: session.id, gameId: session.gameId }, '[GameManager] Match expired due to inactivity.');
          const game = gameRegistry.get(session.gameId);
          this.activeSessionsByChat.delete(chatJid);
          this.sessionsById.delete(session.id);

          if (game && this.onSessionExpiredCallback) {
            session.finish({
              type: 'TIMEOUT',
              reason: '⏰ Partie expirée après un délai d\'inactivité.'
            });
            const view = game.renderView(session.state, session);
            view.isGameOver = true;
            view.statusText = `⏰ *PARTIE EXPIRÉE*\nLa partie de *${game.name}* a été annulée pour inactivité.`;
            try {
              await this.onSessionExpiredCallback(session, view);
            } catch {
              // ignore
            }
          }
        }
      }
    }, 30_000); // Vérification toutes les 30s
  }

  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export default GameManager.getInstance();
