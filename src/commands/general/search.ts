/**
 * Search Command — Recherche interactive de commandes par mot-clé
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import menuNavigationService from '../../ui/services/menu-navigation-service.js';
import uiRenderer from '../../ui/adapters/ui-renderer.js';
import { config } from '../../config/env.js';

const SearchCommand: IPluginCommand = {
  name: 'search',
  aliases: ['find', 'trouver', 'searchcmd'],
  category: 'General',
  description: 'Rechercher une commande par son nom ou sa description.',
  usage: '.search <mot-clé>',
  cooldown: 2,

  async execute(ctx: CommandContext) {
    const query = ctx.args.join(' ').trim();
    const isOwner = Boolean(ctx.sender.isOwner || ctx.sender.isSudo);
    const p = config.botPrefix;

    if (!query) {
      await ctx.reply(`⚠️ Veuillez préciser un mot-clé à rechercher.\n\nExemple : \`${p}search audio\` ou \`${p}search groupe\``);
      return;
    }

    const card = menuNavigationService.searchCommands(query, isOwner, p);
    await uiRenderer.renderCard(ctx, card);
  }
};

export default SearchCommand;
