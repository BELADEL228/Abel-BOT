import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import pluginManager from '../../core/plugin-system/plugin-manager.js';
import { config } from '../../config/env.js';
import { botState } from '../../core/state/bot-state.js';
import autoReplyEngine from '../../services/automation/auto-reply-engine.js';
import autoReplyConfig from '../../services/automation/auto-reply-config.js';
import sessionManager from '../../core/bot/session-manager.js';

const CATEGORY_META: Record<string, { title: string }> = {
  AI:         { title: 'INTELLIGENCE IA'       },
  Automation: { title: 'AUTOMATISATION'        },
  Group:      { title: 'GESTION DE GROUPE'     },
  Owner:      { title: 'ADMINISTRATION'        },
  Download:   { title: 'TELECHARGEMENTS'       },
  General:    { title: 'GENERAL'               },
  Tools:      { title: 'OUTILS & UTILITAIRES'  },
  Developer:  { title: 'DEVELOPPEUR'           },
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  AI:         'Chat IA contextuel, Resume, Traduction, Code',
  Automation: 'Autoreply, Taches, Sondages, Monitor, Anniversaires, Digest',
  Group:      'Gestion des membres, Securite et Moderation',
  Owner:      'Controle du bot, Permissions et Sessions',
  Download:   'TikTok, YouTube, Instagram, Medias',
  General:    'Aide, Ping, Heure et Informations',
  Tools:      'Conversions et Utilitaires',
  Developer:  'Debug, Eval et Restart',
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
          ? command.aliases.map(a => `\`${p}${a}\``).join(', ')
          : 'Aucun';

        const accessStatus = command.ownerOnly ? '🔴 Restreint (Owner)' : '🟢 Public';

        const detail =
          `╭━━━〔 DETAILS : .${command.name.toUpperCase()} 〕━━━╮\n` +
          `┃\n` +
          `┃ Categorie   : ${command.category}\n` +
          `┃ Acces       : ${accessStatus}\n` +
          `┃ Cooldown    : ${command.cooldown || 3}s\n` +
          `┃\n` +
          `┃ Description : ${command.description}\n` +
          `┃ Usage       :\n` +
          `┃ \`${command.usage}\`\n` +
          `┃\n` +
          `┃ Alias       : ${aliases}\n` +
          `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await ctx.reply(detail);
        return;
      }

      // Afficher par categorie
      const categoryFound = Array.from(categoriesMap.keys()).find(c => c.toLowerCase() === query);
      if (categoryFound) {
        const cmds = categoriesMap.get(categoryFound) || [];
        const meta = CATEGORY_META[categoryFound] || { title: categoryFound.toUpperCase() };
        const desc = CATEGORY_DESCRIPTIONS[categoryFound] || '';

        let categoryView =
          `╭━━━〔 ${meta.title} (${cmds.length}) 〕━━━╮\n`;
        
        if (desc) {
          categoryView += `┃ Description : ${desc}\n`;
        }
        categoryView += `┃\n`;

        for (let i = 0; i < cmds.length; i++) {
          const cmd = cmds[i];
          const isLast = i === cmds.length - 1;
          const prefix = isLast ? '  └─ ' : '  ├─ ';
          categoryView += `┃${prefix}\`${p}${cmd.name}\` — ${cmd.description}\n`;
        }

        categoryView +=
          `┃\n` +
          `┃ Pour plus de details : \`${p}help <commande>\`\n` +
          `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await ctx.reply(categoryView);
        return;
      }
    }

    // ── 2. MAIN MENU ──────────────────────────────────────────────────────────
    const isArActive = autoReplyConfig.isActive();
    const arBadge = isArActive
      ? (autoReplyConfig.state === 'PAUSED' ? '⏸️ PAUSE' : `🟢 ON [${autoReplyConfig.state}]`)
      : '🔴 OFF';

    const aiBadge = autoReplyEngine?.isAiEnabled ? '🟢 ACTIF' : '🔴 INACTIF';
    const modeBadge = botState.mode === 'PUBLIC' ? '🟢 PUBLIC' : (botState.mode === 'PRIVATE' ? '🔒 PRIVE' : '🚧 MAINTENANCE');

    const sessionsCount = sessionManager.getAllSessions().length;
    const totalCommands = pluginManager.getAllCommands().length;

    let menu =
      `╭━━━━━━〔 ABEL-BOT · SYSTEM MENU 〕━━━━━━╮\n` +
      `┃\n` +
      `┃ [ TABLEAU DE BORD ]\n` +
      `┃ • Statut     : 🟢 EN LIGNE\n` +
      `┃ • Mode       : ${modeBadge}\n` +
      `┃ • Auto-Reply : ${arBadge}\n` +
      `┃ • Moteur IA  : ${aiBadge} (v2)\n` +
      `┃ • Sessions   : 🟢 ${sessionsCount} active(s)\n` +
      `┃ • Commandes  : ${totalCommands} disponibles\n` +
      `┃\n` +
      `┣━━━━━━〔 MODULES DU SYSTEME 〕━━━━━━┫\n`;

    // Sort categories (General in last position)
    const sortedCategories = Array.from(categoriesMap.keys())
      .filter(cat => cat !== 'General')
      .sort();

    for (const cat of sortedCategories) {
      const cmds = categoriesMap.get(cat) || [];
      if (cmds.length === 0) continue;

      const meta = CATEGORY_META[cat] || { title: cat.toUpperCase() };
      const description = CATEGORY_DESCRIPTIONS[cat] || '';

      menu += `┃\n`;
      menu += `┃ ┌─ ${meta.title} (${cmds.length})\n`;
      if (description) {
        menu += `┃ │  ${description}\n`;
      }

      for (let i = 0; i < cmds.length; i++) {
        const cmd = cmds[i];
        const isLast = i === cmds.length - 1;
        const prefix = isLast ? ' └─ ' : ' ├─ ';
        menu += `┃ │${prefix}\`${p}${cmd.name}\`\n`;
      }
    }

    // General at the end
    const generalCmds = categoriesMap.get('General') || [];
    if (generalCmds.length > 0) {
      const generalDesc = CATEGORY_DESCRIPTIONS['General'] || '';
      menu += `┃\n`;
      menu += `┃ ┌─ GENERAL (${generalCmds.length})\n`;
      if (generalDesc) {
        menu += `┃ │  ${generalDesc}\n`;
      }
      for (let i = 0; i < generalCmds.length; i++) {
        const cmd = generalCmds[i];
        const isLast = i === generalCmds.length - 1;
        const prefix = isLast ? ' └─ ' : ' ├─ ';
        menu += `┃ │${prefix}\`${p}${cmd.name}\`\n`;
      }
    }

    // Navigation footer
    menu +=
      `┃\n` +
      `┣━━━━━━〔 NAVIGATION & AIDE 〕━━━━━━┫\n` +
      `┃ • Details commande : \`${p}help <nom>\`\n` +
      `┃ • Voir categorie   : \`${p}help <categorie>\`\n` +
      `┃ • Jumelage compte  : \`${p}paircode <nom> <numero>\`\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

    await ctx.reply(menu);
  }
};

export default HelpCommand;