/**
 * Interactive Builder — Encodeur Protobuf pour WhatsApp Interactive Messages
 * Supporte : CarouselMessage (cartes horizontales), NativeFlowMessage (boutons) et SingleSelect (listes)
 */

import { proto, prepareWAMessageMedia } from '@whiskeysockets/baileys';
import { UICard, UICarousel, UIList, UIButton } from '../types/ui.types.js';

export class InteractiveBuilder {
  /**
   * Convertit un tableau de boutons UI abstraits en boutons NativeFlow WhatsApp
   */
  public static buildNativeButtons(buttons?: UIButton[]): proto.Message.InteractiveMessage.NativeFlowMessage.INativeFlowButton[] {
    if (!buttons || buttons.length === 0) return [];

    return buttons.map(btn => {
      if (btn.type === 'cta_url') {
        return {
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: btn.displayText,
            url: btn.url || 'https://whatsapp.com',
            merchant_url: btn.url || 'https://whatsapp.com'
          })
        };
      }

      if (btn.type === 'cta_copy') {
        return {
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({
            display_text: btn.displayText,
            id: btn.id || btn.copyCode || 'copy_btn',
            copy_code: btn.copyCode || btn.displayText
          })
        };
      }

      if (btn.type === 'cta_call') {
        return {
          name: 'cta_call',
          buttonParamsJson: JSON.stringify({
            display_text: btn.displayText,
            phone_number: btn.phoneNumber || ''
          })
        };
      }

      // Default: quick_reply
      return {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: btn.displayText,
          id: btn.id || btn.displayText
        })
      };
    });
  }

  /**
   * Construit une carte InteractiveMessage unitaire
   */
  public static buildSingleCard(card: UICard): proto.Message.IInteractiveMessage {
    const nativeButtons = this.buildNativeButtons(card.buttons);

    const interactiveMessage: proto.Message.IInteractiveMessage = {
      body: proto.Message.InteractiveMessage.Body.create({
        text: card.body
      }),
      footer: card.footer
        ? proto.Message.InteractiveMessage.Footer.create({ text: card.footer })
        : undefined,
      nativeFlowMessage: nativeButtons.length > 0
        ? proto.Message.InteractiveMessage.NativeFlowMessage.create({
            buttons: nativeButtons,
            messageVersion: 1
          })
        : undefined
    };

    if (card.title || card.subtitle) {
      interactiveMessage.header = proto.Message.InteractiveMessage.Header.create({
        title: card.title,
        subtitle: card.subtitle,
        hasMediaAttachment: false
      });
    }

    return interactiveMessage;
  }

  /**
   * Construit un CarouselMessage horizontal composé de plusieurs cartes
   */
  public static buildCarousel(carousel: UICarousel): proto.Message.IInteractiveMessage {
    const cardMessages: proto.Message.IInteractiveMessage[] = carousel.cards.map((card, index) => {
      const nativeButtons = this.buildNativeButtons(card.buttons);

      const itemCard: proto.Message.IInteractiveMessage = {
        body: proto.Message.InteractiveMessage.Body.create({
          text: card.body
        }),
        footer: card.footer
          ? proto.Message.InteractiveMessage.Footer.create({ text: card.footer })
          : proto.Message.InteractiveMessage.Footer.create({ text: `Carte ${index + 1}/${carousel.cards.length}` }),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
          buttons: nativeButtons.length > 0
            ? nativeButtons
            : [
                {
                  name: 'quick_reply',
                  buttonParamsJson: JSON.stringify({
                    display_text: 'Ouvrir',
                    id: `.help ${card.title.toLowerCase()}`
                  })
                }
              ],
          messageVersion: 1
        })
      };

      if (card.title || card.subtitle) {
        itemCard.header = proto.Message.InteractiveMessage.Header.create({
          title: card.title,
          subtitle: card.subtitle,
          hasMediaAttachment: false
        });
      }

      return itemCard;
    });

    const rootMessage: proto.Message.IInteractiveMessage = {
      body: proto.Message.InteractiveMessage.Body.create({
        text: carousel.title || 'Navigation Interactive Abel-Bot'
      }),
      footer: carousel.footer
        ? proto.Message.InteractiveMessage.Footer.create({ text: carousel.footer })
        : proto.Message.InteractiveMessage.Footer.create({ text: 'Glissez horizontalement pour naviguer ‹ ›' }),
      carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
        cards: cardMessages,
        messageVersion: 1
      })
    };

    return rootMessage;
  }

  /**
   * Construit une liste interactive moderne avec sélecteur NativeFlow (single_select)
   */
  public static buildList(list: UIList): proto.Message.IInteractiveMessage {
    const sections = list.sections.map(sec => ({
      title: sec.title,
      rows: sec.rows.map(r => ({
        header: r.highlightText || '',
        title: r.title,
        description: r.description || '',
        id: r.id
      }))
    }));

    const buttonParamsJson = JSON.stringify({
      title: list.buttonText,
      sections
    });

    const rootMessage: proto.Message.IInteractiveMessage = {
      body: proto.Message.InteractiveMessage.Body.create({
        text: list.description
      }),
      footer: list.footer
        ? proto.Message.InteractiveMessage.Footer.create({ text: list.footer })
        : undefined,
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: [
          {
            name: 'single_select',
            buttonParamsJson
          }
        ],
        messageVersion: 1
      })
    };

    if (list.title) {
      rootMessage.header = proto.Message.InteractiveMessage.Header.create({
        title: list.title,
        hasMediaAttachment: false
      });
    }

    return rootMessage;
  }
}

export default InteractiveBuilder;
