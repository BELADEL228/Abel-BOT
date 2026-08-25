/**
 * Poll Command — Sondages dans les groupes WhatsApp
 *
 * Commandes :
 *   .poll <Question> | Option A | Option B | Option C   — Créer un sondage
 *   .poll end                                            — Clôturer et afficher résultats
 *   .poll results                                        — Voir résultats en cours
 *   .poll cancel                                         — Annuler le sondage
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import pollService from '../../services/automation/poll-service.js';

const PollCommand: IPluginCommand = {
  name: 'poll',
  aliases: ['sondage', 'vote'],
  category: 'Automation',
  description: 'Créer et gérer des sondages dans les groupes WhatsApp.',
  usage: '.poll <Question> | Option A | Option B | [Option C...]',
  cooldown: 5,
  groupOnly: true,
  userAdminRequired: false,

  async execute(ctx: CommandContext) {
    const action = ctx.args[0]?.toLowerCase();
    const groupJid = ctx.chat.id;

    // ── END ────────────────────────────────────────────────────────────────────
    if (action === 'end' || action === 'fin' || action === 'close' || action === 'clore') {
      const poll = pollService.close(groupJid);
      if (!poll) {
        await ctx.reply('❌ Aucun sondage actif dans ce groupe.');
        return;
      }
      await ctx.reply(pollService.formatResults(poll, true));
      return;
    }

    // ── RESULTS ───────────────────────────────────────────────────────────────
    if (action === 'results' || action === 'résultats' || action === 'stats') {
      const poll = pollService.getResults(groupJid);
      if (!poll) {
        await ctx.reply('❌ Aucun sondage actif dans ce groupe.');
        return;
      }
      await ctx.reply(pollService.formatResults(poll, poll.closed));
      return;
    }

    // ── CANCEL ────────────────────────────────────────────────────────────────
    if (action === 'cancel' || action === 'annuler') {
      const poll = pollService.getResults(groupJid);
      if (!poll || poll.closed) {
        await ctx.reply('❌ Aucun sondage actif à annuler.');
        return;
      }
      pollService.close(groupJid);
      await ctx.reply('🚫 Sondage annulé.');
      return;
    }

    // ── CREATE ────────────────────────────────────────────────────────────────
    const fullText = ctx.rawText.slice(ctx.rawText.indexOf(' ') + 1).trim();

    // Format: .poll Question? | Option A | Option B
    const parts = fullText.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 3) {
      await ctx.reply(
        '📊 *CRÉER UN SONDAGE*\n\n' +
        'Format :\n' +
        '`.poll Votre question ? | Option A | Option B | Option C`\n\n' +
        'Exemples :\n' +
        '• `.poll Où on se retrouve ? | Chez Abel | Au resto | En ligne`\n' +
        '• `.poll Réunion quand ? | Lundi | Mercredi | Vendredi`\n\n' +
        'Autres commandes :\n' +
        '• `.poll results` — Voir les résultats\n' +
        '• `.poll end` — Clôturer le sondage'
      );
      return;
    }

    const question = parts[0];
    const options = parts.slice(1);

    if (options.length > 9) {
      await ctx.reply('⚠️ Maximum 9 options par sondage.');
      return;
    }

    if (pollService.hasPoll(groupJid)) {
      await ctx.reply(
        '⚠️ Un sondage est déjà en cours dans ce groupe.\n\n' +
        '• `.poll results` pour voir les résultats\n' +
        '• `.poll end` pour le clôturer'
      );
      return;
    }

    const poll = pollService.create(groupJid, question, options, ctx.sender.id);

    // Format announcement
    const numberedOptions = poll.options.map(o => `${o.index}️⃣ ${o.text}`).join('\n');
    await ctx.reply(
      `╭━━〔 📊 SONDAGE 〕━━╮\n\n` +
      `❓ *${poll.question}*\n\n` +
      `${numberedOptions}\n\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
      `_Votez en répondant avec le numéro : *1*, *2*, *3*..._\n` +
      `_\`.poll end\` pour clôturer le sondage._`,
      { mentions: [] }
    );
  }
};

export default PollCommand;
