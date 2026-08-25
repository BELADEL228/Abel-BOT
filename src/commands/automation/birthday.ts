/**
 * Birthday Command — Gestion et programmation des souhaits d'anniversaire personnalisés
 *
 * Commandes :
 *   .birthday add @contact <Nom> <JJ/MM> [Message personnalisé...]
 *   .birthday msg @contact <Message personnalisé...>
 *   .birthday test @contact
 *   .birthday autosend @contact <on|off>
 *   .birthday hour @contact <0-23>
 *   .birthday list
 *   .birthday upcoming
 *   .birthday today
 *   .birthday del @contact
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import birthdayService from '../../services/automation/birthday-service.js';

function toJid(arg: string): string {
  const clean = arg.replace('@', '').replace(/\D/g, '');
  return clean ? `${clean}@s.whatsapp.net` : arg;
}

const BirthdayCommand: IPluginCommand = {
  name: 'birthday',
  aliases: ['anniversaire', 'bday', 'anniv', 'annivs'],
  category: 'Automation',
  description: 'Programmation et envoi automatique de souhaits d\'anniversaire personnalisés.',
  usage: '.birthday add @contact <nom> <JJ/MM> [message] | .birthday list | .birthday msg @contact <texte>',
  cooldown: 2,
  ownerOnly: true,

  async execute(ctx: CommandContext) {
    const action = ctx.args[0]?.toLowerCase();
    const ownerJid = ctx.sender.id;

    // ── HELP ───────────────────────────────────────────────────────────────────
    if (!action) {
      const entries = birthdayService.list(ownerJid);
      await ctx.reply(
        `🎂 *GESTIONNAIRE D'ANNIVERSAIRES AUTOMATISÉ*\n\n` +
        `📊 *${entries.length} contact(s)* programmés en base de données\n\n` +
        `*Commandes disponibles :*\n` +
        `• \`.birthday add @contact Prénom JJ/MM [Message]\`\n` +
        `  _Ex: .birthday add @228xxxxxxxx David 25/08 Joyeux anniv mon frérot {name} !_ \n\n` +
        `• \`.birthday msg @contact <Votre message personnalisé>\`\n` +
        `  _Définit un message sur-mesure pour cette personne_\n\n` +
        `• \`.birthday test @contact\`\n` +
        `  _Envoie immédiatement le message programmé en guise de test_\n\n` +
        `• \`.birthday hour @contact <0-23>\`\n` +
        `  _Définit l'heure d'envoi (ex: 0 pour minuit, 8 pour 08h00)_\n\n` +
        `• \`.birthday autosend @contact on/off\`\n` +
        `  _Active ou désactive l'envoi direct au destinataire_\n\n` +
        `• \`.birthday list\` — Afficher tous les anniversaires\n` +
        `• \`.birthday upcoming\` — Prochains dans 7 jours\n` +
        `• \`.birthday today\` — Anniversaires du jour\n` +
        `• \`.birthday del @contact\` — Supprimer\n\n` +
        `💡 *Variables utilisables dans les messages :*\n` +
        `\`{name}\` (Nom complet), \`{firstName}\` (Prénom), \`{age}\` (Âge si année fournie)`
      );
      return;
    }

    // ── ADD / AJOUTER ──────────────────────────────────────────────────────────
    if (action === 'add' || action === 'ajouter' || action === 'set') {
      const contactArg = ctx.args[1];
      if (!contactArg) {
        await ctx.reply('⚠️ Format : `.birthday add @contact Prénom JJ/MM [Message personnalisé optionnel]`');
        return;
      }

      const contactJid = toJid(contactArg);
      const remaining = ctx.args.slice(2);

      // Trouver l'argument de date (ex: 25/08 ou 25/08/2000)
      const dateIdx = remaining.findIndex(a => /^\d{1,2}[\/\-.]\d{1,2}/.test(a));
      if (dateIdx === -1) {
        await ctx.reply(
          '⚠️ Date manquante ou invalide.\n\n' +
          'Format : `.birthday add @contact Prénom JJ/MM [Message]`\n' +
          'Exemple : `.birthday add @228xxxxxxxx David 25/08 Joyeux anniv {firstName} !`'
        );
        return;
      }

      const dateStr = remaining[dateIdx];
      const nameParts = remaining.slice(0, dateIdx);
      const name = nameParts.length > 0 ? nameParts.join(' ').trim() : contactArg.replace('@', '');
      const customMsg = remaining.slice(dateIdx + 1).join(' ').trim() || undefined;

      const entry = birthdayService.addOrUpdate(ownerJid, contactJid, name, dateStr, customMsg);
      if (!entry) {
        await ctx.reply('❌ Date invalide. Utilisez le format `JJ/MM` ou `JJ/MM/AAAA` (ex: `25/08` ou `25/08/2000`).');
        return;
      }

      const yearInfo = entry.year ? `, né(e) en ${entry.year}` : '';
      const msgInfo = entry.customMessage
        ? `\n\n💬 *Message programmé :*\n"${entry.customMessage}"`
        : `\n\n💬 *Message :* _Modèle par défaut chaleureux activé_`;

      await ctx.reply(
        `🎂 *ANNIVERSAIRE PROGRAMMÉ AVEC SUCCÈS !*\n\n` +
        `👤 *Destinataire :* ${name} (\`${contactJid.replace('@s.whatsapp.net', '')}\`)\n` +
        `📅 *Date :* ${entry.day.toString().padStart(2, '0')}/${entry.month.toString().padStart(2, '0')}${yearInfo}\n` +
        `⏰ *Heure d'envoi :* ${entry.sendHour}h00\n` +
        `🚀 *Mode :* Envoi direct au contact + Notification propriétaire${msgInfo}\n\n` +
        `💡 _Le bot enverra le message automatiquement à ${entry.sendHour}h00 le jour J !_`
      );
      return;
    }

    // ── CUSTOM MESSAGE (MSG / SETMSG) ──────────────────────────────────────────
    if (action === 'msg' || action === 'message' || action === 'setmsg') {
      const contactArg = ctx.args[1];
      const newMsg = ctx.args.slice(2).join(' ').trim();

      if (!contactArg || !newMsg) {
        await ctx.reply(
          '⚠️ Format : `.birthday msg @contact <Votre message personnalisé>`\n\n' +
          'Exemple : `.birthday msg @contact Joyeux anniversaire {firstName} ! Que Dieu te bénisse frérot ! 🥂`'
        );
        return;
      }

      const contactJid = toJid(contactArg);
      const ok = birthdayService.setCustomMessage(ownerJid, contactJid, newMsg);

      if (!ok) {
        await ctx.reply('❌ Contact introuvable dans la liste des anniversaires. Enregistrez-le d\'abord avec `.birthday add`.');
        return;
      }

      const entry = birthdayService.get(ownerJid, contactJid)!;
      const preview = birthdayService.formatWish(entry);

      await ctx.reply(
        `✅ *MESSAGE D'ANNIVERSAIRE MIS À JOUR POUR ${entry.contactName.toUpperCase()} !*\n\n` +
        `💬 *Aperçu du message :*\n${preview}`
      );
      return;
    }

    // ── TEST DISPATCH ──────────────────────────────────────────────────────────
    if (action === 'test' || action === 'tester') {
      const contactArg = ctx.args[1];
      if (!contactArg) {
        await ctx.reply('⚠️ Format : `.birthday test @contact`');
        return;
      }

      const contactJid = toJid(contactArg);
      const res = await birthdayService.testDispatch(ownerJid, contactJid);

      if (res.success) {
        await ctx.reply(
          `🧪 *TEST D'ENVOI EFFECTUÉ AVEC SUCCÈS !*\n\n` +
          `Le message a été envoyé à @${contactJid.split('@')[0]}.\n\n` +
          `💬 *Contenu envoyé :*\n${res.message}`,
          { mentions: [contactJid] }
        );
      } else {
        await ctx.reply(`❌ Échec du test : ${res.error || 'Erreur inconnue'}`);
      }
      return;
    }

    // ── SEND HOUR ──────────────────────────────────────────────────────────────
    if (action === 'hour' || action === 'heure') {
      const contactArg = ctx.args[1];
      const hourArg = parseInt(ctx.args[2], 10);

      if (!contactArg || isNaN(hourArg) || hourArg < 0 || hourArg > 23) {
        await ctx.reply('⚠️ Format : `.birthday hour @contact <0-23>` (ex: `.birthday hour @contact 0` pour minuit pile)');
        return;
      }

      const contactJid = toJid(contactArg);
      const ok = birthdayService.setSendHour(ownerJid, contactJid, hourArg);

      if (ok) {
        await ctx.reply(`⏰ Heure d'envoi réglée sur *${hourArg}h00* pour ce contact.`);
      } else {
        await ctx.reply('❌ Contact introuvable.');
      }
      return;
    }

    // ── AUTOSEND ON / OFF ──────────────────────────────────────────────────────
    if (action === 'autosend' || action === 'direct') {
      const contactArg = ctx.args[1];
      const stateArg = ctx.args[2]?.toLowerCase();

      if (!contactArg || (stateArg !== 'on' && stateArg !== 'off')) {
        await ctx.reply('⚠️ Format : `.birthday autosend @contact on` ou `.birthday autosend @contact off`');
        return;
      }

      const contactJid = toJid(contactArg);
      const enable = stateArg === 'on';
      const ok = birthdayService.setAutoSend(ownerJid, contactJid, enable);

      if (ok) {
        await ctx.reply(
          enable
            ? `🟢 *Envoi direct activé :* Le message sera envoyé directement au contact le jour J.`
            : `🔴 *Envoi direct désactivé :* Seul le propriétaire recevra un rappel le jour J.`
        );
      } else {
        await ctx.reply('❌ Contact introuvable.');
      }
      return;
    }

    // ── LIST ───────────────────────────────────────────────────────────────────
    if (action === 'list' || action === 'liste') {
      const entries = birthdayService.list(ownerJid);
      if (entries.length === 0) {
        await ctx.reply('📋 Aucun anniversaire enregistré.\n\n💡 `.birthday add @contact Prénom JJ/MM [Message]`');
        return;
      }

      const now = new Date();
      let out = `╭━━〔 🎂 LISTE DES ANNIVERSAIRES 〕━━╮\n\n`;

      for (const e of entries) {
        const next = new Date(now.getFullYear(), e.month - 1, e.day);
        if (next < now) next.setFullYear(now.getFullYear() + 1);
        const diff = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const ageStr = e.year ? ` _(${now.getFullYear() - e.year + (diff === 0 ? 0 : -1)} ans)_` : '';
        const soonTag = diff <= 7 ? ` ⚡ *[dans ${diff}j]*` : '';
        const customTag = e.customMessage ? ' 💌' : '';

        out += `• 👤 *${e.contactName}* — ${e.day.toString().padStart(2, '0')}/${e.month.toString().padStart(2, '0')}${ageStr}${soonTag}${customTag}\n`;
        out += `  └ Heure: ${e.sendHour}h00 | Auto: ${e.autoSendDirect ? '🟢' : '🔴'}\n`;
        if (e.customMessage) {
          const preview = e.customMessage.length > 50 ? e.customMessage.slice(0, 50) + '...' : e.customMessage;
          out += `  └ Msg: _"${preview}"_\n`;
        }
        out += `\n`;
      }
      out += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
      await ctx.reply(out);
      return;
    }

    // ── UPCOMING ───────────────────────────────────────────────────────────────
    if (action === 'upcoming' || action === 'prochains' || action === 'soon') {
      const upcoming = birthdayService.getUpcoming(ownerJid, 14);
      if (upcoming.length === 0) {
        await ctx.reply('🗓️ Aucun anniversaire dans les 14 prochains jours. 🎉');
        return;
      }

      const now = new Date();
      let out = `╭━━〔 📅 PROCHAINS ANNIVERSAIRES 〕━━╮\n\n`;
      for (const e of upcoming) {
        const next = new Date(now.getFullYear(), e.month - 1, e.day);
        if (next < now) next.setFullYear(now.getFullYear() + 1);
        const diff = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const when = diff === 0 ? "🎉 *Aujourd'hui !*" : diff === 1 ? "⏰ *Demain !*" : `dans *${diff} jours*`;
        out += `• 🎂 *${e.contactName}* (${e.day}/${e.month}) — ${when}\n`;
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
        out += `🎂 *${e.contactName}* — @${e.contactJid.split('@')[0]} (${e.sendHour}h00)\n`;
      }
      await ctx.reply(out, { mentions: todays.map(e => e.contactJid) });
      return;
    }

    // ── DEL ────────────────────────────────────────────────────────────────────
    if (action === 'del' || action === 'remove' || action === 'supprimer') {
      const contactArg = ctx.args[1];
      if (!contactArg) {
        await ctx.reply('⚠️ Format : `.birthday del @contact`');
        return;
      }
      const contactJid = toJid(contactArg);
      const ok = birthdayService.remove(ownerJid, contactJid);
      await ctx.reply(ok ? `🗑️ Anniversaire supprimé de la base de données.` : `❌ Contact introuvable.`);
      return;
    }

    await ctx.reply('⚠️ Commande inconnue. Tapez `.birthday` pour voir le menu complet.');
  }
};

export default BirthdayCommand;
