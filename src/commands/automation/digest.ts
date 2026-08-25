/**
 * Digest Command — Rapport quotidien automatique des groupes actifs.
 *
 * Commandes :
 *   .digest              — Générer un digest immédiatement
 *   .digest schedule 8h  — Programmer l'envoi automatique chaque matin
 *   .digest stop         — Arrêter le digest automatique
 *   .digest status       — Voir la configuration
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import chatHistoryService from '../../services/chat/chat-history-service.js';
import { AIService } from '../../services/ai/ai-service.js';
import logger from '../../core/logger/logger.js';
import { config } from '../../config/env.js';
import sessionManager from '../../core/bot/session-manager.js';

interface DigestSchedule {
  hour: number;
  minute: number;
  timer?: NodeJS.Timeout;
  ownerJid: string;
  trackedGroups: string[];
}

// Singleton schedule state
let activeSchedule: DigestSchedule | null = null;

async function generateGroupDigest(groupJid: string): Promise<string | null> {
  const messages = await chatHistoryService.getRecentMessagesAsync(groupJid, 100);
  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const recent = messages.filter(m => m.timestamp >= since24h);
  if (recent.length < 3) return null;

  const formatted = recent
    .map(m => {
      const t = new Date(m.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return `[${t}] ${m.senderName}: ${m.text}`;
    })
    .join('\n');

  const prompt =
    `Voici les messages des dernières 24h dans un groupe WhatsApp :\n\n${formatted}\n\n` +
    `Fais un résumé ultra-concis en français (max 4 points) : ` +
    `sujets principaux, décisions, et questions en suspens. Sois direct et sans introduction.`;

  try {
    const raw = await AIService.getInstance().generateText(prompt);
    return AIService.cleanAiOutput(raw);
  } catch {
    return null;
  }
}

async function buildAndSendDigest(ownerJid: string, trackedGroups: string[], provider: any): Promise<void> {
  logger.info('[DigestCommand] Generating daily digest...');

  // Get all active groups (from recent messages)
  const groupsToAnalyze = trackedGroups.length > 0 ? trackedGroups : [];

  // If no specific groups tracked, scan chatHistory for recent group chats
  if (groupsToAnalyze.length === 0) {
    logger.info('[DigestCommand] No specific groups configured, skipping auto-detection');
    await provider.sendMessage(ownerJid,
      '📊 *DIGEST QUOTIDIEN*\n\n' +
      '⚠️ Aucun groupe configuré pour le digest.\n\n' +
      'Utilisez `.digest add <groupJid>` pour ajouter un groupe à surveiller,\n' +
      'ou lancez `.digest` dans un groupe pour l\'ajouter automatiquement.'
    );
    return;
  }

  const sections: string[] = [];
  const now = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });

  for (const groupJid of groupsToAnalyze) {
    const summary = await generateGroupDigest(groupJid);
    if (summary) {
      sections.push(`━━━ 📌 ${groupJid.split('@')[0]} ━━━\n${summary}`);
    }
  }

  if (sections.length === 0) {
    await provider.sendMessage(ownerJid,
      `📊 *DIGEST DU ${now.toUpperCase()}*\n\n` +
      `😴 Aucune activité significative dans vos groupes hier.`
    );
    return;
  }

  const digest =
    `╭━━〔 📊 DIGEST QUOTIDIEN 〕━━╮\n` +
    `┃ 📅 ${now}\n` +
    `┃ 📋 ${sections.length} groupe(s) actif(s)\n` +
    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
    sections.join('\n\n') + '\n\n' +
    `_Généré automatiquement par Abel-Bot_ 🤖`;

  await provider.sendMessage(ownerJid, digest);
  logger.info(`[DigestCommand] Digest sent to ${ownerJid}`);
}

// In-memory tracked groups (per owner)
const trackedGroups: Map<string, Set<string>> = new Map();

function getTracked(ownerJid: string): Set<string> {
  if (!trackedGroups.has(ownerJid)) trackedGroups.set(ownerJid, new Set());
  return trackedGroups.get(ownerJid)!;
}

const DigestCommand: IPluginCommand = {
  name: 'digest',
  aliases: ['daily', 'rapport'],
  category: 'Automation',
  description: 'Rapport quotidien IA des groupes actifs, envoyé automatiquement chaque matin.',
  usage: '.digest | .digest schedule 8h | .digest stop | .digest add | .digest list',
  cooldown: 10,
  ownerOnly: true,

  async execute(ctx: CommandContext) {
    const action = ctx.args[0]?.toLowerCase();
    const ownerJid = ctx.sender.id;
    const tracked = getTracked(ownerJid);

    // ── HELP ──────────────────────────────────────────────────────────────────
    if (!action) {
      const hasSchedule = !!activeSchedule;
      await ctx.reply(
        `📊 *DIGEST QUOTIDIEN*\n\n` +
        `Statut : ${hasSchedule ? `✅ Actif à *${activeSchedule!.hour}h${activeSchedule!.minute.toString().padStart(2, '0')}* chaque jour` : '❌ Désactivé'}\n` +
        `Groupes surveillés : *${tracked.size}*\n\n` +
        `Commandes :\n` +
        `• \`.digest\` — Générer un digest maintenant\n` +
        `• \`.digest now\` — Générer immédiatement\n` +
        `• \`.digest schedule 8h\` — Envoi automatique à 8h chaque matin\n` +
        `• \`.digest add\` — Ajouter ce groupe au digest\n` +
        `• \`.digest remove\` — Retirer ce groupe\n` +
        `• \`.digest list\` — Voir les groupes suivis\n` +
        `• \`.digest stop\` — Arrêter le digest automatique`
      );
      return;
    }

    // ── NOW / GENERATE ────────────────────────────────────────────────────────
    if (action === 'now' || action === 'generate' || action === 'gen' || action === 'maintenant') {
      await ctx.reply('⏳ Génération du digest en cours... Cette opération peut prendre 30-60 secondes.');
      const provider = ctx.provider;

      const groupsToScan = tracked.size > 0 ? Array.from(tracked) : [];
      if (groupsToScan.length === 0) {
        await ctx.reply(
          '⚠️ Aucun groupe configuré.\n\n' +
          'Allez dans un groupe et tapez `.digest add` pour l\'ajouter au digest.'
        );
        return;
      }

      await buildAndSendDigest(ownerJid, groupsToScan, provider);
      return;
    }

    // ── ADD ────────────────────────────────────────────────────────────────────
    if (action === 'add' || action === 'ajouter') {
      if (!ctx.chat.isGroup) {
        await ctx.reply('⚠️ Cette commande doit être utilisée dans un groupe.');
        return;
      }
      tracked.add(ctx.chat.id);
      await ctx.reply(`✅ Ce groupe est maintenant inclus dans votre digest quotidien.\n\n📋 *Total :* ${tracked.size} groupe(s) suivis`);
      return;
    }

    // ── REMOVE ────────────────────────────────────────────────────────────────
    if (action === 'remove' || action === 'retirer' || action === 'del') {
      if (!ctx.chat.isGroup) {
        await ctx.reply('⚠️ Cette commande doit être utilisée dans un groupe.');
        return;
      }
      tracked.delete(ctx.chat.id);
      await ctx.reply(`✅ Ce groupe a été retiré du digest.\n\n📋 *Total :* ${tracked.size} groupe(s) restants`);
      return;
    }

    // ── LIST ───────────────────────────────────────────────────────────────────
    if (action === 'list' || action === 'liste') {
      if (tracked.size === 0) {
        await ctx.reply('📋 Aucun groupe configuré pour le digest.\n\n💡 Tapez `.digest add` dans un groupe pour le suivre.');
        return;
      }
      let out = `╭━━〔 📊 GROUPES SUIVIS 〕━━╮\n\n`;
      for (const g of tracked) {
        out += `• \`${g.split('@')[0]}\`\n`;
      }
      out += `\n╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
      await ctx.reply(out);
      return;
    }

    // ── SCHEDULE ──────────────────────────────────────────────────────────────
    if (action === 'schedule' || action === 'planifier' || action === 'auto') {
      const timeArg = ctx.args[1] || '8h';
      const match = timeArg.match(/^(\d{1,2})(?:h|:)(\d{0,2})?$/);
      if (!match) {
        await ctx.reply('⚠️ Format invalide.\n\nExemples : `.digest schedule 8h` | `.digest schedule 7h30`');
        return;
      }

      const hour = parseInt(match[1], 10);
      const minute = match[2] ? parseInt(match[2], 10) : 0;

      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        await ctx.reply('⚠️ Heure invalide (0-23h).');
        return;
      }

      // Cancel existing schedule
      if (activeSchedule?.timer) clearTimeout(activeSchedule.timer);

      const scheduleNext = () => {
        const now = new Date();
        const nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
        if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
        const delay = nextRun.getTime() - now.getTime();

        activeSchedule!.timer = setTimeout(async () => {
          try {
            const prov = sessionManager.getMainSession();
            if (prov) await buildAndSendDigest(ownerJid, Array.from(tracked), prov);
          } catch (err) {
            logger.error({ error: err }, '[DigestCommand] Scheduled digest failed');
          }
          scheduleNext();
        }, delay);
      };

      activeSchedule = { hour, minute, ownerJid, trackedGroups: [] };
      scheduleNext();

      await ctx.reply(
        `✅ *DIGEST AUTOMATIQUE CONFIGURÉ !*\n\n` +
        `⏰ Heure d'envoi : *${hour}h${minute.toString().padStart(2, '0')}* chaque matin\n` +
        `📋 Groupes surveillés : *${tracked.size}*\n\n` +
        `_Vous recevrez votre rapport chaque matin à ${hour}h${minute.toString().padStart(2, '0')} directement dans vos messages !_`
      );
      return;
    }

    // ── STOP ──────────────────────────────────────────────────────────────────
    if (action === 'stop' || action === 'arrêter' || action === 'off') {
      if (activeSchedule?.timer) {
        clearTimeout(activeSchedule.timer);
        activeSchedule = null;
        await ctx.reply('⏹️ Digest automatique désactivé.');
      } else {
        await ctx.reply('ℹ️ Aucun digest automatique actif.');
      }
      return;
    }

    await ctx.reply('⚠️ Commande inconnue.\n\nAide : `.digest now` | `.digest add` | `.digest schedule 8h`');
  }
};

export default DigestCommand;
