/**
 * Text Card Builder — Générateur de cartes et carousels textuels haute-fidélité
 * Utilisé pour le fallback automatique et les clients WhatsApp ne supportant pas les carousels interactifs
 */

import { UICard, UICarousel, UIList } from '../types/ui.types.js';
import defaultTheme from '../themes/default.theme.js';

export class TextCardBuilder {
  /**
   * Rend une UICard unitaire en texte stylisé avec bordures Unicode
   */
  public static renderCard(card: UICard): string {
    const { borders, icons } = defaultTheme;
    const lines: string[] = [];

    // Header / Title Box
    const headerTitle = card.title ? ` ${card.title.toUpperCase()} ` : ' ABEL-BOT ';
    lines.push(`${borders.topLeft}${borders.horizontal.repeat(3)}〔 ${headerTitle}〕${borders.horizontal.repeat(3)}${borders.topRight}`);

    if (card.subtitle) {
      lines.push(`${borders.vertical} _${card.subtitle}_`);
      lines.push(`${borders.vertical}`);
    }

    // Body content (split multi-line)
    const bodyLines = card.body.split('\n');
    for (const bLine of bodyLines) {
      lines.push(`${borders.vertical} ${bLine}`);
    }

    // Interactive action buttons simulation in text
    if (card.buttons && card.buttons.length > 0) {
      lines.push(`${borders.vertical}`);
      lines.push(`${borders.leftT}${borders.horizontal.repeat(4)}〔 ACTIONS DISPONIBLES 〕${borders.horizontal.repeat(4)}${borders.rightT}`);
      for (const btn of card.buttons) {
        if (btn.type === 'cta_url') {
          lines.push(`${borders.vertical} 🔗 *[ ${btn.displayText} ]* → ${btn.url}`);
        } else if (btn.type === 'cta_copy') {
          lines.push(`${borders.vertical} 📋 *[ ${btn.displayText} ]* : \`${btn.copyCode || btn.displayText}\``);
        } else {
          lines.push(`${borders.vertical} 🔘 *[ ${btn.displayText} ]* ➔ \`${btn.id || btn.displayText}\``);
        }
      }
    }

    // Footer
    if (card.footer) {
      lines.push(`${borders.vertical}`);
      lines.push(`${borders.vertical} 💡 _${card.footer}_`);
    }

    lines.push(`${borders.bottomLeft}${borders.horizontal.repeat(28)}${borders.bottomRight}`);
    return lines.join('\n');
  }

  /**
   * Rend un UICarousel en séquence de cartes paginées
   */
  public static renderCarousel(carousel: UICarousel): string {
    const { borders, icons } = defaultTheme;
    const out: string[] = [];

    if (carousel.title) {
      out.push(`╭━━━━━━〔 ${carousel.title.toUpperCase()} 〕━━━━━━╮`);
      out.push(`┃ 📑 *${carousel.cards.length} modules disponibles*`);
      out.push(`╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`);
    }

    for (let i = 0; i < carousel.cards.length; i++) {
      const card = carousel.cards[i];
      const pageTag = `[ ${i + 1}/${carousel.cards.length} ]`;
      
      out.push(`╭━━〔 ${icons.primary} ${card.title} ${pageTag} 〕━━╮`);
      if (card.subtitle) {
        out.push(`┃ _${card.subtitle}_`);
      }
      
      const bodyLines = card.body.split('\n');
      for (const bLine of bodyLines) {
        out.push(`┃ ${bLine}`);
      }

      if (card.buttons && card.buttons.length > 0) {
        out.push(`┃`);
        for (const btn of card.buttons) {
          if (btn.type === 'cta_url') {
            out.push(`┃ 🔗 ${btn.displayText}: ${btn.url}`);
          } else {
            out.push(`┃ 🔘 \`${btn.id || btn.displayText}\` — ${btn.displayText}`);
          }
        }
      }

      out.push(`╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`);
    }

    if (carousel.footer) {
      out.push(`_💡 ${carousel.footer}_`);
    }

    return out.join('\n').trim();
  }

  /**
   * Rend une UIList en menu hiérarchique clair
   */
  public static renderList(list: UIList): string {
    const { borders, icons } = defaultTheme;
    const lines: string[] = [];

    lines.push(`╭━━━━━━〔 ${list.title.toUpperCase()} 〕━━━━━━╮`);
    lines.push(`┃ ${list.description}`);
    lines.push(`╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n`);

    for (const section of list.sections) {
      lines.push(`📂 *${section.title.toUpperCase()}*`);
      for (let i = 0; i < section.rows.length; i++) {
        const row = section.rows[i];
        const isLast = i === section.rows.length - 1;
        const prefix = isLast ? ' └─ ' : ' ├─ ';
        const desc = row.description ? ` — _${row.description}_` : '';
        lines.push(`${prefix}\`${row.id}\` *${row.title}*${desc}`);
      }
      lines.push('');
    }

    if (list.footer) {
      lines.push(`_💡 ${list.footer}_`);
    }

    return lines.join('\n').trim();
  }
}

export default TextCardBuilder;
