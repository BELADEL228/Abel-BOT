/**
 * WhatsApp Game Renderer — Rendu visuel soigné des plateaux de jeux et des statuts
 */

import { GameView, GamePlayer } from '../core/types.js';
import { UICard, UIButton } from '../../ui/types/ui.types.js';
import defaultTheme from '../../ui/themes/default.theme.js';

export class WhatsAppGameRenderer {
  /**
   * Convertit un GameView en UICard pour l'adaptateur UI
   */
  public static toUICard(view: GameView): UICard {
    const { borders, icons } = defaultTheme;

    let body = '';

    if (view.boardText) {
      body += `${view.boardText}\n\n`;
    }

    if (view.statusText) {
      body += `📢 *Statut :*\n${view.statusText}\n\n`;
    }

    if (view.instructionText && !view.isGameOver) {
      body += `💡 *Comment jouer :*\n_${view.instructionText}_`;
    }

    const defaultButtons: UIButton[] = view.buttons || [];
    if (!view.isGameOver && defaultButtons.length === 0) {
      defaultButtons.push({
        type: 'quick_reply',
        displayText: '🏳️ Abandonner',
        id: '.surrender'
      });
    }

    return {
      title: view.title,
      subtitle: view.subtitle,
      body: body.trim(),
      footer: view.footerText || (view.isGameOver ? 'Partie terminée.' : 'Tapez votre coup directement dans le chat !'),
      buttons: defaultButtons
    };
  }

  /**
   * Convertit un GameView en chaîne de texte stylisée pour WhatsApp
   */
  public static toFormattedText(view: GameView): string {
    const { borders } = defaultTheme;
    const lines: string[] = [];

    lines.push(`╭━━━〔 🎮 ${view.title.toUpperCase()} 〕━━━╮`);
    if (view.subtitle) {
      lines.push(`┃ _${view.subtitle}_`);
      lines.push(`┃`);
    }

    if (view.boardText) {
      const boardLines = view.boardText.split('\n');
      for (const bl of boardLines) {
        lines.push(`┃ ${bl}`);
      }
      lines.push(`┃`);
    }

    if (view.statusText) {
      lines.push(`┃ 📢 ${view.statusText}`);
      lines.push(`┃`);
    }

    if (view.instructionText && !view.isGameOver) {
      lines.push(`┃ 💡 _${view.instructionText}_`);
      lines.push(`┃`);
    }

    if (view.footerText) {
      lines.push(`┃ ℹ️ ${view.footerText}`);
    } else if (!view.isGameOver) {
      lines.push(`┃ 💬 _Tapez votre action ou .surrender pour quitter_`);
    }

    lines.push(`╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`);
    return lines.join('\n');
  }
}

export default WhatsAppGameRenderer;
