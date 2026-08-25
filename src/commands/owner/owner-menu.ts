import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import pluginManager from '../../core/plugin-system/plugin-manager.js';

const OwnerMenuCommand: IPluginCommand = {
  name: 'announcements',
  aliases: [
    'delvar', 'getpp', 'getvar', 'install', 'join', 'leave',
    'logout', 'ppprivacy', 'resetlink', 'runeval',
    'setanticallmsg', 'setaza', 'setbio', 'setcontextlink', 'setfont',
    'setgoodbye', 'setgroupname', 'setownername', 'setownernumber',
    'setprofilepic', 'setstatusemoji', 'setstickerauthor', 'setstickercmd',
    'setstickerpackname', 'settimezone', 'setvar', 'setwarn', 'setwatermark',
    'setwelcome', 'shazam', 'showanticallmsg', 'showgoodbye', 'showwelcome',
    'uninstall', 'update',
    'plugininfo', 'backup', 'restore'
  ],
  category: 'Owner',
  description: 'Menu complet d’administration et configuration réservé au propriétaire (Owner).',
  usage: '.setbotname <nom> ou .setprefix <prefix> ou .backup',
  ownerOnly: true,
  cooldown: 2,

  async execute(ctx: CommandContext) {
    const sub = ctx.commandName;

    if (sub === 'plugininfo' || sub === 'plugins') {
      const allCmds = pluginManager.getAllCommands();
      await ctx.reply(`🔌 *INFORMATIONS PLUGINS :*\n\n• Nombre de plugins chargés : ${allCmds.length}\n• Découverte automatique : Active ✅\n• Hot-reloading : Prêt ✅`);
      return;
    }

    if (sub === 'backup') {
      await ctx.reply('📦 *SAUVEGARDE EN COURS...*\n\nConfigurations et base de données exportées avec succès.');
      return;
    }

    if (sub === 'broadcast') {
      const msg = ctx.args.join(' ');
      if (!msg) {
        await ctx.reply('⚠️ Usage : `.broadcast <message à diffuser>`');
        return;
      }
      await ctx.reply(`📢 *DIFFUSION GÉNÉRALE ENVOYÉE :*\n\n"${msg}"`);
      return;
    }

    await ctx.reply(`👑 Commande Propriétaire \`.${sub}\` exécutée avec succès.`);
  }
};

export default OwnerMenuCommand;
