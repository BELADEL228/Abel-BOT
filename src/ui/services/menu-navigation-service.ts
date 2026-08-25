/**
 * Menu Navigation Service — Gestionnaire de navigation dynamique, carousels et permissions
 */

import pluginManager from '../../core/plugin-system/plugin-manager.js';
import { IPluginCommand } from '../../core/plugin-system/types.js';
import { UICard, UICarousel, UIList } from '../types/ui.types.js';
import { createCategoryCard } from '../components/CategoryCard.js';
import { createCommandCard } from '../components/CommandCard.js';
import { createStatusCard } from '../components/StatusCard.js';
import defaultTheme from '../themes/default.theme.js';

export class MenuNavigationService {
  private static instance: MenuNavigationService;

  private constructor() {}

  public static getInstance(): MenuNavigationService {
    if (!MenuNavigationService.instance) {
      MenuNavigationService.instance = new MenuNavigationService();
    }
    return MenuNavigationService.instance;
  }

  /**
   * Construit le menu principal sous forme de Carousel de catégories
   */
  public getMainMenuCarousel(isOwner: boolean = false, prefix: string = '.'): UICarousel {
    const categoriesMap = pluginManager.getCommandsByCategory();
    const sortedCategories = Array.from(categoriesMap.keys())
      .filter(cat => cat !== 'General' && cat !== 'Tools' && cat !== 'Developer')
      .sort();

    // Placer General et Tools à la suite
    if (categoriesMap.has('General')) sortedCategories.push('General');
    if (categoriesMap.has('Tools')) sortedCategories.push('Tools');
    if (isOwner && categoriesMap.has('Developer')) sortedCategories.push('Developer');

    const cards: UICard[] = [];

    // 1. Première carte : Tableau de bord
    cards.push(createStatusCard({ prefix, isOwner }));

    // 2. Cartes suivantes : Une carte par catégorie
    for (const cat of sortedCategories) {
      const cmds = categoriesMap.get(cat) || [];
      if (cmds.length === 0) continue;

      // Si l'utilisateur n'est pas owner et que toutes les commandes sont ownerOnly, sauter
      if (!isOwner && cmds.every(c => c.ownerOnly)) continue;

      cards.push(createCategoryCard({
        category: cat,
        commands: cmds,
        prefix,
        isOwner
      }));
    }

    return {
      title: '🌟 MENU PRINCIPAL ABEL-BOT',
      cards,
      footer: `Utilisez les boutons ci-dessous ou tapez ${prefix}menu <catégorie>`
    };
  }

  /**
   * Construit le Carousel des commandes pour une catégorie donnée
   */
  public getCategoryCarousel(category: string, isOwner: boolean = false, prefix: string = '.'): UICarousel | null {
    const categoriesMap = pluginManager.getCommandsByCategory();
    const foundCat = Array.from(categoriesMap.keys()).find(
      c => c.toLowerCase() === category.toLowerCase()
    );

    if (!foundCat) return null;

    const cmds = categoriesMap.get(foundCat) || [];
    const accessibleCmds = isOwner ? cmds : cmds.filter(c => !c.ownerOnly);

    if (accessibleCmds.length === 0) return null;

    const meta = defaultTheme.categories[foundCat] || {
      icon: '📂',
      title: foundCat.toUpperCase(),
      description: `Commandes de la catégorie ${foundCat}`
    };

    const cards: UICard[] = accessibleCmds.map(cmd => createCommandCard({ command: cmd, prefix }));

    return {
      title: `${meta.icon} MODULE : ${meta.title} (${accessibleCmds.length})`,
      cards,
      footer: `Tapez ${prefix}help <nom> pour plus de détails sur une commande.`
    };
  }

  /**
   * Construit la vue détaillée d'une commande
   */
  public getCommandDetailCard(commandName: string, prefix: string = '.'): UICard | null {
    const cmd = pluginManager.getCommand(commandName);
    if (!cmd) return null;

    return createCommandCard({ command: cmd, prefix });
  }

  /**
   * Construit une liste interactive de toutes les catégories
   */
  public getCategoriesList(isOwner: boolean = false, prefix: string = '.'): UIList {
    const categoriesMap = pluginManager.getCommandsByCategory();
    const rows = Array.from(categoriesMap.entries())
      .filter(([cat, cmds]) => {
        if (!isOwner && cmds.every(c => c.ownerOnly)) return false;
        return cmds.length > 0;
      })
      .map(([cat, cmds]) => {
        const meta = defaultTheme.categories[cat] || { icon: '📂', description: 'Module de commandes' };
        const accessible = isOwner ? cmds.length : cmds.filter(c => !c.ownerOnly).length;
        return {
          id: `${prefix}menu ${cat.toLowerCase()}`,
          title: `${meta.icon} ${cat}`,
          description: `${accessible} commandes • ${meta.description}`
        };
      });

    return {
      title: '📂 MODULES ET CATÉGORIES',
      description: 'Sélectionnez une catégorie ci-dessous pour afficher ses commandes :',
      buttonText: 'Choisir un module',
      sections: [
        {
          title: 'Modules disponibles',
          rows
        }
      ],
      footer: `Pour ouvrir directement : ${prefix}menu <nom-catégorie>`
    };
  }

  /**
   * Recherche dynamique de commandes par mot-clé
   */
  public searchCommands(query: string, isOwner: boolean = false, prefix: string = '.'): UICard {
    const allCmds = pluginManager.getAllCommands();
    const cleanQuery = query.toLowerCase().trim();

    const matches = allCmds.filter(c => {
      if (!isOwner && c.ownerOnly) return false;
      const nameMatch = c.name.toLowerCase().includes(cleanQuery);
      const descMatch = c.description.toLowerCase().includes(cleanQuery);
      const aliasMatch = c.aliases?.some(a => a.toLowerCase().includes(cleanQuery));
      return nameMatch || descMatch || aliasMatch;
    });

    if (matches.length === 0) {
      return {
        title: '🔍 RÉSULTAT DE RECHERCHE',
        body: `❌ Aucune commande trouvée pour le terme *"${query}"*.\n\n💡 _Tapez \`${prefix}menu\` pour explorer tous les modules disponibles._`,
        footer: 'Essayez un autre mot-clé (ex: ai, download, group)'
      };
    }

    const sample = matches.slice(0, 8).map(c => {
      return `• \`${prefix}${c.name}\` — ${c.description}`;
    }).join('\n');

    const extra = matches.length > 8 ? `\n\n_... et ${matches.length - 8} autre(s) résultat(s)_` : '';

    return {
      title: `🔍 RÉSULTATS POUR "${query.toUpperCase()}"`,
      body: `Trouvé *${matches.length} commande(s)* correspondante(s) :\n\n${sample}${extra}`,
      footer: `Tapez ${prefix}help <nom> pour voir les détails d'une commande.`
    };
  }
}

export default MenuNavigationService.getInstance();
