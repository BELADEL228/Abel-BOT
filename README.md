# Abel-Bot — WhatsApp Personal Assistant Framework

**Abel-Bot** est un framework de bot d'assistant personnel WhatsApp modulaire, sécurisé, extensible et maintenable construit avec **TypeScript**, **Node.js**, **Baileys (Multi-Device Web API)**, **Prisma ORM (PostgreSQL)** et **Redis**.

---

## 🌟 Fonctionnalités Clés

- 🔌 **Architecture de Plugins Modulaire** : Chaque commande est un module isolé. Découverte dynamique sans modifier le cœur du bot.
- 🛡️ **Système de Permissions Granulaire (RBAC)** : Rôles `OWNER`, `SUDO`, `ADMIN`, `USER` + cooldowns configurables.
- 🤖 **Intelligence Artificielle (AI)** : Intégration Gemini / OpenAI / DeepSeek (`.ai`, `.summarize`, `.translate`, `.memory`).
- 🔐 **Sécurité & Protection** : Scan d'URLs (Phishing, réputation de domaine), détection Anti-Spam/Flood.
- 📊 **Gestion & Modération de Groupes** : `.kick`, `.promote`, `.hidetag`, Anti-Link, Anti-Bot.
- 📈 **Observabilité API** : Endpoints REST `/health` et `/status` intégrés (Uptime, RAM, Plugins count).
- 🐳 **Docker Ready** : `Dockerfile` multi-stage et `docker-compose.yml` (Bot + Postgres + Redis).

---

## 🚀 Démarrage Rapide

### Prerequisites
- Node.js v20+
- PostgreSQL & Redis (ou Docker)

### Installation

```bash
# 1. Cloner le projet et installer les dépendances
git clone <repository_url>
cd Abel-Bot
npm install

# 2. Configurer l'environnement
cp .env.example .env

# 3. Générer le client Prisma
npm run prisma:generate

# 4. Lancer en mode développement
npm run dev
```

Un **QR Code** s'affichera dans la console pour lier votre compte WhatsApp.

---

## 🐳 Déploiement Docker Compose

```bash
docker-compose up -d --build
```

---

## 🧩 Structure d'un Plugin

```typescript
import { IPluginCommand, CommandContext } from '../../core/plugin-system/types';

const MyCommand: IPluginCommand = {
  name: 'mycommand',
  aliases: ['myalias'],
  category: 'Tools',
  description: 'Description de la commande',
  usage: '.mycommand',
  cooldown: 3,

  async execute(ctx: CommandContext) {
    await ctx.reply('Bonjour depuis le plugin !');
  }
};

export default MyCommand;
```

---

## 📜 Licence

ISC
