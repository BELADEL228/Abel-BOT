/**
 * Monitor Command — Surveillance de mots-clés dans les groupes WhatsApp.
 *
 * Commandes :
 *   .monitor add <mot>              — Surveiller un mot dans tous les groupes
 *   .monitor add <mot> ici          — Surveiller uniquement dans ce groupe
 *   .monitor remove <mot>
 *   .monitor list
 *   .monitor clear
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import monitorService from '../../services/automation/monitor-service.js';

const MonitorCommand: IPluginCommand = {
  name: 'monitor',
  aliases: ['surveille', 'watch', 'alerte'],
  category: 'Automation',
  description: 'Surveille des mots-clés dans les groupes et vous alerte quand ils sont mentionnés.',
  usage: '.monitor add <mot> | .monitor remove <mot> | .monitor list',
  cooldown: 2,
  ownerOnly: true,

  async execute(ctx: CommandContext) {
    const action = ctx.args[0]?.toLowerCase();

    // ── HELP ───────────────────────────────────────────────────────────────────
    if (!action) {
      const rules = monitorService.list();
      const total = rules.reduce((s, r) => s + r.triggerCount, 0);
      await ctx.reply(
        `🔔 *SURVEILLANCE DE MOTS-CLÉS*\n\n` +
        `📊 *${rules.length} mot(s)* surveillé(s) · ${total} alerte(s) déclenchée(s)\n\n` +
        `Commandes :\n` +
        `• \`.monitor add <mot>\` — Surveiller dans tous les groupes\n` +
        `• \`.monitor add <mot> ici\` — Surveiller dans ce groupe uniquement\n` +
        `• \`.monitor remove <mot>\` — Arrêter la surveillance\n` +
        `• \`.monitor list\` — Voir tous les mots surveillés\n` +
        `• \`.monitor clear\` — Tout effacer`
      );
      return;
    }

    // ── ADD ────────────────────────────────────────────────────────────────────
    if (action === 'add' || action === 'ajouter') {
      const parts = ctx.args.slice(1);
      const groupOnly = parts[parts.length - 1]?.toLowerCase() === 'ici';
      const keyword = (groupOnly ? parts.slice(0, -1) : parts).join(' ').trim();

      if (!keyword) {
        await ctx.reply('⚠️ Format : `.monitor add <mot-clé>` ou `.monitor add <mot-clé> ici`');
        return;
      }

      const groupJid = groupOnly && ctx.chat.isGroup ? ctx.chat.id : undefined;
      monitorService.add(keyword, groupJid);

      await ctx.reply(
        `🔔 *MOT-CLÉ SURVEILLÉ :* \`${keyword}\`\n\n` +
        `📍 Portée : ${groupOnly ? `ce groupe uniquement` : 'tous les groupes'}\n\n` +
        `Vous serez alerté immédiatement si quelqu'un mentionne _"${keyword}"_ dans un groupe.`
      );
      return;
    }

    // ── REMOVE ─────────────────────────────────────────────────────────────────
    if (action === 'remove' || action === 'del' || action === 'supprimer' || action === 'arrêter') {
      const keyword = ctx.args.slice(1).join(' ').trim();
      if (!keyword) {
        await ctx.reply('⚠️ Format : `.monitor remove <mot-clé>`');
        return;
      }
      const ok = monitorService.remove(keyword);
      await ctx.reply(ok ? `✅ Surveillance de \`${keyword}\` désactivée.` : `❌ Mot-clé \`${keyword}\` introuvable.`);
      return;
    }

    // ── LIST ───────────────────────────────────────────────────────────────────
    if (action === 'list' || action === 'liste') {
      const rules = monitorService.list();
      if (rules.length === 0) {
        await ctx.reply('📋 Aucun mot-clé surveillé.\n\n💡 `.monitor add <mot>` pour commencer.');
        return;
      }
      let out = `╭━━〔 🔔 SURVEILLANCE ACTIVE 〕━━╮\n\n`;
      for (const rule of rules) {
        const scope = rule.groupJids.size > 0 ? `${rule.groupJids.size} groupe(s)` : 'Tous les groupes';
        out += `• \`${rule.keyword}\` — 📍 ${scope} · 🔔 ${rule.triggerCount} alerte(s)\n`;
      }
      out += `\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
      await ctx.reply(out);
      return;
    }

    // ── CLEAR ──────────────────────────────────────────────────────────────────
    if (action === 'clear') {
      monitorService.clear();
      await ctx.reply('🧹 Toute la surveillance a été désactivée.');
      return;
    }

    await ctx.reply('⚠️ Commande inconnue.\n\nAide : `.monitor add <mot>` | `.monitor list`');
  }
};

export default MonitorCommand;
