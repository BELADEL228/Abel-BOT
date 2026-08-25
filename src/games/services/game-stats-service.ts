/**
 * Game Stats Service — Enregistrement et persistance des statistiques des joueurs
 * Sauvegarde permanente dans data/game-stats.json avec synchronisation base de données.
 */

import fs from 'fs';
import path from 'path';
import { PlayerStats, GameResult, GamePlayer } from '../core/types.js';
import GameXPService from './game-xp-service.js';
import logger from '../../core/logger/logger.js';

export class GameStatsService {
  private static instance: GameStatsService;
  private statsFile: string;
  private statsCache: Map<string, PlayerStats> = new Map();

  private constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.statsFile = path.join(dataDir, 'game-stats.json');
    this.loadStats();
  }

  public static getInstance(): GameStatsService {
    if (!GameStatsService.instance) {
      GameStatsService.instance = new GameStatsService();
    }
    return GameStatsService.instance;
  }

  private loadStats(): void {
    try {
      if (fs.existsSync(this.statsFile)) {
        const raw = fs.readFileSync(this.statsFile, 'utf8');
        const data: Record<string, PlayerStats> = JSON.parse(raw);
        for (const [userId, stats] of Object.entries(data)) {
          this.statsCache.set(userId, stats);
        }
      }
    } catch (err: any) {
      logger.warn({ error: err.message }, '[GameStatsService] Failed to load stats file, starting fresh.');
    }
  }

  private saveStats(): void {
    try {
      const obj: Record<string, PlayerStats> = {};
      for (const [userId, stats] of this.statsCache.entries()) {
        obj[userId] = stats;
      }
      fs.writeFileSync(this.statsFile, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err: any) {
      logger.error({ error: err.message }, '[GameStatsService] Failed to save stats file.');
    }
  }

  /**
   * Récupère ou initialise les statistiques d'un joueur
   */
  public getOrCreateStats(userId: string, name: string): PlayerStats {
    let stats = this.statsCache.get(userId);
    if (!stats) {
      stats = {
        userId,
        name,
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        xp: 0,
        level: 1,
        currentStreak: 0,
        bestStreak: 0,
        lastPlayedAt: Date.now(),
        gameBreakdown: {}
      };
      this.statsCache.set(userId, stats);
    } else if (name && name !== stats.name) {
      stats.name = name;
    }
    return stats;
  }

  /**
   * Enregistre le résultat d'une partie et distribue l'XP
   */
  public recordMatchResult(
    gameId: string,
    result: GameResult,
    allPlayers: GamePlayer[]
  ): Map<string, { xpGained: number; totalXp: number; level: number; leveledUp: boolean }> {
    const rewards = new Map<string, { xpGained: number; totalXp: number; level: number; leveledUp: boolean }>();

    for (const player of allPlayers) {
      if (player.isAI) continue; // Pas de stats pour les IA

      const stats = this.getOrCreateStats(player.id, player.name);
      const oldLevel = stats.level;
      stats.totalGames++;
      stats.lastPlayedAt = Date.now();

      if (!stats.gameBreakdown[gameId]) {
        stats.gameBreakdown[gameId] = { wins: 0, losses: 0, draws: 0 };
      }

      let isWin = false;
      let isDraw = false;

      if (result.type === 'WIN' && result.winner?.id === player.id) {
        isWin = true;
        stats.wins++;
        stats.currentStreak++;
        if (stats.currentStreak > stats.bestStreak) {
          stats.bestStreak = stats.currentStreak;
        }
        stats.gameBreakdown[gameId].wins++;
      } else if (result.type === 'DRAW') {
        isDraw = true;
        stats.draws++;
        stats.currentStreak = 0;
        stats.gameBreakdown[gameId].draws++;
      } else {
        stats.losses++;
        stats.currentStreak = 0;
        stats.gameBreakdown[gameId].losses++;
      }

      const matchOutcome = isWin ? 'WIN' : (isDraw ? 'DRAW' : 'LOSS');
      const xpGained = GameXPService.calculateMatchXp(matchOutcome, stats.currentStreak);
      stats.xp += xpGained;
      stats.level = GameXPService.calculateLevel(stats.xp);

      const leveledUp = stats.level > oldLevel;
      rewards.set(player.id, {
        xpGained,
        totalXp: stats.xp,
        level: stats.level,
        leveledUp
      });
    }

    this.saveStats();
    return rewards;
  }

  /**
   * Retourne tous les profils de joueurs enregistrés
   */
  public getAllPlayerStats(): PlayerStats[] {
    return Array.from(this.statsCache.values());
  }
}

export default GameStatsService.getInstance();
