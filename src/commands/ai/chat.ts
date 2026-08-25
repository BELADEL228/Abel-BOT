/**
 * ✅ chat.ts AMÉLIORÉ v2.0
 * 
 * AMÉLIORATIONS:
 * - Utilise l'historique pour le contexte
 * - L'IA a une meilleure compréhension des conversations précédentes
 * - Réponses plus intelligentes et contextuelle
 * - Fallback sans contexte si historique vide
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import aiService from '../../services/ai/ai-service.js';
import contextManager from '../../services/automation/context-manager.js';
import logger from '../../core/logger/logger.js';

const AiChatCommand: IPluginCommand = {
  name: 'ai',
  aliases: [
    'chat', 'gpt', 'gemini', 'chatbot', 'deep', 'deepseek', 'doppleai',
    'programming', 'teach', 'explain', 'code', 'ask',
    'extract', 'aitasks', 'question', 'qa'
  ],
  category: 'AI',
  description: 'Discussion IA intelligente : posez des questions et obtenez des réponses contextuelles. Explication, code, extraction de tâches.',
  usage: '.ai <question> | .explain <concept> | .code <langage> <description> | .tasks <texte>',
  cooldown: 5,
  permissions: ['canUseAI'],

  async execute(ctx: CommandContext) {
    const sub = ctx.commandName;
    const userText = ctx.args.join(' ') || ctx.message.quotedMessage?.text;

    if (!userText) {
      await ctx.reply(
        `⚠️ *Veuillez fournir une question ou un texte.*\n\n` +
        `Exemples:\n` +
        `• \`.ai Explique-moi le machine learning\`\n` +
        `• \`.code javascript une fonction qui calcule la somme\`\n` +
        `• \`.tasks Lire le rapport, faire un résumé, envoyer email\``
      );
      return;
    }

    await ctx.provider.sendPresence(ctx.chat.id, 'composing');

    // ✅ RÉCUPÉRER LE CONTEXTE HISTORIQUE
    const contextText = contextManager.getPreviousContextFormatted(ctx.chat.id);
    const hasContext = contextText && contextText.length > 0;

    let prompt = userText;
    let prefix = '🤖 *RÉPONSE IA :*\n\n';
    let systemInstruction = 'Tu es un assistant IA utile, bienveillant et honnête. Réponds en français.';

    // ✅ CONSTRUIRE LE PROMPT AVEC CONTEXTE
    switch (sub) {
      case 'explain':
      case 'teach':
        systemInstruction = 'Tu es un excellent pédagogue. Explique les concepts de manière claire, avec des exemples concrets.';
        prompt = hasContext
          ? `[CONTEXTE DE CONVERSATION]\n${contextText}\n\n[CONCEPT À EXPLIQUER]\nExplique en détail et pédagogiquement le concept suivant : "${userText}"`
          : `Explique en détail et pédagogiquement le concept suivant : "${userText}"`;
        prefix = '📚 *EXPLICATION IA :*\n\n';
        break;

      case 'code':
      case 'programming': {
        systemInstruction = 'Tu es un excellent programmeur. Génère du code propre, commenté, et bien structuré.';
        const lang = ctx.args[0] || 'JavaScript';
        const desc = ctx.args.slice(1).join(' ') || userText;
        prompt = hasContext
          ? `[CONTEXTE]\n${contextText}\n\n[LANGAGE]\n${lang}\n\n[DESCRIPTION]\nGénère du code ${lang} propre et commenté pour : "${desc}"`
          : `Génère du code ${lang} propre et commenté pour accomplir : "${desc}"`;
        prefix = `💻 *CODE GÉNÉRÉ (${lang.toUpperCase()}) :*\n\n`;
        break;
      }

      case 'extract':
        systemInstruction = 'Tu es un extracteur d\'informations précis. Identifie et structure les informations clés.';
        prompt = hasContext
          ? `[CONTEXTE]\n${contextText}\n\n[TEXTE]\nExtrait les informations clés du texte suivant sous forme de liste : "${userText}"`
          : `Extrait les informations clés du texte suivant sous forme de liste structurée :\n"${userText}"`;
        prefix = '📋 *INFORMATIONS EXTRAITES :*\n\n';
        break;

      case 'tasks':
        systemInstruction = 'Tu es un gestionnaire de tâches efficace. Identifie et structure toutes les tâches à faire.';
        prompt = hasContext
          ? `[CONTEXTE DE CONVERSATION]\n${contextText}\n\n[TEXTE À ANALYSER]\nAnalyse et extrait toutes les tâches à faire de manière structurée : "${userText}"`
          : `Analyse le texte suivant et extrait toutes les tâches à faire (to-do) de manière structurée avec des emojis :\n"${userText}"`;
        prefix = '✅ *TÂCHES EXTRAITES :*\n\n';
        break;

      case 'question':
      case 'qa':
        systemInstruction = 'Tu es un assistant qui répond précisément aux questions. Utilise le contexte pour des réponses pertinentes.';
        prompt = hasContext
          ? `[HISTORIQUE DE LA CONVERSATION]\n${contextText}\n\n[NOUVELLE QUESTION]\n${userText}`
          : userText;
        prefix = '❓ *RÉPONSE À LA QUESTION :*\n\n';
        break;

      case 'ask':
      default:
        systemInstruction = 'Tu es un assistant IA qui aide l\'utilisateur. Utilise le contexte de la conversation pour répondre intelligemment.';
        prompt = hasContext
          ? `[CONTEXTE DE CONVERSATION]\n${contextText}\n\n[QUESTION]\nRéponds à la question suivante en français de manière claire : "${userText}"`
          : `Réponds à la question suivante en français de manière claire et concise :\n"${userText}"`;
        prefix = '💬 *RÉPONSE :*\n\n';
    }

    try {
      const response = await aiService.generateText(prompt, systemInstruction);
      
      let fullResponse = `${prefix}${response}`;
      
      // ✅ Ajouter une note si on a utilisé le contexte
      if (hasContext && response.length < 2000) {
        fullResponse += `\n\n_💡 Réponse générée avec contexte de conversation_`;
      }
      
      await ctx.reply(fullResponse);
      
      // ✅ Enregistrer la réponse dans l'historique
      await contextManager.addMessage(ctx.chat.id, 'owner', response);
    } catch (err) {
      logger.error({ error: err }, `[AiChatCommand] Failed for sub=${sub}`);
      await ctx.reply(`❌ Erreur IA : ${(err as Error).message}`);
    }
  }
};

export default AiChatCommand;