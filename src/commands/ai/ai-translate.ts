/**
 * ✅ ai-translate.ts AMÉLIORÉ v2.0
 * 
 * AMÉLIORATIONS:
 * - Peut utiliser le contexte de conversation (optionnel)
 * - Meilleures traductions grâce au contexte
 * - Réponses plus naturelles en ton/registre
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import aiService from '../../services/ai/ai-service.js';
import contextManager from '../../services/automation/context-manager.js';
import logger from '../../core/logger/logger.js';

const AiTranslateCommand: IPluginCommand = {
  name: 'translate',
  aliases: [
    'translate2', 'rewrite', 'correct', 'reply', 'replyformal', 
    'replycasual', 'replyromantic', 'paraphrase', 'grammar'
  ],
  category: 'AI',
  description: 'Traduction, correction grammaticale, réécriture et adaptation du ton de réponse par IA.',
  usage: '.translate <langue> <texte> | .replyformal <message> | .correct <texte>',
  cooldown: 4,
  permissions: ['canUseAI'],

  async execute(ctx: CommandContext) {
    const sub = ctx.commandName;
    const textToProcess = ctx.args.join(' ') || ctx.message.quotedMessage?.text;

    if (!textToProcess) {
      await ctx.reply(
        `⚠️ *Veuillez fournir un texte ou répondre à un message.*\n\n` +
        `Exemples:\n` +
        `• \`.translate anglais Bonjour, comment ça va?\`\n` +
        `• \`.replyformal Merci beaucoup!\`\n` +
        `• \`.correct Je suis allez au parc\``
      );
      return;
    }

    await ctx.provider.sendPresence(ctx.chat.id, 'composing');

    // ✅ RÉCUPÉRER LE CONTEXTE OPTIONNEL
    const contextText = contextManager.getPreviousContextFormatted(ctx.chat.id);
    const hasContext = contextText && contextText.length > 0;

    try {
      // ── REPLY EN TON ADAPTÉ ──────────────────────────────────────────────
      if (sub.startsWith('reply')) {
        const toneMap: Record<string, string> = {
          replyformal: 'formel et professionnel',
          replycasual: 'décontracté et amical',
          replyromantic: 'doux et affectueux',
          reply: 'neutre et respectueux'
        };

        const tone = toneMap[sub] || 'neutre';
        
        let prompt = `Génère une réponse adaptée au ton ${tone} pour le message suivant :\n"${textToProcess}"`;
        
        // ✅ Ajouter le contexte si disponible
        if (hasContext) {
          prompt = `[CONTEXTE DE CONVERSATION]\n${contextText}\n\n[MESSAGE À RÉPONDRE]\n${textToProcess}\n\n[INSTRUCTION]\nGénère une réponse en ton ${tone}.`;
        }

        const response = await aiService.generateText(prompt);
        await ctx.reply(`✨ *RÉPONSE ADAPTÉE (${tone.toUpperCase()}) :*\n\n${response}`);
        return;
      }

      // ── CORRECTION GRAMMATICALE ──────────────────────────────────────────
      if (sub === 'correct' || sub === 'grammar') {
        let prompt = `Corrige la grammaire, l'orthographe et reformule le texte suivant en français impeccable :\n"${textToProcess}"`;
        
        if (hasContext) {
          prompt = `[CONTEXTE]\n${contextText}\n\n[TEXTE À CORRIGER]\n"${textToProcess}"\n\n[INSTRUCTION]\nCorrige et reformule en français parfait.`;
        }

        const response = await aiService.generateText(prompt);
        await ctx.reply(`✍️ *TEXTE REFORMULÉ & CORRIGÉ :*\n\n${response}`);
        return;
      }

      // ── RÉÉCRITURE ───────────────────────────────────────────────────────
      if (sub === 'rewrite' || sub === 'paraphrase') {
        let prompt = `Réécris le texte suivant de manière plus claire et élégante :\n"${textToProcess}"`;
        
        if (hasContext) {
          prompt = `[CONTEXTE]\n${contextText}\n\n[TEXTE À RÉÉCRIRE]\n"${textToProcess}"\n\n[INSTRUCTION]\nRéécris de manière plus claire et élégante.`;
        }

        const response = await aiService.generateText(prompt);
        await ctx.reply(`📝 *TEXTE RÉÉCRIT :*\n\n${response}`);
        return;
      }

      // ── TRADUCTION (Défaut) ──────────────────────────────────────────────
      const targetLang = ctx.args[0]?.toLowerCase() || 'anglais';
      const content = ctx.args.slice(1).join(' ') || textToProcess;

      let prompt = `Traduis le texte suivant en ${targetLang} :\n"${content}"`;
      
      // ✅ Ajouter le contexte si disponible pour une meilleure traduction
      if (hasContext) {
        prompt = `[CONTEXTE DE CONVERSATION]\n${contextText}\n\n[TEXTE À TRADUIRE]\n"${content}"\n\n[INSTRUCTION]\nTraduis en ${targetLang} en tenant compte du contexte.`;
      }

      const translation = await aiService.generateText(prompt);
      await ctx.reply(`🌐 *TRADUCTION (${targetLang.toUpperCase()}) :*\n\n${translation}`);
    } catch (err) {
      logger.error({ error: err }, `[AiTranslateCommand] Failed for sub=${sub}`);
      await ctx.reply(`❌ Erreur : ${(err as Error).message}`);
    }
  }
};

export default AiTranslateCommand;