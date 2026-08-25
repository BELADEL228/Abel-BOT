/**
 * Game Ranking Service — Classements globaux et par jeu
 */

import gameStatsService from './game-stats-service.js';
import GameXPService from './game-xp-service.js';
import { PlayerStats } from '../core/types.js';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  level: number;
  title: string;
  xp: number;
  wins: number;
  totalGames: number;
  winrate: number;
}

export class GameRankingService {
  private static instance: GameRankingService;

  private constructor() {}

  public static getInstance(): GameRankingService {
    if (!GameRankingService.instance) {
      GameRankingService.instance = new GameRankingService();
    }
    return GameRankingService.instance;
  }

  /**
   * Retourne le classement global par XP
   */
  public getGlobalLeaderboard(limit: number = 10): LeaderboardEntry[] {
    const all = gameStatsService.getAllPlayerStats();
    
    // Trier par XP décroissant, puis par victoires
    all.sort((a, b) => b.xp - a.xp || b.wins - a.wins);

    return all.slice(0, limit).map((stats, idx) => {
      const levelInfo = GameXPService.getLevelInfo(stats.xp);
      const winrate = stats.totalGames > 0
        ? Math.round((stats.wins / stats.totalGames) * 1000) / 10
        : 0;

      return {
        rank: idx + 1,
        userId: stats.userId,
        name: stats.name,
        level: stats.level,
        title: levelInfo.title,
        xp: stats.xp,
        wins: stats.wins,
        totalGames: stats.totalGames,
        winrate
      };
    });
  }

  /**
   * Retourne le classement spécifique à un jeu
   */
  public getGameLeaderboard(gameId: string, limit: number = 10): LeaderboardEntry[] {
    const all = gameStatsService.getAllPlayerStats().filter(s => s.gameBreakdown[gameId]);

    all.sort((a, b) => {
      const aWins = a.gameBreakdown[gameId]?.wins || 0;
      const bWins = b.gameBreakdown[gameId]?.wins || 0;
      return bWins - aWins || b.xp - a.xp;
    });

    return all.slice(0, limit).map((stats, idx) => {
      const g = stats.gameBreakdown[gameId];
      const total = (g?.wins || 0) + (g?.losses || 0) + (g?.draws || 0);
      const winrate = total > 0 ? Math.round(((g?.wins || 0) / total) * 1000) / 10 : 0;
      const levelInfo = GameXPService.getLevelInfo(stats.xp);

      return {
        rank: idx + 1,
        userId: stats.userId,
        name: stats.name,
        level: stats.level,
        title: levelInfo.title,
        xp: stats.xp,
        wins: g?.wins || 0,
        totalGames: total,
        winrate
      };
    });
  }
}

export default GameRankingService.getInstance();
