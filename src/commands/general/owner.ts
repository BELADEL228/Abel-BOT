import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import { config } from '../../config/env.js';

const OwnerCommand: IPluginCommand = {
  name: 'owner',
  aliases: ['botinfo', 'time'],
  category: 'General',
  description: 'Affiche les informations du propriétaire du bot et l’heure système.',
  usage: '.owner',
  cooldown: 3,

  async execute(ctx: CommandContext) {
    const ownerNumber = config.botOwner || 'Non spécifié';
    const now = new Date().toLocaleString('fr-FR', { timeZone: config.timezone });

    const response = `👤 *INFORMATIONS PROPRIÉTAIRE*\n\n` +
      `👑 *Owner :* @${ownerNumber}\n` +
      `🤖 *Bot Name :* ${config.botName}\n` +
      `🕒 *Heure Serveur (${config.timezone}) :* \`${now}\`\n\n` +
      `💬 Pour toute demande d'assistance ou d'intégration de plugins, contactez directement l'Owner.`;

    await ctx.reply(response, { mentions: [ownerNumber ? `${ownerNumber}@s.whatsapp.net` : ''] });
  }
};

export default OwnerCommand;
