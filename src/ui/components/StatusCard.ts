/**
 * Status Card Component — Tableau de bord / Dashboard du bot
 */

import { UICard, UIButton } from '../types/ui.types.js';
import { botState } from '../../core/state/bot-state.js';
import autoReplyConfig from '../../services/automation/auto-reply-config.js';
import autoReplyEngine from '../../services/automation/auto-reply-engine.js';
import sessionManager from '../../core/bot/session-manager.js';
import pluginManager from '../../core/plugin-system/plugin-manager.js';

export interface StatusCardProps {
  prefix?: string;
  isOwner?: boolean;
}

export function createStatusCard(props: StatusCardProps = {}): UICard {
  const { prefix = '.', isOwner = false } = props;

  const isArActive = autoReplyConfig.isActive();
  const arBadge = isArActive
    ? (autoReplyConfig.state === 'PAUSED' ? '⏸️ En pause' : `🟢 Actif [${autoReplyConfig.state}]`)
    : '🔴 Désactivé';

  const aiBadge = autoReplyEngine?.isAiEnabled ? '🟢 Opérationnel' : '🔴 Inactif';
  const modeBadge = botState.mode === 'PUBLIC'
    ? '🟢 Public'
    : (botState.mode === 'PRIVATE' ? '🔒 Privé' : '🚧 Maintenance');

  const sessionsCount = sessionManager.getAllSessions().length;
  const totalCommands = pluginManager.getAllCommands().length;

  const body =
    `╭━━〔 📊 TABLEAU DE BORD 〕━━╮\n` +
    `┃ • *Statut :* 🟢 En ligne\n` +
    `┃ • *Mode d'accès :* ${modeBadge}\n` +
    `┃ • *Auto-Reply :* ${arBadge}\n` +
    `┃ • *Moteur IA :* ${aiBadge} (Gemini 2.5)\n` +
    `┃ • *Sessions WhatsApp :* 🟢 ${sessionsCount} active(s)\n` +
    `┃ • *Commandes totales :* ${totalCommands} disponibles\n` +
    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

  const buttons: UIButton[] = [
    {
      type: 'quick_reply',
      displayText: '📂 Menu des Modules',
      id: `${prefix}menu`
    },
    {
      type: 'quick_reply',
      displayText: '🏓 Tester le Ping',
      id: `${prefix}ping`
    }
  ];

  if (isOwner) {
    buttons.push({
      type: 'quick_reply',
      displayText: '👑 Menu Admin',
      id: `${prefix}ownermenu`
    });
  }

  return {
    title: '🤖 ABEL-BOT · TABLEAU DE BORD',
    subtitle: 'Assistant WhatsApp Intelligent Multi-Session',
    body,
    footer: `Version 1.0.0 · Préfixe actif: ${prefix}`,
    buttons
  };
}

export default createStatusCard;
