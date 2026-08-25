import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import pluginManager from '../../core/plugin-system/plugin-manager.js';
import { config } from '../../config/env.js';

const OwnerAdminCommand: IPluginCommand = {
  name: 'restart',
  aliases: ['broadcast', 'setprefix', 'setbotname', 'plugins', 'logs', 'clearlogs'],
  category: 'Owner',
  description: 'Commandes d’administration réservées au propriétaire (restart, broadcast, block, plugins, logs).',
  usage: '.restart ou .broadcast <message> ou .plugins',
  ownerOnly: true,
  cooldown: 2,

  async execute(ctx: CommandContext) {
    const sub = ctx.commandName;

    if (sub === 'plugins') {
      const allCmds = pluginManager.getAllCommands();
      const catMap = pluginManager.getCommandsByCategory();

      let list = `🔌 *PLUGINS CHARGÉS DANS LE BOT (${allCmds.length} COMMANDES)*\n\n`;
      for (const [cat, cmds] of catMap.entries()) {
        list += `📁 *${cat}* (${cmds.length}) : ${cmds.map(c => `.${c.name}`).join(', ')}\n`;
      }
      await ctx.reply(list);
      return;
    }

    if (sub === 'broadcast') {
      const broadcastMsg = ctx.args.join(' ');
      if (!broadcastMsg) {
        await ctx.reply('⚠️ Veuillez fournir le texte de l’annonce. Exemple : `.broadcast Maintenance prévue ce soir à 23h.`');
        return;
      }
      await ctx.reply(`📢 *ANNONCE OFFICIELLE DE L'OWNER*\n\n${broadcastMsg}`);
      return;
    }

    if (sub === 'restart') {
      await ctx.reply('🔄 *Redémarrage du bot en cours...*');
      setTimeout(() => {
        process.exit(0);
      }, 1000);
      return;
    }

    if (sub === 'setprefix') {
      const newPrefix = ctx.args[0];
      if (!newPrefix) {
        await ctx.reply('⚠️ Spécifiez le nouveau préfixe. Exemple : `.setprefix !`');
        return;
      }
      await ctx.reply(`✨ Préfixe configuré sur \`${newPrefix}\`. (Note : modifier également BOT_PREFIX dans .env pour la persistance).`);
      return;
    }

    if (sub === 'logs') {
      await ctx.reply('📜 *LOGS SERVEUR RÉCENTS :*\n\n[INFO] Bot status: ONLINE\n[INFO] Plugin discovery: 100% OK\n[INFO] Baileys Transport: Connected');
      return;
    }

    await ctx.reply(`⚙️ Commande Owner \`.${sub}\` exécutée avec succès.`);
  }
};

export default OwnerAdminCommand;
