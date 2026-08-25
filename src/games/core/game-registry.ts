/**
 * Game Registry — Registre et catalogue de tous les jeux disponibles
 */

import { IGame } from './game.interface.js';
import logger from '../../core/logger/logger.js';

export class GameRegistry {
  private static instance: GameRegistry;
  private games: Map<string, IGame> = new Map();
  private aliases: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): GameRegistry {
    if (!GameRegistry.instance) {
      GameRegistry.instance = new GameRegistry();
    }
    return GameRegistry.instance;
  }

  /**
   * Enregistre un nouveau jeu dans le registre
   */
  public register(game: IGame): void {
    const id = game.id.toLowerCase();
    this.games.set(id, game);

    // Enregistrer les alias
    for (const alias of game.aliases) {
      this.aliases.set(alias.toLowerCase(), id);
    }

    logger.info(`[GameRegistry] Registered game: ${game.name} (id: ${id}, aliases: [${game.aliases.join(', ')}])`);
  }

  /**
   * Récupère un jeu par son identifiant ou un alias
   */
  public get(idOrAlias: string): IGame | undefined {
    const clean = idOrAlias.toLowerCase().trim();
    const id = this.aliases.get(clean) || clean;
    return this.games.get(id);
  }

  /**
   * Retourne tous les jeux enregistrés
   */
  public getAll(): IGame[] {
    return Array.from(this.games.values());
  }

  /**
   * Vérifie si un jeu existe
   */
  public has(idOrAlias: string): boolean {
    return this.get(idOrAlias) !== undefined;
  }
}

export default GameRegistry.getInstance();
