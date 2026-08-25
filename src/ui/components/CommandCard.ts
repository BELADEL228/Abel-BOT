/**
 * Command Card Component — Carte détaillée pour une commande spécifique
 */

import { UICard, UIButton } from '../types/ui.types.js';
import { IPluginCommand } from '../../core/plugin-system/types.js';
import defaultTheme from '../themes/default.theme.js';

export interface CommandCardProps {
  command: IPluginCommand;
  prefix?: string;
}

export function createCommandCard(props: CommandCardProps): UICard {
  const { command, prefix = '.' } = props;
  const { icons } = defaultTheme;

  const categoryMeta = defaultTheme.categories[command.category] || { icon: '⚙️' };
  const aliases = command.aliases && command.aliases.length > 0
    ? command.aliases.map(a => `\`${prefix}${a}\``).join(', ')
    : 'Aucun';

  const accessLabel = command.ownerOnly
    ? '🔒 Restreint (Propriétaire)'
    : (command.userAdminRequired ? '👑 Administrateur Groupe' : '🟢 Tout le monde');

  const scopeLabel = command.groupOnly
    ? '👥 Groupes uniquement'
    : (command.privateOnly ? '👤 Messages privés uniquement' : '🌐 Partout');

  const body =
    `📌 *Description :*\n${command.description}\n\n` +
    `⚡ *Utilisation & Syntaxe :*\n\`${command.usage}\`\n\n` +
    `🔐 *Accès :* ${accessLabel}\n` +
    `📍 *Contexte :* ${scopeLabel}\n` +
    `⏱️ *Cooldown :* ${command.cooldown || 3}s\n` +
    `🏷️ *Alias :* ${aliases}`;

  const buttons: UIButton[] = [
    {
      type: 'quick_reply',
      displayText: `✨ Tester ${prefix}${command.name}`,
      id: `${prefix}${command.name}`
    },
    {
      type: 'quick_reply',
      displayText: `📂 Catégorie ${command.category}`,
      id: `${prefix}menu ${command.category.toLowerCase()}`
    },
    {
      type: 'quick_reply',
      displayText: `🏠 Menu Principal`,
      id: `${prefix}menu`
    }
  ];

  return {
    title: `${categoryMeta.icon} .${command.name.toUpperCase()}`,
    subtitle: `Module : ${command.category}`,
    body,
    footer: `Syntaxe : ${command.usage}`,
    buttons,
    metadata: { command: command.name, category: command.category }
  };
}

export default createCommandCard;
