/**
 * Game XP Service — Calculs d'expérience, de niveaux et de titres
 */

export interface LevelInfo {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  title: string;
}

export class GameXPService {
  // Constantes de récompense configurables
  public static readonly XP_WIN = 100;
  public static readonly XP_DRAW = 40;
  public static readonly XP_LOSS = 15;
  public static readonly XP_QUIZ_CORRECT = 25;
  public static readonly XP_STREAK_BONUS_MULTIPLIER = 10; // +10 XP par victoire d'affilée

  /**
   * Titres honorifiques selon le niveau atteint
   */
  private static readonly TITLES: { minLevel: number; title: string }[] = [
    { minLevel: 1,  title: '🌱 Novice des Jeux' },
    { minLevel: 3,  title: '🎯 Joueur Régulier' },
    { minLevel: 5,  title: '⚔️ Stratège Habile' },
    { minLevel: 10, title: '🏆 Maître Tacticien' },
    { minLevel: 15, title: '👑 Grand Maître' },
    { minLevel: 25, title: '⚡ Légende Vivante' },
    { minLevel: 50, title: '🌌 Divinité des Jeux' }
  ];

  /**
   * Calcule le niveau à partir de l'XP totale
   * Formule : Level = floor(sqrt(XP / 100)) + 1
   */
  public static calculateLevel(xp: number): number {
    if (xp <= 0) return 1;
    return Math.floor(Math.sqrt(xp / 100)) + 1;
  }

  /**
   * Retourne l'XP nécessaire pour atteindre un niveau donné
   */
  public static getXpForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.pow(level - 1, 2) * 100;
  }

  /**
   * Retourne les informations complètes de progression pour un joueur
   */
  public static getLevelInfo(totalXp: number): LevelInfo {
    const level = this.calculateLevel(totalXp);
    const currentBaseXp = this.getXpForLevel(level);
    const nextLevelXp = this.getXpForLevel(level + 1);

    const xpInCurrentLevel = Math.max(0, totalXp - currentBaseXp);
    const xpNeededForNextLevel = nextLevelXp - currentBaseXp;
    const progressPercent = Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100));

    // Trouver le titre
    let title = '🌱 Novice des Jeux';
    for (const t of this.TITLES) {
      if (level >= t.minLevel) title = t.title;
    }

    return {
      level,
      currentLevelXp: xpInCurrentLevel,
      nextLevelXp: xpNeededForNextLevel,
      progressPercent,
      title
    };
  }

  /**
   * Calcule l'XP gagnée lors d'une fin de partie
   */
  public static calculateMatchXp(resultType: 'WIN' | 'DRAW' | 'LOSS', streak: number = 0): number {
    if (resultType === 'WIN') {
      const streakBonus = Math.min(100, (streak - 1) * this.XP_STREAK_BONUS_MULTIPLIER);
      return this.XP_WIN + Math.max(0, streakBonus);
    }
    if (resultType === 'DRAW') return this.XP_DRAW;
    return this.XP_LOSS;
  }
}

export default GameXPService;
