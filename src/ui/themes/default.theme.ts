/**
 * Default Theme — Identité visuelle & Design System centralisé d'Abel-Bot
 */

import { ThemeConfig } from '../types/ui.types.js';

export const defaultTheme: ThemeConfig = {
  name: 'Abel Dark Modern',
  prefix: '.',
  icons: {
    primary: '◈',
    category: '📂',
    command: '➜',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    locked: '🔒',
    public: '🟢',
    arrowLeft: '‹',
    arrowRight: '›',
    bullet: '•',
    sparkles: '✨'
  },
  categories: {
    AI: {
      icon: '🤖',
      title: 'INTELLIGENCE ARTIFICIELLE',
      description: 'Assistant conversationnel, résumé, traduction & code',
      badge: 'IA v2'
    },
    Automation: {
      icon: '⚡',
      title: 'AUTOMATISATION',
      description: 'Auto-reply, tâches, anniversaires, veille & sondages',
      badge: 'Auto'
    },
    Download: {
      icon: '📥',
      title: 'TÉLÉCHARGEMENT MÉDIAS',
      description: 'Musiques MP3, vidéos HD, TikTok, YouTube & Facebook',
      badge: 'Media'
    },
    Group: {
      icon: '👥',
      title: 'GESTION DE GROUPE',
      description: 'Modération, sécurité, votes, purges & permissions',
      badge: 'Admin'
    },
    Owner: {
      icon: '👑',
      title: 'ADMINISTRATION BOT',
      description: 'Gestion multi-sessions, modes, permissions & monitoring',
      badge: 'Root'
    },
    General: {
      icon: '🌐',
      title: 'GÉNÉRAL & INFORMATIONS',
      description: 'Aide, statuts du bot, ping, recherche & diagnostics',
      badge: 'Info'
    },
    Tools: {
      icon: '🛠️',
      title: 'OUTILS & UTILITAIRES',
      description: 'Utilitaires divers, conversion & calculs',
      badge: 'Tools'
    },
    Developer: {
      icon: '💻',
      title: 'DÉVELOPPEUR',
      description: 'Debug, évaluation de code & restart système',
      badge: 'Dev'
    }
  },
  borders: {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '━',
    vertical: '┃',
    leftT: '┣',
    rightT: '┫'
  }
};

export default defaultTheme;
