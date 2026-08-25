import path from 'path';
import { fileURLToPath } from 'url';
import pluginManager from './core/plugin-system/plugin-manager.js';
import BaileysProvider from './core/bot/baileys-provider.js';
import { startObservabilityServer } from './services/observability/server.js';
import logger from './core/logger/logger.js';
import { botState } from './core/state/bot-state.js';
import autoReplyConfig from './services/automation/auto-reply-config.js';
import contactStore from './services/automation/auto-reply-contact-store.js';
import monitorService from './services/automation/monitor-service.js';
import birthdayService from './services/automation/birthday-service.js';
import { config } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import sessionManager from './core/bot/session-manager.js';
import contextManager from './services/automation/context-manager.js';
import { healthMonitor } from './core/monitoring/health-check.js';

async function bootstrap() {
  logger.info('🚀 Starting Abel-Bot WhatsApp Personal Assistant Framework (Multi-Session)...');

  // 0. Initialize Systems (sync with DB + context history)
  await botState.init();
  await autoReplyConfig.load();
  await contactStore.load();
  await contextManager.initialize();

  // 1. Discover and load commands/plugins dynamically
  const commandsPath = path.join(__dirname, 'commands');
  await pluginManager.loadPlugins(commandsPath);

  // 2. Start Observability Server (/health, /status)
  startObservabilityServer();

  // 3. Initialize Multi-Session WhatsApp Manager (main + additional user sessions)
  await sessionManager.bootstrap();
  healthMonitor.updateSessionCount(sessionManager.getAllSessions().length);

  // 4. Register automation alert hooks (send alerts to main owner DM)
  const ownerNumber = config.botOwner?.replace(/\D/g, '') || '';
  const ownerJid = ownerNumber ? `${ownerNumber}@s.whatsapp.net` : null;

  // 4a. Monitor keyword alerts → DM to owner
  monitorService.onAlert(async (groupJid, senderName, text, keyword) => {
    const main = sessionManager.getMainSession();
    if (!main || !ownerJid) return;
    const groupNum = groupJid.split('@')[0];
    const preview = text.length > 80 ? text.slice(0, 80) + '…' : text;
    try {
      await main.sendMessage(ownerJid,
        `🔔 *ALERTE MOT-CLÉ DÉTECTÉ*\n\n` +
        `🔍 Mot : *${keyword}*\n` +
        `👤 Par : *${senderName}*\n` +
        `💬 Groupe : \`${groupNum}\`\n\n` +
        `_Message :_ "${preview}"`
      );
    } catch (err) {
      logger.error({ error: err }, '[Bootstrap] Failed to send monitor alert');
    }
  });

  // 4b. Birthday alerts → DM to owner each morning
  birthdayService.onAlert(async (entry) => {
    const main = sessionManager.getMainSession();
    if (!main || !ownerJid) return;
    try {
      const msg = entry.customMessage ||
        `🎂 *Joyeux anniversaire à ${entry.contactName} !* 🎉\n\n` +
        `N'oublie pas de lui envoyer un message aujourd'hui ! 😊`;
      await main.sendMessage(ownerJid, msg);
    } catch (err) {
      logger.error({ error: err }, '[Bootstrap] Failed to send birthday alert');
    }
  });

  logger.info('[Bootstrap] Automation hooks registered (Monitor + Birthday).');
}

bootstrap().catch((err) => {
  logger.fatal({ error: err }, 'Fatal error during bot initialization');
  process.exit(1);
});
