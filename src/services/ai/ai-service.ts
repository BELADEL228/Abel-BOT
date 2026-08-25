import { config } from '../../config/env.js';
import logger from '../../core/logger/logger.js';

export class AIService {
  private static instance: AIService;

  private constructor() {}

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Sanitizes AI output by removing reasoning/thinking blocks (<think>...</think>)
   */
  public static cleanAiOutput(text: string): string {
    if (!text) return '';
    return text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<think>[\s\S]*/gi, '')
      .replace(/<\/think>/gi, '')
      .trim();
  }

  /**
   * Generates a text response using Gemini API or OpenAI API depending on key format.
   */
  public async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    const apiKey = config.aiApiKey;

    if (!apiKey) {
      return (
        "⚠️ *Clé API IA non configurée.*\n\n" +
        "Veuillez définir `AI_API_KEY` dans votre fichier `.env` avec une clé Google Gemini ou OpenAI pour activer la vraie génération par Intelligence Artificielle."
      );
    }

    try {
      let rawResult: string;
      // Route by key prefix: 'gsk_' -> Groq Cloud API, 'sk-' -> OpenAI, default -> Gemini
      if (apiKey.startsWith('gsk_')) {
        rawResult = await this.callGroqApi(apiKey, prompt, systemInstruction);
      } else if (apiKey.startsWith('sk-')) {
        rawResult = await this.callOpenAiApi(apiKey, prompt, systemInstruction);
      } else {
        rawResult = await this.callGeminiApi(apiKey, prompt, systemInstruction);
      }

      return AIService.cleanAiOutput(rawResult);
    } catch (error: any) {
      logger.error({ error: error.message || error }, '[AIService] Error calling AI Provider API');
      return `❌ *Erreur lors de la génération IA :* ${error.message || 'Erreur inconnue de l’API'}`;
    }
  }

  /**
   * Summarizes text using AI.
   */
  public async summarizeText(text: string): Promise<string> {
    const systemPrompt =
      "Tu es un assistant IA expert en synthèse. Ton rôle est de lire le texte fourni et de générer un résumé synthétique, clair et structuré en français. Extraire les points clés, les décisions et les idées principales sous forme de puces.";
    
    return await this.generateText(text, systemPrompt);
  }

  /**
   * Calls Google Gemini API v1beta via native fetch with automatic model fallback
   */
  private async callGeminiApi(apiKey: string, prompt: string, systemInstruction?: string): Promise<string> {
    const candidateModels = [
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro',
      'gemini-pro'
    ];

    const contents: any[] = [];

    if (systemInstruction) {
      contents.push({
        role: 'user',
        parts: [{ text: `Consigne système : ${systemInstruction}` }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'Compris. Je suivrai cette consigne avec précision.' }]
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    let lastError: string = '';

    for (const model of candidateModels) {
      const endpoints = [
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`
      ];

      for (const url of endpoints) {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
          });

          if (response.ok) {
            const data: any = await response.json();
            const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (candidateText) {
              return candidateText.trim();
            }
          } else {
            const errText = await response.text();
            lastError = `[${model}] ${response.status}: ${errText}`;
          }
        } catch (err: any) {
          lastError = err.message || String(err);
        }
      }
    }

    throw new Error(`Toutes les tentatives de modèles Gemini ont échoué. Dernier message : ${lastError}`);
  }

  /**
   * Calls OpenAI / DeepSeek / Compatible Chat Completion API
   */
  private async callOpenAiApi(apiKey: string, prompt: string, systemInstruction?: string): Promise<string> {
    const url = 'https://api.openai.com/v1/chat/completions';

    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API Error (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Réponse vide retournée par OpenAI API.');
    }

    return content.trim();
  }

  /**
   * Calls Groq Cloud API with dynamic model discovery
   */
  private async callGroqApi(apiKey: string, prompt: string, systemInstruction?: string): Promise<string> {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    let candidateModels: string[] = [];

    // Attempt dynamic model list fetching from Groq Cloud
    try {
      const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (modelsRes.ok) {
        const modelsData: any = await modelsRes.json();
        if (Array.isArray(modelsData.data)) {
          candidateModels = modelsData.data
            .map((m: any) => m.id)
            .filter((id: string) => !id.includes('whisper') && !id.includes('guard') && !id.includes('safetensors'));
          logger.info(`[AIService] Discovered ${candidateModels.length} active Groq models: ${candidateModels.slice(0, 5).join(', ')}`);
        }
      }
    } catch (e) {
      logger.warn({ error: e }, '[AIService] Failed to fetch dynamic Groq model list, using default fallback list');
    }

    if (candidateModels.length === 0) {
      candidateModels = [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'llama-3.2-3b-preview',
        'llama-3.2-1b-preview',
        'deepseek-r1-distill-llama-70b',
        'qwen-2.5-coder-32b',
        'llama-3.1-70b-versatile'
      ];
    }

    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    let lastError = '';

    for (const model of candidateModels) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages
          })
        });

        if (response.ok) {
          const data: any = await response.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            return content.trim();
          }
        } else {
          const errText = await response.text();
          lastError = `[${model}] ${response.status}: ${errText}`;
          logger.warn({ model, status: response.status, error: errText }, '[AIService] Groq model error, trying fallback model...');
        }
      } catch (err: any) {
        lastError = err.message || String(err);
      }
    }

    throw new Error(`Groq API Error : ${lastError}`);
  }
}

export default AIService.getInstance();
