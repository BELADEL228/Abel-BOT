/**
 * Categories Command — Explorateur de catégories et modules
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import menuNavigationService from '../../ui/services/menu-navigation-service.js';
import uiRenderer from '../../ui/adapters/ui-renderer.js';
import { config } from '../../config/env.js';

const CategoriesCommand: IPluginCommand = {
  name: 'categories',
  aliases: ['cats', 'modules'],
  category: 'General',
  description: 'Affiche la liste interactive de tous les modules disponibles.',
  usage: '.categories | .categories <nom>',
  cooldown: 2,

  async execute(ctx: CommandContext) {
    const targetCat = ctx.args[0]?.toLowerCase();
    const isOwner = Boolean(ctx.sender.isOwner || ctx.sender.isSudo);
    const p = config.botPrefix;

    if (targetCat) {
      const carousel = menuNavigationService.getCategoryCarousel(targetCat, isOwner, p);
      if (carousel) {
        await uiRenderer.renderCarousel(ctx, carousel);
        return;
      }
    }

    const list = menuNavigationService.getCategoriesList(isOwner, p);
    await uiRenderer.renderList(ctx, list);
  }
};

export default CategoriesCommand;
