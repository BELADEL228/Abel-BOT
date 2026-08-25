/**
 * Help / Menu Command — Interface Utilisateur Moderne WhatsApp pour Abel-Bot
 * Supporte : Carousel interactif, boutons NativeFlow, cartes catégorisées & Fallback texte automatique
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import menuNavigationService from '../../ui/services/menu-navigation-service.js';
import uiRenderer from '../../ui/adapters/ui-renderer.js';
import { config } from '../../config/env.js';

const HelpCommand: IPluginCommand = {
  name: 'help',
  aliases: ['menu', 'cmds', 'bot', 'commands', 'aide', 'menus'],
  category: 'General',
  description: 'Affiche le menu interactif du bot avec carousels, cartes et actions.',
  usage: '.menu | .menu <catégorie> | .help <commande> | .menu text',
  cooldown: 2,

  async execute(ctx: CommandContext) {
    const query = ctx.args[0]?.toLowerCase();
    const isOwner = Boolean(ctx.sender.isOwner || ctx.sender.isSudo);
    const p = config.botPrefix;

    // ── 1. MAIN MENU (CAROUSEL PRINCIPAL DES MODULES) ──────────────────────────
    if (!query) {
      const carousel = menuNavigationService.getMainMenuCarousel(isOwner, p);
      await uiRenderer.renderCarousel(ctx, carousel);
      return;
    }

    // ── 2. FORCED TEXT MENU (Si l'utilisateur demande explicitement .menu text) ──
    if (query === 'text' || query === 'texte' || query === 'classic') {
      const carousel = menuNavigationService.getMainMenuCarousel(isOwner, p);
      await uiRenderer.renderCarousel(ctx, carousel, { forceText: true });
      return;
    }

    // ── 3. LIST OF CATEGORIES (.menu list / .menu cats) ────────────────────────
    if (query === 'list' || query === 'liste' || query === 'categories' || query === 'cats') {
      const list = menuNavigationService.getCategoriesList(isOwner, p);
      await uiRenderer.renderList(ctx, list);
      return;
    }

    // ── 4. CATEGORY VIEW (.menu ai, .menu download, .menu group, etc.) ─────────
    const categoryCarousel = menuNavigationService.getCategoryCarousel(query, isOwner, p);
    if (categoryCarousel) {
      await uiRenderer.renderCarousel(ctx, categoryCarousel);
      return;
    }

    // ── 5. SINGLE COMMAND DETAIL VIEW (.help song, .help summarize, etc.) ───────
    const commandCard = menuNavigationService.getCommandDetailCard(query, p);
    if (commandCard) {
      await uiRenderer.renderCard(ctx, commandCard);
      return;
    }

    // ── 6. DYNAMIC SEARCH FALLBACK (.help <mot-clé inconnu>) ───────────────────
    const searchCard = menuNavigationService.searchCommands(query, isOwner, p);
    await uiRenderer.renderCard(ctx, searchCard);
  }
};

export default HelpCommand;