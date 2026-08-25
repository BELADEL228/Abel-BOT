import aiService, { AIService } from '../ai/ai-service.js';
import { config } from '../../config/env.js';
import logger from '../../core/logger/logger.js';
import prisma from '../../core/db/prisma.js';

export type AutoReplyTone = 'casual' | 'friendly' | 'formal' | 'professional' | 'short';

export interface AIGenerationOptions {
  chatJid: string;
  contactName: string;
  senderJid: string;
  incomingText: string;
  contextText?: string;
  tone: AutoReplyTone;
  ownerName?: string;
  sessionId: string;
}

export class AIResponseGenerator {
  private static instance: AIResponseGenerator;
  private prismaAvailable: boolean = true;

  private constructor() {}

  public static getInstance(): AIResponseGenerator {
    if (!AIResponseGenerator.instance) {
      AIResponseGenerator.instance = new AIResponseGenerator();
    }
    return AIResponseGenerator.instance;
  }

  public async generateHumanReply(options: AIGenerationOptions): Promise<string> {
    const { chatJid, contactName, senderJid, incomingText, contextText, tone, ownerName: customOwnerName, sessionId } = options;
    const ownerName = customOwnerName || 'Abel';

    // 1. Fetch Memories (Facts about owner and relationship with this contact)
    const memories = await this.getRelevantMemories(sessionId, senderJid);
    const memoryContext = memories.length > 0
      ? `\n[MÉMOIRE ET FAITS CONNUS] :\n${memories.map(m => `- ${m.key}: ${m.value}`).join('\n')}`
      : '';

    const toneInstructions: Record<AutoReplyTone, string> = {
      casual: "Ton décontracté, jeune, direct et naturel (comme entre potes ou collègues proches sur WhatsApp). Emojis discrets si pertinent.",
      friendly: "Ton chaleureux, poli, bienveillant et serviable. Met en confiance.",
      formal: "Ton soigné, courtois, respectueux et direct. Pas d'argot.",
      professional: "Ton professionnel, clair, concis et impeccable.",
      short: "Ultra court (1 à 2 phrases max). Répond directement au point essentiel sans fioriture."
    };

    const systemInstruction = `Tu es le propriétaire du compte WhatsApp (${ownerName}).
Tu réponds directement aux messages reçus sur WhatsApp.

RÈGLES D'OR POUR UNE RÉPONSE 100% NATURELLE ET HUMAINE :
1. Rédige UNIQUEMENT le texte exact à envoyer par message. AUCUN guillemet, AUCUN préfixe comme "Message:", "Réponse:" ou "Assistant:".
2. Ne dis JAMAIS que tu es une IA, un bot, un assistant ou un système automatisé.
3. Évite les phrases clichées et robotiques du genre "J'espère que vous allez bien", "Je suis actuellement indisponible mais...", "N'hésite pas si tu as d'autres questions".
4. Adapte ta réponse à ce qui est demandé :
   - Si c'est un simple salut ("salut", "cc", "yo", "bonjour"), réponds de manière sympa et simple ("Salut ! Ça va ?", "Yo ! Comment tu vas ?").
   - Si c'est une question ou une demande, accuse réception brièvement et dis que tu t'en occupes ou que tu réponds dès que tu te poses ("Yes bien reçu ! Je checke ça et je te redis", "Ça marche, je te fais signe tout à l'heure 👍").
5. ${toneInstructions[tone] || toneInstructions.casual}
6. Ne jamais inventer d'excuses farfelues ou d'événements imaginaires.`;

    const userPrompt = `
[HISTORIQUE DE CONVERSATION] :
${contextText || '(Premier message)'}
${memoryContext}

[INFORMATIONS] :
- Interlocuteur : ${contactName}
- Contexte : ${chatJid.endsWith('@g.us') ? 'Groupe WhatsApp' : 'Discussion privée'}
- Ton : ${tone}

[DERNIER MESSAGE REÇU] :
"${incomingText}"

Ta réponse naturelle en tant que ${ownerName} :`;

    try {
      if (!aiService || typeof aiService.generateText !== 'function') {
        logger.warn('[AIResponseGenerator] aiService not available, returning empty');
        return '';
      }

      const reply = await aiService.generateText(userPrompt, systemInstruction);

      // Clean response to guarantee pure human message
      const cleanReply = reply
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<think>[\s\S]*/gi, '')
        .replace(/<\/think>/gi, '')
        .replace(/^["']|["']$/g, '')
        .replace(/^(🤖\s*)?(Message automatique|Auto-reply|Réponse automatique|Réponse)\s*:\s*/i, '')
        .trim();

      // Async fire-and-forget memory extraction
      this.extractMemories(sessionId, senderJid, incomingText, contextText, cleanReply).catch(() => {});

      return cleanReply;
    } catch (err: any) {
      logger.error({ error: err.message }, '[AIResponseGenerator] Generation error');
      return '';
    }
  }

  private async getRelevantMemories(sessionId: string, senderJid: string) {
    if (!this.prismaAvailable || !prisma) return [];

    try {
      const ownerJid = sessionId.includes('@') ? sessionId : undefined;
      if (!ownerJid) return [];

      const memories = await prisma.memory.findMany({
        where: {
          userJid: ownerJid,
          OR: [
            { key: { contains: 'style' } },
            { key: { contains: 'bio' } },
            { key: { contains: senderJid } }
          ]
        },
        take: 10
      }).catch((err: any) => {
        if (err.code === 'P2012' || err.message?.includes('memory')) {
          this.prismaAvailable = false;
          return [];
        }
        throw err;
      });

      return memories || [];
    } catch {
      this.prismaAvailable = false;
      return [];
    }
  }

  private async extractMemories(sessionId: string, senderJid: string, incoming: string, context?: string, aiReply?: string) {
    if (!context || context.length < 50) return;

    const ownerJid = sessionId.includes('@') ? sessionId : null;
    if (!ownerJid) return;

    const extractionPrompt = `Analyse cette conversation WhatsApp et extrait UNIQUEMENT les faits stables et utiles (habitudes du propriétaire, relation clé avec ${senderJid}).
Formate en JSON pur : [{"key": "clé_courte", "value": "valeur_factuelle"}]
Si rien d'important, réponds [].

CONVERSATION :
${context}
Dernier échange :
User: ${incoming}
Me: ${aiReply}`;

    try {
      if (!aiService || typeof aiService.generateText !== 'function') return;

      const rawJson = await aiService.generateText(extractionPrompt, "Tu es un extracteur de faits sélectif. Réponds uniquement en JSON pur.");
      const cleanedJson = AIService.cleanAiOutput(rawJson).replace(/```json|```/g, '').trim();
      const facts = JSON.parse(cleanedJson);

      if (!this.prismaAvailable || !prisma) return;

      if (Array.isArray(facts)) {
        for (const fact of facts) {
          if (fact.key && fact.value) {
            await prisma.memory.upsert({
              where: {
                userJid_key: {
                  userJid: ownerJid,
                  key: fact.key
                }
              },
              update: { value: fact.value },
              create: {
                userJid: ownerJid,
                key: fact.key,
                value: fact.value
              }
            }).catch(() => {});
          }
        }
      }
    } catch {
      // ignore
    }
  }
}

export default AIResponseGenerator.getInstance();
