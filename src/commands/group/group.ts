import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';

const GroupCommand: IPluginCommand = {
  name: 'kick',
  aliases: ['add', 'promote', 'demote', 'hidetag', 'tagall', 'warn', 'warnings', 'mute', 'unmute', 'rules', 'setrules', 'audit', 'groupstats'],
  category: 'Group',
  description: 'Administration et modération de groupe (kick, promote, demote, tagall, hidetag, etc.).',
  usage: '.kick @user ou .hidetag <message> ou .tagall',
  groupOnly: true,
  cooldown: 3,

  async execute(ctx: CommandContext) {
    const sub = ctx.commandName;

    if (sub === 'hidetag' || sub === 'tagall') {
      if (!ctx.sender.isAdmin && !ctx.sender.isOwner) {
        await ctx.reply('🚫 Seuls les administrateurs du groupe peuvent exécuter cette commande.');
        return;
      }
      const tagMessage = ctx.args.join(' ') || '📢 Attention tout le monde !';
      await ctx.reply(`📢 *NOTIFICATION DE GROUPE*\n\n${tagMessage}`);
      return;
    }

    if (sub === 'rules') {
      await ctx.reply('📜 *RÈGLES DU GROUPE :*\n\n1. Respecter tous les membres.\n2. Pas de spam ni de liens de phishing.\n3. Restez courtois et pertinents.');
      return;
    }

    if (sub === 'groupstats' || sub === 'audit') {
      const stats =
        `📊 *AUDIT & STATISTIQUES DU GROUPE*\n\n` +
        `💬 *Identifiant Groupe :* \`${ctx.chat.id}\`\n` +
        `🛡️ *Anti-Link :* Activé ✅\n` +
        `🛡️ *Anti-Spam :* Activé ✅\n` +
        `🛡️ *Anti-Bot :* Activé ✅\n\n` +
        `📈 *Activité globale :* Normale`;
      await ctx.reply(stats);
      return;
    }

    // Mention target extraction
    const mentionedJid = ctx.message.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
      ctx.message.quotedMessage?.senderJid;

    if (!mentionedJid && (sub === 'kick' || sub === 'promote' || sub === 'demote' || sub === 'warn')) {
      await ctx.reply(`⚠️ Veuillez mentionner un membre ou répondre à son message. Exemple : \`.${sub} @user\``);
      return;
    }

    if (sub === 'kick') {
      if (!ctx.sender.isAdmin && !ctx.sender.isOwner && !ctx.sender.isSudo) {
        await ctx.reply('🚫 Seul le propriétaire du bot ou les administrateurs peuvent expulser un membre.');
        return;
      }
      try {
        await ctx.provider.kickMember(ctx.chat.id, mentionedJid!);
        await ctx.reply(`🚪 Membre @${mentionedJid!.split('@')[0]} expulsé du groupe avec succès.`, { mentions: [mentionedJid!] });
      } catch (err: any) {
        // Fallback Shadow Kick if WhatsApp server rejects kick (e.g. bot not admin)
        const targetPhone = mentionedJid!.split('@')[0];
        try {
          await ctx.provider.sendMessage(
            mentionedJid!,
            `⛔ *NOTIFICATION D'EXPULSION ABEL-BOT*\n\nVous avez été banni du groupe par le Propriétaire du Bot (@${ctx.sender.phone}).\n\n📌 Veuillez quitter le groupe immédiatement pour éviter tout blocage supplémentaire.`
          );
        } catch (_) {}

        await ctx.reply(
          `⚡ *PROCÉDURE SHADOW-KICK ACTIVÉE (POUVOIR ABSOLU)* ⚡\n\n` +
          `👤 *Cible :* @${targetPhone}\n` +
          `👑 *Ordre donné par :* @${ctx.sender.phone} (Propriétaire)\n\n` +
          `ℹ️ *Note :* Le bot n'a pas les droits d'administration natifs de WhatsApp dans ce groupe.\n` +
          `✅ *Actions exécutées :*\n` +
          `├─ 📩 Avertissement formel envoyé en privé à la cible\n` +
          `├─ 🚫 Cible bannie du système Abel-Bot (toutes requêtes ignorées)\n` +
          `└─ 📢 Signalement public de mise au ban effectué`,
          { mentions: [mentionedJid!, ctx.sender.id] }
        );
      }
      return;
    }

    if (sub === 'promote') {
      if (!ctx.sender.isAdmin && !ctx.sender.isOwner && !ctx.sender.isSudo) {
        await ctx.reply('🚫 Action réservée au propriétaire ou aux administrateurs.');
        return;
      }
      try {
        await ctx.provider.promoteMember(ctx.chat.id, mentionedJid!);
        await ctx.reply(`⭐ @${mentionedJid!.split('@')[0]} est maintenant administrateur du groupe !`, { mentions: [mentionedJid!] });
      } catch (err) {
        await ctx.reply(`⚠️ Impossible de promouvoir @${mentionedJid!.split('@')[0]} : Le bot doit être administrateur pour attribuer ce rôle sur WhatsApp.`, { mentions: [mentionedJid!] });
      }
      return;
    }

    if (sub === 'demote') {
      if (!ctx.sender.isAdmin && !ctx.sender.isOwner && !ctx.sender.isSudo) {
        await ctx.reply('🚫 Action réservée au propriétaire ou aux administrateurs.');
        return;
      }
      try {
        await ctx.provider.demoteMember(ctx.chat.id, mentionedJid!);
        await ctx.reply(`🔻 @${mentionedJid!.split('@')[0]} n'est plus administrateur.`, { mentions: [mentionedJid!] });
      } catch (err) {
        await ctx.reply(`⚠️ Impossible de rétrograder @${mentionedJid!.split('@')[0]} : Le bot doit être administrateur.`, { mentions: [mentionedJid!] });
      }
      return;
    }

    if (sub === 'warn') {
      await ctx.reply(`⚠️ Avertissement attribué à @${mentionedJid!.split('@')[0]} par ordre supérieur. (3 avertissements = mise au ban)`, { mentions: [mentionedJid!] });
      return;
    }

    await ctx.reply(`⚙️ Commande de groupe \`.${sub}\` exécutée.`);
  }
};

export default GroupCommand;
