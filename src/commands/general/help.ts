import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import pluginManager from '../../core/plugin-system/plugin-manager.js';
import { config } from '../../config/env.js';
import { botState } from '../../core/state/bot-state.js';
import autoReplyEngine from '../../services/automation/auto-reply-engine.js';
import autoReplyConfig from '../../services/automation/auto-reply-config.js';
import sessionManager from '../../core/bot/session-manager.js';

const CATEGORY_META: Record<string, { title: string }> = {
  AI:         { title: 'Intelligence IA'       },
  Automation: { title: 'Automatisation'        },
  Group:      { title: 'Gestion de Groupe'     },
  Owner:      { title: 'Administration'        },
  Download:   { title: 'Telechargements'       },
  General:    { title: 'General'               },
  Tools:      { title: 'Outils & Utilitaires'  },
  Developer:  { title: 'Developpeur'           },
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  AI:         'Chat IA, Resume, Traduction, Code',
  Automation: 'Autoreply, Taches, Sondages, Monitor, Anniversaires, Digest',
  Group:      'Gestion du groupe, Securite',
  Owner:      'Administration du bot',
  Download:   'YouTube, Instagram, TikTok, Facebook',
  General:    'Aide, Ping, Informations',
  Tools:      'Conversions, Utilitaires',
  Developer:  'Debug, Eval, Restart',
};

const HelpCommand: IPluginCommand = {
  name: 'help',
  aliases: ['menu', 'cmds', 'bot', 'commands', 'aide', 'menus'],
  category: 'General',
  description: 'Affiche le menu complet du bot avec toutes les commandes.',
  usage: '.help | .help <commande> | .help <categorie>',
  cooldown: 2,

  async execute(ctx: CommandContext) {
    const query = ctx.args[0]?.toLowerCase();
    const p = config.botPrefix;
    const categoriesMap = pluginManager.getCommandsByCategory();

    // ── 1. DETAIL VIEW ─────────────────────────────────────────────────────────
    if (query) {
      const command = pluginManager.getCommand(query);
      if (command) {
        const aliases = command.aliases && command.aliases.length > 0
          ? command.aliases.map(a => `\`${p}${a}\``).join(' | ')
          : 'Aucun';

        const detail =
          `*[ DETAILS DE LA COMMANDE ]*\n\n` +
          `Nom        : \`${command.name}\`\n` +
          `Categorie  : \`${command.category}\`\n` +
          `Description: ${command.description}\n` +
          `Usage      :\n\`${command.usage}\`\n\n` +
          `Alias      : ${aliases}\n` +
          `Acces      : ${command.ownerOnly ? '*Owner Only*' : 'Public'}\n` +
          `Cooldown   : ${command.cooldown || 3}s`;

        await ctx.reply(detail);
        return;
      }

      // Afficher par categorie
      const categoryFound = Array.from(categoriesMap.keys()).find(c => c.toLowerCase() === query);
      if (categoryFound) {
        const cmds = categoriesMap.get(categoryFound) || [];
        const meta = CATEGORY_META[categoryFound] || { title: categoryFound };

        let categoryView =
          `*[ ${meta.title.toUpperCase()} ]*\n\n`;

        for (const cmd of cmds) {
          categoryView += `- \`${p}${cmd.name}\` — ${cmd.description}\n`;
        }

        categoryView += `\nUtilisez \`${p}help <commande>\` pour plus de details.`;
        await ctx.reply(categoryView);
        return;
      }
    }

    // ── 2. MAIN MENU ──────────────────────────────────────────────────────────
    const arStatus = autoReplyConfig.isActive() ? 'Actif' : 'Inactif';
    const sessionsCount = sessionManager.getAllSessions().length;
    const mode = botState.mode || 'normal';
    const totalCommands = pluginManager.getAllCommands().length;

    let menu =
      `*[ ABEL-BOT — MENU PRINCIPAL ]*\n\n`;

    // Dashboard
    menu +=
      `*TABLEAU DE BORD*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Mode       : \`${mode}\`\n` +
      `Sessions   : \`${sessionsCount}\` actives\n` +
      `Auto-Reply : ${arStatus}\n` +
      `Engine IA  : ${autoReplyEngine?.isAiEnabled ? 'IA v2' : 'Templates'}\n` +
      `Commandes  : \`${totalCommands}\` total\n\n`;

    // Categories (sauf General, mis en dernier)
    const sortedCategories = Array.from(categoriesMap.keys())
      .filter(cat => cat !== 'General')
      .sort();

    for (const cat of sortedCategories) {
      const cmds = categoriesMap.get(cat) || [];
      if (cmds.length === 0) continue;

      const meta = CATEGORY_META[cat] || { title: cat };
      const description = CATEGORY_DESCRIPTIONS[cat] || '';

      menu += `*${meta.title.toUpperCase()}*\n`;
      if (description) {
        menu += `  ${description}\n`;
      }

      for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i];
        const isLast = i === cmds.length - 1;
        const prefix = isLast ? '  └ ' : '  |- ';
        menu += `${prefix}\`${p}${cmd.name}\`\n`;
      }
      menu += `\n`;
    }

    // General en dernier
    const generalCmds = categoriesMap.get('General') || [];
    if (generalCmds.length > 0) {
      menu += `*GENERAL*\n`;
      for (let i = 0; i < generalCmds.length; i++) {
        const cmd = generalCmds[i];
        const isLast = i === generalCmds.length - 1;
        const prefix = isLast ? '  └ ' : '  |- ';
        menu += `${prefix}\`${p}${cmd.name}\`\n`;
      }
      menu += `\n`;
    }

    // Footer
    menu +=
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Details commande  : \`${p}help <nom>\`\n` +
      `Voir categorie    : \`${p}help <categorie>\`\n` +
      `Multi-Sessions    : \`${p}paircode <nom> <numero>\``;

    await ctx.reply(menu);
  }
};

export default HelpCommand;