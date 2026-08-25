/**
 * UI Renderer — Adaptateur de rendu unifié avec Fallback Cascade Automatique
 * Essaie en priorité le rendu interactif Protobuf (Carousel, Cards, NativeFlow)
 * et bascule de manière transparente sur le rendu textuel haute-fidélité en cas d'erreur.
 */

import { CommandContext } from '../../core/plugin-system/types.js';
import { UICard, UICarousel, UIList, RenderOptions } from '../types/ui.types.js';
import InteractiveBuilder from '../builders/interactive.builder.js';
import TextCardBuilder from '../builders/text-card.builder.js';
import logger from '../../core/logger/logger.js';

export class UIRenderer {
  private static instance: UIRenderer;

  private constructor() {}

  public static getInstance(): UIRenderer {
    if (!UIRenderer.instance) {
      UIRenderer.instance = new UIRenderer();
    }
    return UIRenderer.instance;
  }

  /**
   * Rend et envoie une carte unique
   */
  public async renderCard(ctx: CommandContext, card: UICard, options?: RenderOptions): Promise<void> {
    if (options?.forceText) {
      await this.sendTextCardFallback(ctx, card, options);
      return;
    }

    try {
      const interactiveMsg = InteractiveBuilder.buildSingleCard(card);
      await ctx.replyInteractive(interactiveMsg, { mentions: options?.mentions });
    } catch (err: any) {
      logger.warn(
        { error: err.message || err, cardTitle: card.title },
        '[UIRenderer] Interactive card send failed, falling back to text card.'
      );
      await this.sendTextCardFallback(ctx, card, options);
    }
  }

  /**
   * Rend et envoie un Carousel horizontal
   */
  public async renderCarousel(ctx: CommandContext, carousel: UICarousel, options?: RenderOptions): Promise<void> {
    if (options?.forceText || carousel.cards.length === 0) {
      await this.sendTextCarouselFallback(ctx, carousel, options);
      return;
    }

    try {
      const interactiveMsg = InteractiveBuilder.buildCarousel(carousel);
      await ctx.replyInteractive(interactiveMsg, { mentions: options?.mentions });
    } catch (err: any) {
      logger.warn(
        { error: err.message || err, cardsCount: carousel.cards.length },
        '[UIRenderer] Interactive carousel send failed, falling back to text carousel.'
      );
      await this.sendTextCarouselFallback(ctx, carousel, options);
    }
  }

  /**
   * Rend et envoie une liste interactive (single_select)
   */
  public async renderList(ctx: CommandContext, list: UIList, options?: RenderOptions): Promise<void> {
    if (options?.forceText) {
      await this.sendTextListFallback(ctx, list, options);
      return;
    }

    try {
      const interactiveMsg = InteractiveBuilder.buildList(list);
      await ctx.replyInteractive(interactiveMsg, { mentions: options?.mentions });
    } catch (err: any) {
      logger.warn(
        { error: err.message || err, listTitle: list.title },
        '[UIRenderer] Interactive list send failed, falling back to text list.'
      );
      await this.sendTextListFallback(ctx, list, options);
    }
  }

  // ── Fallbacks ──────────────────────────────────────────────────────────────

  private async sendTextCardFallback(ctx: CommandContext, card: UICard, options?: RenderOptions): Promise<void> {
    const text = TextCardBuilder.renderCard(card);
    await ctx.reply(text, { mentions: options?.mentions });
  }

  private async sendTextCarouselFallback(ctx: CommandContext, carousel: UICarousel, options?: RenderOptions): Promise<void> {
    const text = TextCardBuilder.renderCarousel(carousel);
    await ctx.reply(text, { mentions: options?.mentions });
  }

  private async sendTextListFallback(ctx: CommandContext, list: UIList, options?: RenderOptions): Promise<void> {
    const text = TextCardBuilder.renderList(list);
    await ctx.reply(text, { mentions: options?.mentions });
  }
}

export default UIRenderer.getInstance();
