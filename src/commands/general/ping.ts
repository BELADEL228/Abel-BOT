import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';

const PingCommand: IPluginCommand = {
  name: 'ping',
  aliases: ['alive', 'uptime'],
  category: 'General',
  description: 'Vérifie la réactivité du bot et affiche son temps de fonctionnement (uptime).',
  usage: '.ping',
  cooldown: 3,

  async execute(ctx: CommandContext) {
    const start = Date.now();
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    const latency = Date.now() - start;

    const response = `🏓 *PONG !*\n\n` +
      `⚡ *Latence :* \`${latency} ms\`\n` +
      `⏱️ *Uptime :* \`${hours}h ${minutes}m ${seconds}s\`\n` +
      `🤖 *Statut :* \`En ligne & Opérationnel\``;

    await ctx.reply(response);
  }
};

export default PingCommand;
