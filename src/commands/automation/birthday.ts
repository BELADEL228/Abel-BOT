/**
 * Birthday Command — Rappels d'anniversaire automatiques
 *
 * Commandes :
 *   .birthday add @contact <nom> <date>    — Ajouter un anniversaire
 *   .birthday list                          — Voir tous les anniversaires
 *   .birthday upcoming                      — Voir les prochains (7 jours)
 *   .birthday del @contact                  — Supprimer un anniversaire
 *   .birthday today                         — Voir les anniversaires du jour
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import birthdayService from '../../services/automation/birthday-service.js';

function toJid(arg: string): string {
  return arg.startsWith('+') || /^\d/.test(arg)
    ? `${arg.replace(/\D/g, '')}@s.whatsapp.net`
    : `${arg.replace('@', '')}@s.whatsapp.net`;
}

const BirthdayCommand: IPluginCommand = {
  name: 'birthday',
  aliases: ['anniversaire', 'bday', 'anniv'],
  category: 'Automation',
  description: 'Gérer les rappels d\'anniversaire de vos contacts.',
  usage: '.birthday add @contact <nom> <JJ/MM> | .birthday list | .birthday upcoming',
  cooldown: 2,
  ownerOnly: true,

  async execute(ctx: CommandContext) {
    const action = ctx.args[0]?.toLowerCase();
    const ownerJid = ctx.sender.id;

    // ── HELP ───────────────────────────────────────────────────────────────────
    if (!action) {
      const entries = birthdayService.list(ownerJid);
      await ctx.reply(
        `🎂 *RAPPELS D'ANNIVERSAIRE*\n\n` +
        `📅 *${entries.length} contact(s)* enregistrés\n\n` +
        `Commandes :\n` +
        `• \`.birthday add @num Prénom JJ/MM\` — Enregistrer\n` +
        `• \`.birthday add @num Prénom JJ/MM/AAAA\` — Avec l'année\n` +
        `• \`.birthday list\` — Voir tous les anniversaires\n` +
        `• \`.birthday upcoming\` — Prochains dans 7 jours\n` +
        `• \`.birthday today\` — Anniversaires aujourd'hui\n` +
        `• \`.birthday del @num\` — Supprimer`
      );
      return;
    }

    // ── ADD ────────────────────────────────────────────────────────────────────
    if (action === 'add' || action === 'ajouter' || action === 'set') {
      const contactArg = ctx.args[1];
      if (!contactArg) {
        await ctx.reply('⚠️ Format : `.birthday add @228xxxxxxxx Prénom JJ/MM`');
        return;
      }

      const contactJid = toJid(contactArg);
      const remaining = ctx.args.slice(2);

      // Find date (last arg matching date pattern)
      const dateIdx = remaining.findIndex(a => /^\d{1,2}[\/\-]\d{1,2}/.test(a));
      if (dateIdx === -1) {
        await ctx.reply('⚠️ Date manquante. Format : `.birthday add @contact Prénom JJ/MM`\n\nExemple : `.birthday add @228xxxxxxxx David 25/08`');
        return;
      }

      const dateStr = remaining[dateIdx];
      const name = remaining.filter((_, i) => i !== dateIdx).join(' ').trim() || contactArg.replace('@', '');

      const entry = birthdayService.add(ownerJid, contactJid, name, dateStr);
      if (!entry) {
        await ctx.reply(`❌ Date invalide. Utilisez le format JJ/MM ou JJ/MM/AAAA (ex: 25/08 ou 25/08/2000)`);
        return;
      }

      const yearInfo = entry.year ? `, né(e) en ${entry.year}` : '';
      await ctx.reply(
        `🎂 *ANNIVERSAIRE ENREGISTRÉ !*\n\n` +
        `👤 *${name}*\n` +
        `📅 *Date :* ${entry.day.toString().padStart(2, '0')}/${entry.month.toString().padStart(2, '0')}${yearInfo}\n\n` +
        `Le bot vous alertera automatiquement le jour J ! 🎉`
      );
      return;
    }

    // ── LIST ───────────────────────────────────────────────────────────────────
    if (action === 'list' || action === 'liste') {
      const entries = birthdayService.list(ownerJid);
      if (entries.length === 0) {
        await ctx.reply('📋 Aucun anniversaire enregistré.\n\n💡 `.birthday add @contact Prénom JJ/MM`');
        return;
      }

      const now = new Date();
      let out = `╭━━〔 🎂 ANNIVERSAIRES 〕━━╮\n\n`;
      for (const e of entries) {
        const next = new Date(now.getFullYear(), e.month - 1, e.day);
        if (next < now) next.setFullYear(now.getFullYear() + 1);
        const diff = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const ageStr = e.year ? ` _(${now.getFullYear() - e.year + (diff === 0 ? 0 : -1)} ans)_` : '';
        const soonTag = diff <= 7 ? ` ⚡ _dans ${diff}j_` : '';
        out += `• 🎂 *${e.contactName}* — ${e.day.toString().padStart(2, '0')}/${e.month.toString().padStart(2, '0')}${ageStr}${soonTag}\n`;
      }
      out += `\n╰━━━━━━━━━━━━━━━━━━━━━━━╯`;
      await ctx.reply(out);
      return;
    }

    // ── UPCOMING ───────────────────────────────────────────────────────────────
    if (action === 'upcoming' || action === 'prochains' || action === 'soon') {
      const upcoming = birthdayService.getUpcoming(ownerJid, 7);
      if (upcoming.length === 0) {
        await ctx.reply('🗓️ Aucun anniversaire dans les 7 prochains jours. 🎉');
        return;
      }

      const now = new Date();
      let out = `╭━━〔 📅 PROCHAINS ANNIVERSAIRES 〕━━╮\n\n`;
      for (const e of upcoming) {
        const next = new Date(now.getFullYear(), e.month - 1, e.day);
        if (next < now) next.setFullYear(now.getFullYear() + 1);
        const diff = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const when = diff === 0 ? "🎉 *Aujourd'hui !*" : diff === 1 ? "⏰ *Demain !*" : `dans *${diff} jours*`;
        out += `• 🎂 *${e.contactName}* — ${when}\n`;
      }
      out += `\n╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
      await ctx.reply(out);
      return;
    }

    // ── TODAY ──────────────────────────────────────────────────────────────────
    if (action === 'today' || action === 'aujourd\'hui' || action === 'auj') {
      const todays = birthdayService.getTodaysBirthdays().filter(e => e.ownerJid === ownerJid);
      if (todays.length === 0) {
        await ctx.reply('🗓️ Aucun anniversaire aujourd\'hui parmi vos contacts.');
        return;
      }
      let out = `🎉 *ANNIVERSAIRES AUJOURD'HUI !*\n\n`;
      for (const e of todays) {
        out += `🎂 *${e.contactName}* — @${e.contactJid.split('@')[0]}\n`;
      }
      await ctx.reply(out, { mentions: todays.map(e => e.contactJid) });
      return;
    }

    // ── DEL ───────────────────────────────────────────────────────────────────
    if (action === 'del' || action === 'remove' || action === 'supprimer') {
      const contactArg = ctx.args[1];
      if (!contactArg) {
        await ctx.reply('⚠️ Format : `.birthday del @contact`');
        return;
      }
      const contactJid = toJid(contactArg);
      const ok = birthdayService.remove(ownerJid, contactJid);
      await ctx.reply(ok ? `🗑️ Anniversaire supprimé.` : `❌ Contact introuvable.`);
      return;
    }

    await ctx.reply('⚠️ Commande inconnue.\n\nAide : `.birthday add @contact Prénom JJ/MM` | `.birthday list`');
  }
};

export default BirthdayCommand;
