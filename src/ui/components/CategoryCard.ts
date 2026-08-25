/**
 * Category Card Component — Carte visuelle représentant une catégorie de commandes
 */

import { UICard, UIButton } from '../types/ui.types.js';
import { IPluginCommand } from '../../core/plugin-system/types.js';
import defaultTheme from '../themes/default.theme.js';

export interface CategoryCardProps {
  category: string;
  commands: IPluginCommand[];
  prefix?: string;
  isOwner?: boolean;
}

export function createCategoryCard(props: CategoryCardProps): UICard {
  const { category, commands, prefix = '.', isOwner = false } = props;
  const meta = defaultTheme.categories[category] || {
    icon: '📁',
    title: category.toUpperCase(),
    description: `Commandes de la catégorie ${category}`,
    badge: category
  };

  // Filtrer les commandes selon le rôle si restreint
  const accessibleCmds = isOwner
    ? commands
    : commands.filter(c => !c.ownerOnly);

  const total = accessibleCmds.length;
  const sampleCommands = accessibleCmds
    .slice(0, 4)
    .map(c => `• \`${prefix}${c.name}\``)
    .join('\n');

  const extraCount = total > 4 ? `\n_... et ${total - 4} autre(s) commande(s)_` : '';

  const body =
    `📝 ${meta.description}\n\n` +
    `📊 *${total} commande(s) disponible(s)*\n\n` +
    `*Aperçu :*\n${sampleCommands}${extraCount}`;

  const buttons: UIButton[] = [
    {
      type: 'quick_reply',
      displayText: `📂 Ouvrir ${category}`,
      id: `${prefix}menu ${category.toLowerCase()}`
    },
    {
      type: 'quick_reply',
      displayText: `❓ Aide globale`,
      id: `${prefix}help`
    }
  ];

  return {
    title: `${meta.icon} ${meta.title}`,
    subtitle: `Module [ ${meta.badge} ]`,
    body,
    footer: `Tapez ${prefix}menu ${category.toLowerCase()} pour explorer`,
    buttons,
    metadata: { category, count: total }
  };
}

export default createCategoryCard;
