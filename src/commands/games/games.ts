/**
 * Games Main Hub Command — Menu principal des jeux, invitations, classements et stats
 */

import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import gameRegistry from '../../games/core/game-registry.js';
import gameManager from '../../games/core/game-manager.js';
import gameStatsService from '../../games/services/game-stats-service.js';
import gameRankingService from '../../games/services/game-ranking-service.js';
import GameXPService from '../../games/services/game-xp-service.js';
import WhatsAppGameRenderer from '../../games/renderers/whatsapp-game-renderer.js';
import uiRenderer from '../../ui/adapters/ui-renderer.js';
import { UICard, UICarousel, UIButton } from '../../ui/types/ui.types.js';
import { config } from '../../config/env.js';
import defaultTheme from '../../ui/themes/default.theme.js';

const GamesCommand: IPluginCommand = {
  name: 'games',
  aliases: ['game', 'jeux', 'jeu', 'play', 'surrender', 'ff', 'rank', 'leaderboard', 'gamestats'],
  category: 'Games',
  description: 'Centre de jeux multijoueurs : Morpion, Puissance 4, Pendu, Quiz & Classements.',
  usage: '.games | .games start <jeu> [@adversaire] | .games stats | .games rank | .surrender',
  cooldown: 2,

  async execute(ctx: CommandContext) {
    const p = config.botPrefix;
    const subCmd = ctx.args[0]?.toLowerCase();
    const chatJid = ctx.chat.id;
    const sender = ctx.sender;
    const player = {
      id: sender.id,
      name: sender.name || sender.phone,
      joinedAt: Date.now()
    };

    // ── 1. ABANDON / SURRENDER (.surrender, .ff, .games surrender) ────────────
    if (subCmd === 'surrender' || subCmd === 'ff' || ctx.commandName === 'surrender' || ctx.commandName === 'ff') {
      const surrenderRes = gameManager.surrender(chatJid, player);
      if (!surrenderRes.success) {
        await ctx.reply(surrenderRes.message || '⚠️ Aucune partie en cours dans cette discussion.');
        return;
      }

      if (surrenderRes.view) {
        const textOut = WhatsAppGameRenderer.toFormattedText(surrenderRes.view);
        await ctx.reply(textOut);
      }
      return;
    }

    // ── 2. CLASSEMENT / LEADERBOARD (.games rank, .leaderboard) ───────────────
    if (subCmd === 'rank' || subCmd === 'leaderboard' || subCmd === 'classement' || ctx.commandName === 'rank' || ctx.commandName === 'leaderboard') {
      const entries = gameRankingService.getGlobalLeaderboard(10);
      if (entries.length === 0) {
        await ctx.reply('🏆 *CLASSEMENT GLOBAL*\n\nAucune partie enregistrée pour le moment. Soyez le premier à jouer avec `.games` !');
        return;
      }

      const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
      const rankLines = entries.map((e, idx) => {
        const medal = medals[idx] || `${idx + 1}.`;
        return `${medal} *${e.name}* (Niv. ${e.level})\n   └─ ⭐ ${e.xp.toLocaleString()} XP · 🏆 ${e.wins}V/${e.totalGames} (${e.winrate}% winrate)`;
      }).join('\n\n');

      const card: UICard = {
        title: '🏆 CLASSEMENT GÉNÉRAL DES JOUEURS',
        subtitle: 'Top 10 des maîtres du jeu Abel-Bot',
        body: rankLines,
        footer: `Gagnez des parties pour monter au classement ! Préfixe: ${p}`,
        buttons: [
          { type: 'quick_reply', displayText: '🎮 Jouer à un jeu', id: `${p}games` },
          { type: 'quick_reply', displayText: '📊 Mon Profil', id: `${p}games stats` }
        ]
      };

      await uiRenderer.renderCard(ctx, card);
      return;
    }

    // ── 3. PROFIL ET STATISTIQUES (.games stats [@user], .gamestats) ──────────
    if (subCmd === 'stats' || subCmd === 'profile' || subCmd === 'profil' || ctx.commandName === 'gamestats') {
      const stats = gameStatsService.getOrCreateStats(sender.id, player.name);
      const levelInfo = GameXPService.getLevelInfo(stats.xp);
      const winrate = stats.totalGames > 0
        ? Math.round((stats.wins / stats.totalGames) * 1000) / 10
        : 0;

      const breakdown = Object.entries(stats.gameBreakdown).map(([gId, g]) => {
        const gameObj = gameRegistry.get(gId);
        const gName = gameObj?.name || gId;
        return `• *${gName}* : ${g.wins}V / ${g.losses}D / ${g.draws}N`;
      }).join('\n') || '• Aucune partie par jeu';

      const body =
        `👤 *Joueur :* ${stats.name}\n` +
        `🎖️ *Titre :* ${levelInfo.title}\n` +
        `⭐ *Niveau :* ${levelInfo.level} (${levelInfo.progressPercent}% vers Niv. ${levelInfo.level + 1})\n` +
        `✨ *XP Total :* ${stats.xp.toLocaleString()} XP\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 *STATISTIQUES :*\n` +
        `🎮 Parties jouées : ${stats.totalGames}\n` +
        `🏆 Victoires : ${stats.wins}\n` +
        `💀 Défaites : ${stats.losses}\n` +
        `🤝 Égalités : ${stats.draws}\n` +
        `📈 Taux de victoire : *${winrate}%*\n` +
        `🔥 Série actuelle : ${stats.currentStreak} (Max: ${stats.bestStreak})\n\n` +
        `🕹️ *Détail par jeu :*\n${breakdown}`;

      const card: UICard = {
        title: `🎮 PROFIL JOUEUR : ${stats.name}`,
        subtitle: levelInfo.title,
        body,
        footer: `Tapez ${p}games pour lancer un défi !`,
        buttons: [
          { type: 'quick_reply', displayText: '🏆 Classement', id: `${p}games rank` },
          { type: 'quick_reply', displayText: '🎮 Liste des jeux', id: `${p}games` }
        ]
      };

      await uiRenderer.renderCard(ctx, card);
      return;
    }

    // ── 4. ACCEPTER / REFUSER INVITATION (.games accept, .games decline) ──────
    if (subCmd === 'accept' || subCmd === 'rejoindre' || subCmd === 'join') {
      const joinRes = gameManager.joinGame(chatJid, player);
      if (!joinRes.success) {
        await ctx.reply(joinRes.error || '⚠️ Impossible de rejoindre la partie.');
        return;
      }
      if (joinRes.started && joinRes.view) {
        await ctx.reply(WhatsAppGameRenderer.toFormattedText(joinRes.view), {
          mentions: joinRes.view.mentions
        });
      } else {
        await ctx.reply(`✅ *${player.name}* a rejoint la partie ! En attente d'autres joueurs...`);
      }
      return;
    }

    if (subCmd === 'decline' || subCmd === 'refuser') {
      const declineRes = gameManager.declineInvite(chatJid, player);
      if (!declineRes.success) {
        await ctx.reply(declineRes.error || '⚠️ Aucune invitation en attente.');
        return;
      }
      await ctx.reply(`❌ *${player.name}* a décliné l'invitation.`);
      return;
    }

    // ── 5. LANCEMENT D'UN JEU (.games start <jeu> [@user] ou .games <jeu>) ─────
    const targetGameName = subCmd === 'start' || subCmd === 'play' || subCmd === 'lancer'
      ? ctx.args[1]?.toLowerCase()
      : subCmd;

    if (targetGameName && gameRegistry.has(targetGameName)) {
      const game = gameRegistry.get(targetGameName)!;

      // Détecter un adversaire mentionné
      const mentionedJid = ctx.message.raw?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      const isSoloVsAI = !mentionedJid && game.maxPlayers === 2 && (ctx.args.includes('bot') || ctx.args.includes('ai') || ctx.args.includes('solo'));

      const createRes = gameManager.createGame(chatJid, game.id, player);
      if (!createRes.success || !createRes.session) {
        await ctx.reply(createRes.error || '⚠️ Impossible de créer la partie.');
        return;
      }

      const session = createRes.session;

      // Mode Solo contre l'IA
      if (isSoloVsAI && game.generateAIMove) {
        const aiPlayer = {
          id: 'ai_bot@s.whatsapp.net',
          name: '🤖 Bot Abel (IA)',
          isAI: true,
          joinedAt: Date.now()
        };
        const joinRes = gameManager.joinGame(chatJid, aiPlayer);
        if (joinRes.started && joinRes.view) {
          await ctx.reply(WhatsAppGameRenderer.toFormattedText(joinRes.view));
        }
        return;
      }

      // Si c'est un jeu solo direct (ex: Hangman, Quiz solo)
      if (game.minPlayers === 1 && !mentionedJid) {
        const joinRes = gameManager.joinGame(chatJid, player);
        if (joinRes.started && joinRes.view) {
          await ctx.reply(WhatsAppGameRenderer.toFormattedText(joinRes.view));
        }
        return;
      }

      // Si un adversaire est mentionné
      if (mentionedJid) {
        const opponentPhone = mentionedJid.split('@')[0];
        const opponentPlayer = {
          id: mentionedJid,
          name: `@${opponentPhone}`,
          joinedAt: Date.now()
        };
        session.invitePlayer(opponentPlayer);

        const inviteText =
          `╭━━━〔 🎮 DÉFI DE JEU REÇU 〕━━━╮\n` +
          `┃\n` +
          `┃ 🕹️ *Jeu :* ${game.name}\n` +
          `┃ 👤 *Hôte :* ${player.name}\n` +
          `┃ 🎯 *Adversaire :* @${opponentPhone}\n` +
          `┃\n` +
          `┃ Répondez : \n` +
          `┃ 1️⃣ *Accepter* (ou \`${p}games accept\`)\n` +
          `┃ 2️⃣ *Refuser* (ou \`${p}games decline\`)\n` +
          `┃\n` +
          `┃ ⏰ _L'invitation expire dans 3 minutes._\n` +
          `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await ctx.reply(inviteText, { mentions: [mentionedJid, sender.id] });
        return;
      }

      // En attente que d'autres personnes rejoignent dans le groupe
      const waitText =
        `╭━━━〔 🎮 NOUVELLE PARTIE CRÉÉE 〕━━━╮\n` +
        `┃\n` +
        `┃ 🕹️ *Jeu :* ${game.name}\n` +
        `┃ 👤 *Hôte :* ${player.name}\n` +
        `┃ 👥 *Places :* ${session.players.length}/${game.maxPlayers}\n` +
        `┃\n` +
        `┃ 💬 Pour rejoindre la partie, envoyez :\n` +
        `┃ 🔘 *1* ou tapez \`${p}games accept\`\n` +
        `┃\n` +
        `┃ 💡 _Tapez \`${p}games ${game.id} ai\` pour jouer contre le bot._\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

      await ctx.reply(waitText);
      return;
    }

    // ── 6. MENU INTERACTIF DES JEUX (CAROUSEL) ────────────────────────────────
    const allGames = gameRegistry.getAll();
    const cards: UICard[] = allGames.map(game => {
      const modeStr = game.minPlayers === 1 && game.maxPlayers === 1
        ? 'Solo'
        : (game.maxPlayers > 2 ? `1 à ${game.maxPlayers} Joueurs` : '2 Joueurs (1v1 ou vs Bot)');

      const body =
        `📌 *Description :*\n${game.description}\n\n` +
        `👥 *Mode :* ${modeStr}\n` +
        `⏱️ *Chrono :* ${Math.round(game.defaultTimeoutSeconds / 60)} min\n` +
        `🏷️ *Raccourcis :* \`${p}${game.aliases[0]}\``;

      const buttons: UIButton[] = [
        {
          type: 'quick_reply',
          displayText: `🎮 Jouer à ${game.name.split(' ')[0]}`,
          id: `${p}games ${game.id}`
        },
        {
          type: 'quick_reply',
          displayText: `🤖 Jouer contre l'IA`,
          id: `${p}games ${game.id} ai`
        }
      ];

      return {
        title: `${game.icon} ${game.name}`,
        subtitle: `Module : Jeux WhatsApp`,
        body,
        footer: `Lancer : ${p}games ${game.id} [@adversaire]`,
        buttons
      };
    });

    const carousel: UICarousel = {
      title: '🎮 SALLE DE JEUX ABEL-BOT',
      cards,
      footer: `Commandes utiles : ${p}games rank · ${p}games stats · ${p}surrender`
    };

    await uiRenderer.renderCarousel(ctx, carousel);
  }
};

export default GamesCommand;
