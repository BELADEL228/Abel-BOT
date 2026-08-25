import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import { botState } from '../../core/state/bot-state.js';
import { config } from '../../config/env.js';
import logger from '../../core/logger/logger.js';

const ModeCommand: IPluginCommand = {
  name: 'mode',
  aliases: [
    'public', 'private', 'maintenance',
    'blacklist', 'unblacklist', 'whitelist', 'unwhitelist',
    'addsudo', 'delsudo', 'listsudo',
    'grant', 'revoke', 'grants', 'permissions',
    'block', 'unblock', 'listblocked',
    'setlimit', 'resetlimit'
  ],
  category: 'Owner',
  description: 'Contrôle du mode du bot (Public/Privé/Maintenance), gestion des permissions granulaires avec notification automatique du destinataire.',
  usage: '.mode public | .grant @contact autoreply | .addsudo @contact | .grants',
  ownerOnly: true,
  cooldown: 2,

  async execute(ctx: CommandContext) {
    const sub = ctx.commandName;
    const target = ctx.args[0]?.replace('@', '').split('@')[0];
    const targetJid = target ? `${target}@s.whatsapp.net` : null;

    // ─── MODE SWITCHING ────────────────────────────────────────────────────────
    if (sub === 'public' || (sub === 'mode' && ctx.args[0]?.toLowerCase() === 'public')) {
      botState.mode = 'PUBLIC';
      await ctx.reply(
        `🌐 *MODE BOT : PUBLIC*\n\n` +
        `✅ Tous les utilisateurs peuvent désormais utiliser le bot.\n` +
        `💡 Utilisez \`.mode private\` pour restreindre l'accès.`
      );
      return;
    }

    if (sub === 'private' || (sub === 'mode' && ctx.args[0]?.toLowerCase() === 'private')) {
      botState.mode = 'PRIVATE';
      await ctx.reply(
        `🔒 *MODE BOT : PRIVÉ*\n\n` +
        `✅ Seuls les utilisateurs sur la liste blanche ou ayant des droits accordés peuvent utiliser le bot.\n` +
        `💡 Utilisez \`.whitelist @user\` ou \`.grant @user <commande>\` pour donner accès.`
      );
      return;
    }

    if (sub === 'maintenance' || (sub === 'mode' && ctx.args[0]?.toLowerCase() === 'maintenance')) {
      botState.mode = 'MAINTENANCE';
      await ctx.reply(
        `🚧 *MODE BOT : MAINTENANCE*\n\n` +
        `✅ Le bot est maintenant en maintenance.\n` +
        `Seuls l'Owner et les Sudo users peuvent l'utiliser.`
      );
      return;
    }

    // ─── GRANULAR PERMISSION GRANTS & DIRECT NOTIFICATION ────────────────────
    if (sub === 'grant') {
      if (!targetJid || ctx.args.length < 2) {
        await ctx.reply(
          `⚠️ *Usage :* \`.grant @contact <commande/catégorie/all>\`\n\n` +
          `*Exemples :*\n` +
          `• \`.grant @228xxxxxxxx autoreply\` (donne droit à .autoreply)\n` +
          `• \`.grant @228xxxxxxxx ai\` (donne droit aux commandes IA)\n` +
          `• \`.grant @228xxxxxxxx all\` (donne droit à toutes les commandes)`
        );
        return;
      }
      const permName = ctx.args[1].toLowerCase().replace(/^\./, '');
      botState.grantPermission(targetJid, permName);

      // 1. Send confirmation to Owner
      await ctx.reply(
        `🔑 *DROITS ACCORDÉS !*\n\n` +
        `👤 *Bénéficiaire :* @${target}\n` +
        `✅ *Accès accordé pour :* \`.${permName}\`\n` +
        `📩 *Notification WhatsApp :* Envoyée directement au contact ✅`,
        { mentions: [targetJid] }
      );

      // 2. Send direct notification message to the recipient's WhatsApp
      try {
        const recipientNotification =
          `🎉 *FÉLICITATIONS ! VOUS AVEZ REÇU UN ACCÈS SUR ${config.botName.toUpperCase()}*\n\n` +
          `👑 *Attribué par :* @${ctx.sender.phone} (Propriétaire)\n` +
          `🔑 *Permission activée :* \`.${permName}\`\n\n` +
          `💡 *Comment l'utiliser :*\n` +
          `Vous pouvez dès à présent envoyer la commande \`.${permName}\` sur WhatsApp pour l'utiliser librement !\n\n` +
          `Tapez \`.help ${permName}\` pour voir les options détaillées.`;

        await ctx.provider.sendMessage(targetJid, recipientNotification, { mentions: [ctx.sender.id] });
        logger.info(`[ModeCommand] Sent grant notification to ${targetJid} for permission: ${permName}`);
      } catch (err: any) {
        logger.warn({ error: err.message }, `[ModeCommand] Could not send direct notification to ${targetJid}`);
      }
      return;
    }

    if (sub === 'revoke') {
      if (!targetJid || ctx.args.length < 2) {
        await ctx.reply('⚠️ *Usage :* `.revoke @contact <commande/catégorie/all>`');
        return;
      }
      const permName = ctx.args[1].toLowerCase().replace(/^\./, '');
      botState.revokePermission(targetJid, permName);

      await ctx.reply(
        `🚫 *DROIT RÉVOQUÉ !*\n\n` +
        `👤 *Contact :* @${target}\n` +
        `❌ *Accès retiré pour :* \`.${permName}\`\n` +
        `📩 *Notification WhatsApp :* Envoyée au contact.`,
        { mentions: [targetJid] }
      );

      try {
        const revokeNotification =
          `ℹ️ *NOTIFICATION D'ACCÈS — ${config.botName.toUpperCase()}*\n\n` +
          `Votre permission d'accès pour la commande \`.${permName}\` a été révoquée par le propriétaire (@${ctx.sender.phone}).`;
        await ctx.provider.sendMessage(targetJid, revokeNotification, { mentions: [ctx.sender.id] });
      } catch (e) {
        // ignore notification error
      }
      return;
    }

    if (sub === 'grants' || sub === 'permissions') {
      const entries = Array.from(botState.userCustomPermissions.entries());
      if (entries.length === 0) {
        await ctx.reply('📋 *PERMISSIONS ACCORDÉES :* Aucun droit individuel configuré.\n💡 Utilisez `.grant @contact <commande>`');
        return;
      }
      let report = `🔑 *PERMISSIONS ACCORDÉES AUX AUTRES NUMÉROS (${entries.length}) :*\n\n`;
      const mentions: string[] = [];
      for (const [jid, perms] of entries) {
        mentions.push(jid);
        const permsList = Array.from(perms).map(p => `\`${p}\``).join(', ');
        report += `• @${jid.split('@')[0]} ➜ ${permsList}\n`;
      }
      await ctx.reply(report, { mentions });
      return;
    }

    // ─── SUDO MANAGEMENT WITH NOTIFICATION ────────────────────────────────────
    if (sub === 'addsudo') {
      if (!targetJid) { await ctx.reply('⚠️ Usage : `.addsudo @contact`'); return; }
      botState.addSudo(targetJid);
      await ctx.reply(`👑 @${target} ajouté aux *SUDO users* — Notification envoyée à l'utilisateur.`, { mentions: [targetJid] });

      try {
        const sudoAlert =
          `👑 *PROMOTION ADMINISTRATEUR — ${config.botName.toUpperCase()}*\n\n` +
          `Félicitations ! Le propriétaire (@${ctx.sender.phone}) vous a accordé les privilèges *SUDO / Administrateur* sur Abel-Bot.\n` +
          `Vous pouvez désormais utiliser toutes les fonctionnalités avancées. Tapez \`.help\` pour voir vos nouvelles commandes !`;
        await ctx.provider.sendMessage(targetJid, sudoAlert, { mentions: [ctx.sender.id] });
      } catch (e) {
        // ignore notification error
      }
      return;
    }

    if (sub === 'delsudo') {
      if (!targetJid) { await ctx.reply('⚠️ Usage : `.delsudo @contact`'); return; }
      botState.removeSudo(targetJid);
      await ctx.reply(`🗑️ @${target} retiré des *SUDO users*.`, { mentions: [targetJid] });
      return;
    }

    if (sub === 'listsudo') {
      const list = [...botState.sudoUsers];
      if (list.length === 0) {
        await ctx.reply('📋 *SUDO USERS :* Aucun sudo user configuré.\nUsage : `.addsudo @contact`');
      } else {
        const formatted = list.map((id, i) => `${i + 1}. @${id.split('@')[0]}`).join('\n');
        await ctx.reply(`👑 *LISTE SUDO USERS (${list.length}) :*\n\n${formatted}`, { mentions: list });
      }
      return;
    }

    // ─── BLACKLIST / BLOCK ────────────────────────────────────────────────────
    if (sub === 'blacklist' || sub === 'block') {
      if (!targetJid) { await ctx.reply(`⚠️ Usage : \`.${sub} @contact\``); return; }
      botState.addBlacklist(targetJid);
      await ctx.reply(`🚫 @${target} ajouté à la *liste noire* — Accès au bot refusé.`, { mentions: [targetJid] });
      return;
    }

    if (sub === 'unblacklist' || sub === 'unblock') {
      if (!targetJid) { await ctx.reply(`⚠️ Usage : \`.${sub} @contact\``); return; }
      botState.removeBlacklist(targetJid);
      await ctx.reply(`✅ @${target} retiré de la *liste noire* — Accès rétabli.`, { mentions: [targetJid] });
      return;
    }

    if (sub === 'listblocked') {
      const list = [...botState.blacklistedUsers];
      if (list.length === 0) {
        await ctx.reply('📋 *LISTE NOIRE :* Aucun utilisateur bloqué.');
      } else {
        const formatted = list.map((id, i) => `${i + 1}. @${id.split('@')[0]}`).join('\n');
        await ctx.reply(`🚫 *LISTE NOIRE (${list.length}) :*\n\n${formatted}`, { mentions: list });
      }
      return;
    }

    // ─── WHITELIST ────────────────────────────────────────────────────────────
    if (sub === 'whitelist') {
      if (!targetJid) { await ctx.reply('⚠️ Usage : `.whitelist @contact`'); return; }
      botState.addWhitelist(targetJid);
      await ctx.reply(`✅ @${target} ajouté à la *liste blanche* — Accès autorisé même en mode privé.`, { mentions: [targetJid] });
      return;
    }

    if (sub === 'unwhitelist') {
      if (!targetJid) { await ctx.reply('⚠️ Usage : `.unwhitelist @contact`'); return; }
      botState.removeWhitelist(targetJid);
      await ctx.reply(`🗑️ @${target} retiré de la *liste blanche*.`, { mentions: [targetJid] });
      return;
    }

    // ─── RATE LIMIT ───────────────────────────────────────────────────────────
    if (sub === 'setlimit') {
      const maxReq = parseInt(ctx.args[0] || '10', 10);
      const windowSec = parseInt(ctx.args[1] || '60', 10);
      botState.rateLimitMaxRequests = maxReq;
      botState.rateLimitWindowMs = windowSec * 1000;
      await ctx.reply(
        `⚙️ *RATE LIMIT MIS À JOUR :*\n\n` +
        `• Max requêtes : ${maxReq} / ${windowSec}s\n` +
        `• Par utilisateur, fenêtre glissante.`
      );
      return;
    }

    if (sub === 'resetlimit') {
      botState.rateLimitMap.clear();
      await ctx.reply('✅ *COMPTEURS RATE LIMIT RÉINITIALISÉS* pour tous les utilisateurs.');
      return;
    }

    // ─── STATUS OVERVIEW ──────────────────────────────────────────────────────
    const modeEmoji: Record<string, string> = {
      PUBLIC: '🌐',
      PRIVATE: '🔒',
      MAINTENANCE: '🚧'
    };
    await ctx.reply(
      `⚙️ *GESTION DES DROITS ET STATUT*\n\n` +
      `${modeEmoji[botState.mode]} *Mode actuel :* ${botState.mode}\n` +
      `👑 *Sudo Users :* ${botState.sudoUsers.size}\n` +
      `🔑 *Permissions Spécifiques :* ${botState.userCustomPermissions.size} contact(s)\n` +
      `🚫 *Liste Noire :* ${botState.blacklistedUsers.size}\n` +
      `✅ *Liste Blanche :* ${botState.whitelistedUsers.size}\n\n` +
      `*Commandes utiles :*\n` +
      `• \`.grant @contact <commande>\` ➜ Donner accès et notifier par DM\n` +
      `• \`.revoke @contact <commande>\` ➜ Retirer un droit\n` +
      `• \`.grants\` ➜ Voir qui a quels droits\n` +
      `• \`.addsudo @contact\` ➜ Nommer un Administrateur Sudo`
    );
  }
};

export default ModeCommand;
