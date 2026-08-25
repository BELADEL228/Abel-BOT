/**
 * AutoReply Command — Interface complète de gestion du système AutoReply intelligent v2.
 *
 * États : ON | OFF | BUSY | AWAY | VACATION | SCHEDULED | PAUSED
 * Sous-commandes : status, stats, logs, allow, block, whitelist, blacklist,
 *                  cooldown, delay, schedule, until, keyword, message, category,
 *                  ignoregroup, groups, pause, resume, reset
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import autoReplyEngine from '../../services/automation/auto-reply-engine.js';
import autoReplyConfig from '../../services/automation/auto-reply-config.js';
import contactStore from '../../services/automation/auto-reply-contact-store.js';
import templateEngine from '../../services/automation/auto-reply-template-engine.js';
import ruleEngine from '../../services/automation/rule-engine.js';
import { botState } from '../../core/state/bot-state.js';
import type { AutoReplyTone } from '../../services/automation/ai-response-generator.js';
import type { ContactCategory } from '../../services/automation/auto-reply-contact-store.js';

// Helper to build a JID from a contact arg
function toJid(arg: string): string {
  return arg.startsWith('+') || /^\d/.test(arg)
    ? `${arg.replace(/\D/g, '')}@s.whatsapp.net`
    : `${arg.replace('@', '')}@s.whatsapp.net`;
}

const AutoReplyPlugin: IPluginCommand = {
  name: 'autoreply',
  aliases: [
    'setautoreply', 'autoresponse', 'followup', 'remind',
    'ar', 'autoreply'
  ],
  category: 'Automation',
  description: 'Système AutoReply intelligent v2 — Machine à états, cooldown 6h, templates catégorisés, file d\'attente, logs d\'audit.',
  usage: '.autoreply on/off/busy/away/vacation | .autoreply status | .autoreply stats | .autoreply logs',
  cooldown: 2,

  async execute(ctx: CommandContext) {
    const sub = ctx.commandName;
    const args = ctx.args;
    const action = args[0]?.toLowerCase();

    // ─── FOLLOW-UP ALIAS ──────────────────────────────────────────────────────
    if (sub === 'followup') {
      const mention = args.find(a => a.startsWith('@')) || args[0];
      const delay = args.find(a => /^\d+[mhd]$/i.test(a)) || '2d';
      if (!mention) {
        await ctx.reply('⚠️ Format : `.followup @contact <durée>` (ex: `.followup @228xxxxxxxx 2d`)');
        return;
      }
      const targetJid = toJid(mention);
      autoReplyEngine.addFollowUp(targetJid, mention, delay);
      await ctx.reply(`🔔 *FOLLOW-UP PROGRAMMÉ !*\n\n• Contact : ${mention}\n• Rappel dans : *${delay}*`);
      return;
    }

    // ─── REMIND ALIAS ─────────────────────────────────────────────────────────
    if (sub === 'remind') {
      const delay = args.find(a => /^\d+[mhd]$/i.test(a)) || '1h';
      const text = args.filter(a => !/^\d+[mhd]$/i.test(a)).join(' ');
      if (!text) {
        await ctx.reply('⚠️ Format : `.remind <texte> <durée>` (ex: `.remind Rappeler David pour devis 2h`)');
        return;
      }
      autoReplyEngine.addReminder(text, delay);
      await ctx.reply(`⏰ *RAPPEL PROGRAMMÉ !*\n\n• Tâche : "${text}"\n• Dans : *${delay}*`);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 1. ÉTAT DU SYSTÈME — ON / OFF / BUSY / AWAY / VACATION / PAUSE / RESUME
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'on' || action === 'enable') {
      await autoReplyConfig.setState('ON');
      await ctx.reply('✅ *AUTO-REPLY ACTIVÉ* — Mode : `ON`\nJe gère tes messages entrants intelligemment 🤖');
      return;
    }

    if (action === 'off' || action === 'disable') {
      await autoReplyConfig.setState('OFF');
      await ctx.reply('❌ *AUTO-REPLY DÉSACTIVÉ.* Toutes les réponses automatiques sont suspendues.');
      return;
    }

    if (action === 'busy') {
      await autoReplyConfig.setState('BUSY');
      await ctx.reply(
        '🔴 *MODE OCCUPÉ ACTIVÉ !*\n\n' +
        'Je répondrai à tes contacts avec le message "occupé" :\n' +
        `_"${templateEngine.getTemplates().busy.replace(/{firstName}/gi, 'Prénom')}"_`
      );
      return;
    }

    if (action === 'away') {
      await autoReplyConfig.setState('AWAY');
      await ctx.reply(
        '🟡 *MODE ABSENT ACTIVÉ !*\n\n' +
        'Je répondrai avec le message "absent" :\n' +
        `_"${templateEngine.getTemplates().away.replace(/{firstName}/gi, 'Prénom')}"_`
      );
      return;
    }

    if (action === 'vacation') {
      const dateArg = args[1]; // ex: "20/08/2026" or "+7d"
      if (dateArg) {
        if (!(await autoReplyConfig.setVacationUntil(dateArg))) {
          await ctx.reply('⚠️ Format date invalide. Exemples : `.autoreply vacation 20/08/2026` ou `.autoreply vacation +7d`');
          return;
        }
        await autoReplyConfig.setState('VACATION');
        const untilStr = autoReplyConfig.vacationUntil
          ? autoReplyConfig.vacationUntil.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
          : 'bientôt';
        await ctx.reply(
          `🌴 *MODE VACANCES ACTIVÉ jusqu'au ${untilStr} !*\n\n` +
          'Message envoyé :\n' +
          `_"${templateEngine.getTemplates().vacation.replace(/{firstName}/gi, 'Prénom').replace(/{untilDate}/gi, untilStr)}"_`
        );
      } else {
        await autoReplyConfig.setState('VACATION');
        await ctx.reply(
          '🌴 *MODE VACANCES ACTIVÉ !*\n\n' +
          '💡 Pour définir une date de fin : `.autoreply vacation 20/08/2026` ou `.autoreply vacation +7d`'
        );
      }
      return;
    }

    if (action === 'pause') {
      await autoReplyConfig.pause();
      await ctx.reply('⏸️ *AUTO-REPLY MIS EN PAUSE.* Tape `.autoreply resume` pour reprendre.');
      return;
    }

    if (action === 'resume') {
      await autoReplyConfig.resume();
      await ctx.reply(`▶️ *AUTO-REPLY REPRIS !* État actuel : \`${autoReplyConfig.state}\``);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 2. STATUS — Tableau de bord complet
    // ════════════════════════════════════════════════════════════════════════════

    if (!action || action === 'status') {
      const stateEmoji: Record<string, string> = {
        OFF: '🔴', ON: '🟢', BUSY: '🟠', AWAY: '🟡', VACATION: '🌴', SCHEDULED: '🕒', PAUSED: '⏸️'
      };
      const emoji = stateEmoji[autoReplyConfig.state] || '⚪';

      const scheduleText = autoReplyConfig.schedule
        ? `${autoReplyConfig.schedule.rawString}`
        : 'Aucun (24h/24)';

      const vacationText = autoReplyConfig.vacationUntil
        ? `Jusqu'au ${autoReplyConfig.vacationUntil.toLocaleDateString('fr-FR')}`
        : 'Non défini';

      const totalWhitelist = contactStore.getWhitelist().length + botState.whitelistedUsers.size;
      const totalBlocklist = contactStore.getBlocklist().length + botState.blacklistedUsers.size;
      const totalSudo = botState.sudoUsers.size;

      const statusCard =
        `${emoji} *TABLEAU DE BORD AUTO-REPLY v2*\n\n` +
        `📊 *État :* \`${autoReplyConfig.state}\`\n` +
        `🤖 *Moteur IA :* ${autoReplyEngine.isAiEnabled ? '✅ Actif' : '❌ Inactif (Templates)'}\n` +
        `🎭 *Ton IA :* \`${autoReplyEngine.tone.toUpperCase()}\`\n` +
        `🌐 *Mode :* \`${autoReplyEngine.mode.toUpperCase()}\`\n\n` +
        `⏱️ *Cooldown par contact :* \`${autoReplyConfig.cooldownHours}h\`\n` +
        `⚡ *Délai d'envoi :* \`${autoReplyConfig.minDelaySeconds}-${autoReplyConfig.maxDelaySeconds}s\`\n` +
        `🛡️ *Limite globale :* \`${autoReplyConfig.maxPerHour} msg/heure\` (actuel: ${autoReplyConfig.getHourlyCount()})\n` +
        `💬 *Fenêtre humaine :* \`${autoReplyConfig.humanActiveWindowMinutes} min\`\n\n` +
        `🗓️ *Horaires :* \`${scheduleText}\`\n` +
        `🌴 *Vacances :* \`${vacationText}\`\n\n` +
        `📋 *Listes :*\n` +
        `• Whitelist : ${totalWhitelist} | Sudo : ${totalSudo} | Blacklist : ${totalBlocklist}\n` +
        `• Contacts custom : ${ruleEngine.customContacts.size}\n` +
        `• Mots-clés déclencheurs : ${ruleEngine.keywords.size}\n` +
        `• Mots-clés urgents : ${autoReplyConfig.urgentKeywords.size}\n` +
        `• Groupes ignorés : ${autoReplyConfig.ignoredGroups.size}\n\n` +
        `💡 \`.autoreply on/off/busy/away/vacation/pause/resume\``;

      await ctx.reply(statusCard);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 3. STATS — Statistiques détaillées
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'stats') {
      const s = autoReplyEngine.stats;
      const cs = contactStore.getStats();

      let topContact = 'Aucun';
      let maxCount = 0;
      for (const [name, cnt] of s.contactFrequency.entries()) {
        if (cnt > maxCount) { maxCount = cnt; topContact = `${name} (${cnt} messages)`; }
      }

      const statsCard =
        `╭━━〔 📊 AUTOREPLY STATS v2 〕━━╮\n\n` +
        `État : ${autoReplyConfig.state}\n\n` +
        `📥 Messages analysés : ${s.totalReceived}\n` +
        `📤 Réponses envoyées : ${cs.replied}\n` +
        `🚫 Messages ignorés : ${cs.ignored}\n` +
        `❌ Auto-replies annulés : ${cs.canceled}\n` +
        `🚨 Alertes urgentes : ${cs.notified + s.urgentAlertsSent}\n\n` +
        `⚡ *Détail des réponses :*\n` +
        `• Générées par IA : ${s.aiReplies}\n` +
        `• Par contact custom : ${s.customContactReplies}\n` +
        `• Par mot-clé : ${s.keywordReplies}\n` +
        `• Cooldowns bloqués : ${s.cooldownIgnored}\n\n` +
        `🏆 Contact le plus actif : ${topContact}\n\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

      await ctx.reply(statsCard);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 4. LOGS — Journal des décisions
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'logs') {
      const limit = parseInt(args[1] ?? '10', 10);
      const logs = contactStore.getLogs(isNaN(limit) ? 10 : limit);

      if (logs.length === 0) {
        await ctx.reply('📋 *Aucune décision enregistrée pour le moment.*');
        return;
      }

      const decisionEmoji: Record<string, string> = {
        REPLY: '📤', IGNORE: '🚫', NOTIFY_OWNER: '🚨', CANCELED: '❌'
      };

      let logStr = `📋 *JOURNAL AUTO-REPLY (${logs.length} dernières décisions) :*\n\n`;
      for (const log of logs) {
        const d = new Date(log.sentAt);
        const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const emoji = decisionEmoji[log.decision] || '•';
        logStr += `${emoji} *${log.decision}* · \`${log.reason}\`\n`;
        logStr += `   👤 @${log.contactJid.split('@')[0]} · ⏰ ${timeStr}\n`;
        logStr += `   💬 "${log.messageText.slice(0, 60)}${log.messageText.length > 60 ? '...' : ''}"\n\n`;
      }

      await ctx.reply(logStr.trim());
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 5. WHITELIST / ALLOW (contacts autorisés)
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'allow' || action === 'whitelist') {
      const sub2 = args[1]?.toLowerCase();
      const contactArg = args[2] || args[1];

      if ((sub2 === 'add' || (sub2 && sub2 !== 'list' && sub2 !== 'remove')) && contactArg) {
        const jid = toJid(sub2 === 'add' ? contactArg : sub2);
        contactStore.allow(jid);
        ruleEngine.addToWhitelist(jid);
        await ctx.reply(`✅ @${jid.split('@')[0]} ajouté à la *liste blanche*.`, { mentions: [jid] });
        return;
      }
      if (sub2 === 'remove' && contactArg) {
        const jid = toJid(contactArg);
        contactStore.unallow(jid);
        ruleEngine.removeFromWhitelist(jid);
        await ctx.reply(`🗑️ @${jid.split('@')[0]} retiré de la liste blanche.`, { mentions: [jid] });
        return;
      }
      // List
      const wl = contactStore.getWhitelist();
      if (wl.length === 0) {
        await ctx.reply('📋 Liste blanche vide.\n💡 `.autoreply allow +228XXXXXXXX`');
        return;
      }
      await ctx.reply(`📋 *LISTE BLANCHE (${wl.length}) :*\n\n${wl.map(j => `• @${j.split('@')[0]}`).join('\n')}`, { mentions: wl });
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 6. BLACKLIST / BLOCK (contacts bloqués)
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'block' || action === 'blacklist') {
      const sub2 = args[1]?.toLowerCase();
      const contactArg = args[2] || args[1];

      if ((sub2 === 'add' || (sub2 && sub2 !== 'list' && sub2 !== 'remove')) && contactArg) {
        const jid = toJid(sub2 === 'add' ? contactArg : sub2);
        contactStore.block(jid);
        ruleEngine.addToBlacklist(jid);
        await ctx.reply(`🚫 @${jid.split('@')[0]} ajouté à la *liste noire*. Ne recevra plus de réponse automatique.`, { mentions: [jid] });
        return;
      }
      if (sub2 === 'remove' && contactArg) {
        const jid = toJid(contactArg);
        contactStore.unblock(jid);
        ruleEngine.removeFromBlacklist(jid);
        await ctx.reply(`🗑️ @${jid.split('@')[0]} retiré de la liste noire.`, { mentions: [jid] });
        return;
      }
      // List
      const bl = contactStore.getBlocklist();
      if (bl.length === 0) {
        await ctx.reply('📋 Liste noire vide.\n💡 `.autoreply block +228XXXXXXXX`');
        return;
      }
      await ctx.reply(`📋 *LISTE NOIRE (${bl.length}) :*\n\n${bl.map(j => `• @${j.split('@')[0]}`).join('\n')}`, { mentions: bl });
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 7. CATEGORY — Catégoriser un contact
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'category' || action === 'cat') {
      const contactArg = args[1];
      const catArg = args[2]?.toUpperCase() as ContactCategory;
      const validCats: ContactCategory[] = ['FRIEND', 'WORK', 'FAMILY', 'PERSONAL', 'UNKNOWN'];
      if (!contactArg || !validCats.includes(catArg)) {
        await ctx.reply(
          '⚠️ Format : `.autoreply category @contact <catégorie>`\n\n' +
          'Catégories : `FRIEND` | `WORK` | `FAMILY` | `PERSONAL` | `UNKNOWN`\n\n' +
          'Exemple : `.autoreply category @228xxxxxxxx WORK`'
        );
        return;
      }
      const jid = toJid(contactArg);
      contactStore.setCategory(jid, catArg);
      const catLabels: Record<string, string> = {
        FRIEND: '🤝 Ami', WORK: '💼 Professionnel', FAMILY: '❤️ Famille', PERSONAL: '👤 Personnel', UNKNOWN: '❓ Inconnu'
      };
      await ctx.reply(`✅ @${jid.split('@')[0]} classé comme *${catLabels[catArg]}*.`, { mentions: [jid] });
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 8. COOLDOWN — Durée entre deux réponses au même contact
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'cooldown') {
      const dur = args[1]?.toLowerCase();
      if (!dur) {
        await ctx.reply(`⏱️ Cooldown actuel : \`${autoReplyConfig.cooldownHours}h\`\nFormat : \`.autoreply cooldown 6h\` | \`1h\` | \`12h\` | \`24h\``);
        return;
      }
      const match = dur.match(/^(\d+)(m|h|d)$/);
      if (!match) {
        await ctx.reply('⚠️ Format : `.autoreply cooldown 6h` ou `30m` ou `12h` ou `24h`');
        return;
      }
      const val = parseInt(match[1], 10);
      const unit = match[2];
      let hours = val;
      if (unit === 'm') hours = val / 60;
      if (unit === 'd') hours = val * 24;
      autoReplyConfig.cooldownHours = hours;
      await ctx.reply(`⏱️ *COOLDOWN DÉFINI SUR :* \`${dur}\`\nUn même contact ne recevra de réponse automatique qu'une fois par ${dur}.`);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 9. DELAY — Délai de frappe humaine avant envoi
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'delay') {
      const fullInput = args.slice(1).join(' ').trim().toLowerCase();

      if (!fullInput) {
        const minStr = autoReplyConfig.minDelaySeconds >= 60 ? `${(autoReplyConfig.minDelaySeconds / 60).toFixed(autoReplyConfig.minDelaySeconds % 60 === 0 ? 0 : 1)} min` : `${autoReplyConfig.minDelaySeconds}s`;
        const maxStr = autoReplyConfig.maxDelaySeconds >= 60 ? `${(autoReplyConfig.maxDelaySeconds / 60).toFixed(autoReplyConfig.maxDelaySeconds % 60 === 0 ? 0 : 1)} min` : `${autoReplyConfig.maxDelaySeconds}s`;
        await ctx.reply(
          `⏱️ *Délai d'attente actuel :* \`${minStr} - ${maxStr}\` (${autoReplyConfig.minDelaySeconds}-${autoReplyConfig.maxDelaySeconds} secondes)\n\n` +
          `💡 *Exemples de réglage :*\n` +
          `• \`.autoreply delay 5 min\` ou \`.autoreply delay 5m\` ➜ Attend 5 minutes\n` +
          `• \`.autoreply delay 10 min\` ou \`.autoreply delay 10m\` ➜ Attend 10 minutes\n` +
          `• \`.autoreply delay 5-10 min\` ou \`.autoreply delay 5-10m\` ➜ Attend entre 5 et 10 minutes\n` +
          `• \`.autoreply delay 30s\` ➜ Attend 30 secondes\n` +
          `• \`.autoreply delay off\` ➜ Instantané (~1-2s)\n\n` +
          `ℹ️ _Si vous ouvrez la conversation ou répondez vous-même pendant ce délai, l'auto-réponse est instantanément annulée !_`
        );
        return;
      }

      if (fullInput === 'off' || fullInput === '0' || fullInput === 'instant') {
        autoReplyConfig.minDelaySeconds = 1;
        autoReplyConfig.maxDelaySeconds = 2;
        await autoReplyConfig.save();
        await ctx.reply('⚡ *Délai d\'attente désactivé* ➜ Réponses immédiates (~1-2s).');
        return;
      }

      // 1. Check for Range with units: "5-10m", "5 - 10 min", "5 à 10 minutes", "30-60s", "300-600"
      const rangeMatch = fullInput.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secondes?|m|min|minutes?)?\s*(?:-|à|a|to|\.\.)\s*(\d+(?:\.\d+)?)\s*(s|sec|secondes?|m|min|minutes?)?$/i);
      if (rangeMatch) {
        const minNum = parseFloat(rangeMatch[1]);
        const minUnit = (rangeMatch[2] || rangeMatch[4] || 'min').toLowerCase();
        const maxNum = parseFloat(rangeMatch[3]);
        const maxUnit = (rangeMatch[4] || rangeMatch[2] || 'min').toLowerCase();

        const isMinM = minUnit.startsWith('m');
        const isMaxM = maxUnit.startsWith('m');

        const minSeconds = Math.round(isMinM ? minNum * 60 : minNum);
        const maxSeconds = Math.round(isMaxM ? maxNum * 60 : maxNum);

        autoReplyConfig.minDelaySeconds = Math.max(1, Math.min(minSeconds, maxSeconds));
        autoReplyConfig.maxDelaySeconds = Math.max(1, Math.max(minSeconds, maxSeconds));
        await autoReplyConfig.save();

        const minDisplay = autoReplyConfig.minDelaySeconds >= 60 ? `${(autoReplyConfig.minDelaySeconds / 60).toFixed(autoReplyConfig.minDelaySeconds % 60 === 0 ? 0 : 1)} min` : `${autoReplyConfig.minDelaySeconds}s`;
        const maxDisplay = autoReplyConfig.maxDelaySeconds >= 60 ? `${(autoReplyConfig.maxDelaySeconds / 60).toFixed(autoReplyConfig.maxDelaySeconds % 60 === 0 ? 0 : 1)} min` : `${autoReplyConfig.maxDelaySeconds}s`;

        await ctx.reply(
          `⏱️ *DÉLAI D'ATTENTE ENREGISTRÉ :* \`${minDisplay} - ${maxDisplay}\` (${autoReplyConfig.minDelaySeconds}-${autoReplyConfig.maxDelaySeconds}s)\n\n` +
          `Le bot attendra entre *${minDisplay}* et *${maxDisplay}* sans lecture ni réponse de votre part avant d'envoyer l'auto-reply.\n` +
          `Si vous lisez ou répondez avant, l'auto-réponse est automatiquement annulée !`
        );
        return;
      }

      // 2. Check for Single value with or without unit: "10m", "10 min", "10 minutes", "30s", "300", "5"
      const singleMatch = fullInput.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secondes?|m|min|minutes?)?$/i);
      if (singleMatch) {
        const num = parseFloat(singleMatch[1]);
        const unit = singleMatch[2]?.toLowerCase();

        let seconds: number;
        if (unit) {
          seconds = unit.startsWith('m') ? Math.round(num * 60) : Math.round(num);
        } else {
          // If no unit provided: if <= 30, treat as minutes (e.g. 5 = 5 min, 10 = 10 min), else seconds (e.g. 300 = 300s)
          seconds = num <= 30 ? Math.round(num * 60) : Math.round(num);
        }

        seconds = Math.max(1, seconds);
        autoReplyConfig.minDelaySeconds = seconds;
        autoReplyConfig.maxDelaySeconds = seconds;
        await autoReplyConfig.save();

        const display = seconds >= 60 ? `${(seconds / 60).toFixed(seconds % 60 === 0 ? 0 : 1)} minute(s)` : `${seconds} seconde(s)`;
        await ctx.reply(
          `⏱️ *DÉLAI D'ATTENTE ENREGISTRÉ :* \`${display}\` (${seconds} secondes)\n\n` +
          `Le bot attendra *${display}* sans lecture ni réponse de votre part avant d'envoyer l'auto-reply.\n` +
          `Si vous lisez ou répondez avant, l'auto-réponse est automatiquement annulée !`
        );
        return;
      }

      await ctx.reply(
        '⚠️ Format non reconnu.\n\n' +
        'Exemples :\n' +
        '• `.autoreply delay 5 min` ou `.autoreply delay 5m`\n' +
        '• `.autoreply delay 10 min` ou `.autoreply delay 10m`\n' +
        '• `.autoreply delay 5-10 min`\n' +
        '• `.autoreply delay 30s`\n' +
        '• `.autoreply delay off`'
      );
      return;
    }

    if (action === 'limit') {
      const val = parseInt(args[1], 10);
      if (isNaN(val) || val < 1) {
        await ctx.reply(`🛡️ Limite actuelle : \`${autoReplyConfig.maxPerHour} msg/heure\`\nFormat : \`.autoreply limit 50\``);
        return;
      }
      autoReplyConfig.maxPerHour = val;
      await autoReplyConfig.save();
      await ctx.reply(`🛡️ *LIMITE GLOBALE DÉFINIE SUR :* \`${val} messages par heure\`.`);
      return;
    }

    if (action === 'activewindow' || action === 'window') {
      const val = parseInt(args[1], 10);
      if (isNaN(val) || val < 0) {
        await ctx.reply(`💬 Fenêtre humaine actuelle : \`${autoReplyConfig.humanActiveWindowMinutes} min\`\nFormat : \`.autoreply activewindow 30\``);
        return;
      }
      autoReplyConfig.humanActiveWindowMinutes = val;
      await autoReplyConfig.save();
      await ctx.reply(`💬 *FENÊTRE HUMAINE DÉFINIE SUR :* \`${val} minutes\`\n(Le bot attendra ce délai après ton dernier message avant de reprendre)`);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 10. SCHEDULE — Plage horaire d'activation
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'schedule') {
      const sched = args.slice(1).join(' ');
      if (sched === 'off') {
        await autoReplyConfig.clearSchedule();
        if (autoReplyConfig.state === 'SCHEDULED') await autoReplyConfig.setState('OFF');
        await ctx.reply('🕒 *HORAIRES SUPPRIMÉS.* Auto-reply sans restriction horaire.');
        return;
      }
      if (sched && await autoReplyConfig.setSchedule(sched)) {
        await autoReplyConfig.setState('SCHEDULED');
        await ctx.reply(
          `🕒 *HORAIRES DÉFINIS :* \`${sched}\`\n\n` +
          `L'auto-reply est maintenant en mode *SCHEDULED* et ne s'active que sur cette plage.`
        );
        return;
      }
      await ctx.reply(
        '⚠️ Format : `.autoreply schedule 18:00-08:00` ou `.autoreply schedule lundi-vendredi 18:00-08:00`\n' +
        'Tape `.autoreply schedule off` pour désactiver les horaires.'
      );
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 11. UNTIL — Actif jusqu'à une date
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'until') {
      const dateStr = args.slice(1).join(' ');
      if (!dateStr) {
        await ctx.reply('⚠️ Format : `.autoreply until 20/08/2026` ou `.autoreply until +3d`');
        return;
      }
      if (await autoReplyConfig.setVacationUntil(dateStr)) {
        await autoReplyConfig.setState('VACATION');
        const untilStr = autoReplyConfig.vacationUntil!.toLocaleDateString('fr-FR');
        await ctx.reply(`⏳ *AUTO-REPLY ACTIF JUSQU'AU :* \`${untilStr}\` (Mode VACATION)`);
      } else {
        await ctx.reply('⚠️ Date invalide. Format accepté : `20/08/2026` ou `+7d`');
      }
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 12. KEYWORDS — Mots-clés de réponse et mots-clés urgents
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'keyword' || action === 'keywords') {
      const kwAction = args[1]?.toLowerCase();
      const kwTarget = args[2]?.toLowerCase();

      if (kwAction === 'urgent') {
        const urgentSub = kwTarget;
        const kw = args[3]?.toLowerCase();
        if (urgentSub === 'add' && kw) {
          autoReplyConfig.urgentKeywords.add(kw);
          await ctx.reply(`🚨 Mot-clé urgent ajouté : \`${kw}\``);
          return;
        }
        if (urgentSub === 'remove' && kw) {
          autoReplyConfig.urgentKeywords.delete(kw);
          await ctx.reply(`🗑️ Mot-clé urgent supprimé : \`${kw}\``);
          return;
        }
        const list = Array.from(autoReplyConfig.urgentKeywords).join(', ');
        await ctx.reply(`🚨 *Mots-clés urgents (${autoReplyConfig.urgentKeywords.size}) :*\n\n${list}`);
        return;
      }

      if (kwAction === 'add') {
        const kw = args[2]?.toLowerCase();
        const kwMsg = args.slice(3).join(' ');
        if (!kw || !kwMsg) {
          await ctx.reply('⚠️ Format : `.autoreply keyword add <mot> <réponse>`\nExemple : `.autoreply keyword add facture Je te renvoie la facture dès que je suis disponible.`');
          return;
        }
        ruleEngine.setKeyword(kw, kwMsg);
        await ctx.reply(`🏷️ *MOT-CLÉ ENREGISTRÉ :* \`${kw}\`\nRéponse : "${kwMsg}"`);
        return;
      }
      if (kwAction === 'remove') {
        const kw = args[2]?.toLowerCase();
        if (!kw) { await ctx.reply('⚠️ Format : `.autoreply keyword remove <mot>`'); return; }
        const ok = ruleEngine.removeKeyword(kw);
        await ctx.reply(ok ? `🗑️ Mot-clé \`${kw}\` supprimé.` : '❌ Mot-clé introuvable.');
        return;
      }
      // list
      if (ruleEngine.keywords.size === 0) {
        await ctx.reply('📋 Aucun mot-clé de réponse.\n💡 `.autoreply keyword add <mot> <réponse>`');
        return;
      }
      let kl = `🏷️ *MOTS-CLÉS (${ruleEngine.keywords.size}) :*\n\n`;
      for (const [kw, msg] of ruleEngine.keywords.entries()) {
        kl += `• *${kw}* ➜ "${msg.slice(0, 60)}${msg.length > 60 ? '...' : ''}"\n`;
      }
      await ctx.reply(kl);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 13. MESSAGE / SET — Template par défaut
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'message' || action === 'set' || sub === 'setautoreply') {
      const subType = action === 'set' || sub === 'setautoreply' ? 'default' : args[1]?.toLowerCase();
      const validTypes = ['default', 'busy', 'away', 'vacation', 'night'];

      if (validTypes.includes(subType || '')) {
        const msg = args.slice(action === 'message' ? 2 : 1).join(' ');
        if (!msg) {
          const cur = templateEngine.getTemplates();
          await ctx.reply(
            `📝 *Templates actuels :*\n\n` +
            `• *default :* "${cur.default}"\n` +
            `• *busy :* "${cur.busy}"\n` +
            `• *away :* "${cur.away}"\n` +
            `• *vacation :* "${cur.vacation}"\n` +
            `• *night :* "${cur.night}"\n\n` +
            `Variables : \`{firstName}\` \`{name}\` \`{time}\` \`{date}\` \`{day}\` \`{ownerName}\` \`{untilDate}\`\n\n` +
            `Modifier : \`.autoreply message busy <nouveau texte>\``
          );
          return;
        }
        templateEngine.updateTemplates({ [subType || 'default']: msg } as any);
        await ctx.reply(`✏️ *Template \`${subType || 'default'}\` mis à jour :*\n\n"${msg}"`);
      } else {
        // Direct set (legacy): .autoreply set <msg>
        const msg = args.slice(1).join(' ');
        if (!msg) {
          await ctx.reply('⚠️ Format : `.autoreply message default <votre message>` ou `.autoreply message busy <texte>`');
          return;
        }
        ruleEngine.defaultMessage = msg;
        templateEngine.updateTemplates({ default: msg });
        await ctx.reply(`✏️ *Message par défaut enregistré :*\n\n"${msg}"`);
      }
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 14. CONTACT CUSTOM REPLY — Réponse individuelle par contact
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'add') {
      const contactArg = args[1];
      const msg = args.slice(2).join(' ');
      if (!contactArg || !msg) {
        await ctx.reply('⚠️ Format : `.autoreply add @contact <message personnalisé>`');
        return;
      }
      const jid = toJid(contactArg);
      ruleEngine.setContactReply(jid, msg);
      contactStore.setCustomTemplate(jid, msg);
      await ctx.reply(`👤 *Réponse personnalisée enregistrée pour @${jid.split('@')[0]} :*\n\n"${msg}"`, { mentions: [jid] });
      return;
    }

    if (action === 'remove') {
      const contactArg = args[1];
      if (!contactArg) { await ctx.reply('⚠️ Format : `.autoreply remove @contact`'); return; }
      const jid = toJid(contactArg);
      ruleEngine.removeContactReply(jid);
      contactStore.removeCustomTemplate(jid);
      await ctx.reply(`🗑️ Réponse personnalisée supprimée pour @${jid.split('@')[0]}.`, { mentions: [jid] });
      return;
    }

    if (action === 'list') {
      if (ruleEngine.customContacts.size === 0) {
        await ctx.reply('📋 Aucune réponse par contact.\n💡 `.autoreply add @contact <message>`');
        return;
      }
      let report = `📋 *RÉPONSES PAR CONTACT (${ruleEngine.customContacts.size}) :*\n\n`;
      const mentions: string[] = [];
      let i = 1;
      for (const [jid, msg] of ruleEngine.customContacts.entries()) {
        mentions.push(jid);
        report += `${i++}. @${jid.split('@')[0]}\n   └─ "${msg.slice(0, 60)}..."\n\n`;
      }
      await ctx.reply(report, { mentions });
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 15. AI CONTROLS
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'ai') {
      const opt = args[1]?.toLowerCase();
      if (opt === 'on') { autoReplyEngine.isAiEnabled = true; await ctx.reply('🤖 *Moteur IA ACTIVÉ !* Réponses 100% naturelles.'); return; }
      if (opt === 'off') { autoReplyEngine.isAiEnabled = false; await ctx.reply('❌ *Moteur IA DÉSACTIVÉ.* Utilisation des templates.'); return; }
      await ctx.reply(`🤖 Moteur IA : ${autoReplyEngine.isAiEnabled ? '✅ Actif' : '❌ Inactif'}`);
      return;
    }

    if (action === 'tone') {
      const validTones: AutoReplyTone[] = ['casual', 'friendly', 'formal', 'professional', 'short'];
      const t = args[1]?.toLowerCase() as AutoReplyTone;
      if (!validTones.includes(t)) {
        await ctx.reply('🎭 Tons : `casual` | `friendly` | `formal` | `professional` | `short`');
        return;
      }
      autoReplyEngine.tone = t;
      await ctx.reply(`🎭 *Ton IA défini sur :* \`${t.toUpperCase()}\``);
      return;
    }

    if (action === 'context') {
      const opt = args[1]?.toLowerCase();
      if (opt === 'on') { autoReplyEngine.isContextEnabled = true; await ctx.reply('🧠 Contexte de conversation ACTIVÉ.'); return; }
      if (opt === 'off') { autoReplyEngine.isContextEnabled = false; await ctx.reply('🧠 Contexte de conversation DÉSACTIVÉ.'); return; }
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 16. MODE — Scope (private / groups / all / whitelist)
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'mode') {
      const m = args[1]?.toLowerCase();
      if (['all', 'private', 'groups', 'unknown', 'whitelist'].includes(m)) {
        autoReplyEngine.mode = m as any;
        await ctx.reply(`🌐 *Mode défini sur :* \`${m.toUpperCase()}\``);
        return;
      }
      await ctx.reply('⚠️ Modes : `all` | `private` | `groups` | `unknown` | `whitelist`');
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 17. GROUPS — Enable/disable auto-reply in groups
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'groups') {
      const opt = args[1]?.toLowerCase();
      if (opt === 'on') { autoReplyConfig.groupsEnabled = true; await ctx.reply('👥 Auto-reply dans les groupes ACTIVÉ.'); return; }
      if (opt === 'off') { autoReplyConfig.groupsEnabled = false; await ctx.reply('👥 Auto-reply dans les groupes DÉSACTIVÉ.'); return; }
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 18. IGNOREGROUP — Ignorer un groupe spécifique
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'ignoregroup') {
      const gid = ctx.chat.id.endsWith('@g.us') ? ctx.chat.id : args[1]?.includes('@g.us') ? args[1] : null;
      const sub2 = args[1]?.toLowerCase();
      if (sub2 === 'list') {
        const groups = Array.from(autoReplyConfig.ignoredGroups);
        await ctx.reply(groups.length > 0 ? `📋 Groupes ignorés :\n${groups.join('\n')}` : '📋 Aucun groupe ignoré.');
        return;
      }
      if (gid) {
        if (autoReplyConfig.isGroupIgnored(gid)) {
          autoReplyConfig.unignoreGroup(gid);
          await ctx.reply('✅ Ce groupe n\'est plus ignoré. L\'auto-reply peut y fonctionner.');
        } else {
          autoReplyConfig.ignoreGroup(gid);
          await ctx.reply('🚫 Ce groupe est maintenant ignoré. Aucun auto-reply ne sera envoyé ici.');
        }
        return;
      }
      await ctx.reply('⚠️ Exécute cette commande dans le groupe à ignorer.');
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // 19. RESET — Réinitialiser un contact ou les stats
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'reset') {
      const sub2 = args[1]?.toLowerCase();
      if (sub2 === 'stats') {
        autoReplyEngine.stats = {
          totalReceived: 0, autoRepliesSent: 0, ignored: 0, cooldownIgnored: 0,
          aiReplies: 0, customContactReplies: 0, keywordReplies: 0, urgentAlertsSent: 0,
          contactFrequency: new Map()
        };
        await ctx.reply('🔄 Statistiques remises à zéro.');
        return;
      }
      if (sub2) {
        const jid = toJid(sub2);
        contactStore.resetCooldown(jid);
        await ctx.reply(`🔄 Cooldown réinitialisé pour @${jid.split('@')[0]}.`, { mentions: [jid] });
        return;
      }
      templateEngine.updateTemplates({
        default: "Salut {firstName} 👋 Je suis actuellement occupé. J'ai bien reçu ton message et je reviens vers toi au plus vite.",
        busy: "Salut {firstName} ! Je suis actuellement très occupé. J'ai bien noté ton message et je te réponds dès que j'ai un moment 🙏",
        away: "Hey {firstName} ! Je suis absent pour l'instant. J'ai bien reçu ton message et je reviendrai vers toi dès que possible.",
        vacation: "Bonjour {firstName} 👋 Je suis en congés jusqu'au {untilDate}. Je prendrai connaissance de ton message à mon retour !",
        night: "Bonsoir {firstName}. Il est un peu tard, je prendrai connaissance de ton message demain matin."
      });
      await ctx.reply('🔄 *Templates réinitialisés aux valeurs par défaut.*');
      return;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // Legacy: .autoreply wait / ownerremind / for / until (schedule-manager)
    // ════════════════════════════════════════════════════════════════════════════

    if (action === 'wait') {
      const dur = args[1]?.toLowerCase();
      const match = dur?.match(/^(\d+)(s|m|h)$/);
      if (match) {
        const val = parseInt(match[1], 10);
        const unit = match[2];
        let secs = val;
        if (unit === 'm') secs = val * 60;
        if (unit === 'h') secs = val * 3600;
        autoReplyConfig.minDelaySeconds = Math.max(3, secs);
        autoReplyConfig.maxDelaySeconds = Math.max(5, secs + 10);
        await ctx.reply(`⏱️ Délai avant réponse : \`${dur}\``);
        return;
      }
      await ctx.reply(`⏱️ Délai actuel : \`${autoReplyConfig.minDelaySeconds}-${autoReplyConfig.maxDelaySeconds}s\`\nFormat : \`.autoreply wait 10s\` | \`1m\``);
      return;
    }

    if (action === 'ownerremind' || action === 'reminder') {
      await ctx.reply('ℹ️ Le rappel propriétaire est fixé à *2 heures* après chaque réponse automatique envoyée.');
      return;
    }

    if (action === 'for') {
      // Treat .autoreply for 2h as enabling for a duration → BUSY mode
      const dur = args[1];
      if (dur && await autoReplyConfig.setVacationUntil(`+${dur}`)) {
        await autoReplyConfig.setState('BUSY');
        await ctx.reply(`⏳ Auto-reply *BUSY* activé pour : \`${dur}\``);
      } else {
        await ctx.reply('⚠️ Format : `.autoreply for 2h` ou `.autoreply for 30m`');
      }
      return;
    }

    // Default help
    await ctx.reply(
      '💡 *AIDE AUTO-REPLY v2*\n\n' +
      '*États :*\n' +
      '`.autoreply on` | `off` | `busy` | `away` | `vacation 20/08` | `pause` | `resume`\n\n' +
      '*Configuration :*\n' +
      '`.autoreply cooldown 6h` | `delay 5-20` | `mode private`\n\n' +
      '*Contacts :*\n' +
      '`.autoreply allow @user` | `block @user` | `category @user WORK`\n\n' +
      '*Templates :*\n' +
      '`.autoreply message busy <texte>` | `message default <texte>`\n\n' +
      '*Informations :*\n' +
      '`.autoreply status` | `stats` | `logs`'
    );
  }
};

export default AutoReplyPlugin;
