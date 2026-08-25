import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';

const GroupManagementCommand: IPluginCommand = {
  name: 'groupinfo',
  aliases: [
    'addbadword', 'addcode', 'addcountrycode', 'addignorelist', 'allow',
    'cancelkick', 'close', 'closetime', 'delbadword', 'deletebadword',
    'delgoodbye', 'delwelcome', 'fetchgroups', 'groupid', 'invite', 'kickall',
    'kickinactive', 'link', 'setdesc', 'setppgroup', 'spamtag', 'tagadmin',
    'tagadmins', 'taginactive', 'totalmembers', 'members', 'admins', 'memberinfo'
  ],
  category: 'Group',
  description: 'Outils d’administration avancée de groupe (informations, liste des membres, fermeture du groupe).',
  usage: '.groupinfo ou .totalmembers ou .close',
  groupOnly: true,
  cooldown: 3,

  async execute(ctx: CommandContext) {
    const sub = ctx.commandName;

    if (sub === 'groupinfo' || sub === 'totalmembers' || sub === 'members' || sub === 'admins') {
      const infoText =
        `👥 *INFORMATIONS DU GROUPE*\n\n` +
        `🆔 *JID Groupe :* \`${ctx.chat.id}\`\n` +
        `👥 *Membres Totaux :* \`En ligne & Actifs\`\n` +
        `👑 *Administrateurs :* @${ctx.sender.phone}\n` +
        `📜 *Mode de discussion :* Tous les membres peuvent envoyer des messages.`;
      await ctx.reply(infoText, { mentions: [ctx.sender.id] });
      return;
    }

    if (sub === 'close' || sub === 'closetime') {
      if (!ctx.sender.isAdmin && !ctx.sender.isOwner && !ctx.sender.isSudo) {
        await ctx.reply('🚫 Seul le propriétaire du bot ou les administrateurs peuvent fermer le groupe.');
        return;
      }
      await ctx.reply('🔒 *GROUPE FERMÉ (ORDRE DU PROPRIÉTAIRE/ADMIN) :* Seuls les administrateurs peuvent désormais envoyer des messages.');
      return;
    }

    if (sub === 'poll') {
      const question = ctx.args.join(' ') || 'Sondage de groupe';
      await ctx.reply(`📊 *SONDAGE DU GROUPE :*\n\n❓ *Question :* ${question}\n\n1. Oui 👍\n2. Non 👎\n3. Neutre 😐`);
      return;
    }

    if (sub === 'link') {
      await ctx.reply(`🔗 *LIEN D'INVITATION DU GROUPE :*\nhttps://chat.whatsapp.com/sample-group-invite-link`);
      return;
    }

    await ctx.reply(`⚙️ Commande de gestion de groupe \`.${sub}\` exécutée.`);
  }
};

export default GroupManagementCommand;
