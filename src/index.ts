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

  // 4b. Birthday automated wish dispatch & owner notification
  birthdayService.onDispatch(async (entry, formattedMessage) => {
    const main = sessionManager.getMainSession();
    if (!main) return;

    // 1. Envoi direct du message d'anniversaire personnalisé au destinataire
    if (entry.autoSendDirect && entry.contactJid) {
      try {
        await main.sendMessage(entry.contactJid, formattedMessage);
        logger.info(`[Bootstrap] Direct birthday wish sent to ${entry.contactName} (${entry.contactJid})`);
      } catch (err) {
        logger.error({ error: err }, `[Bootstrap] Failed to send direct birthday message to ${entry.contactJid}`);
      }
    }

    // 2. Notification de confirmation envoyée au propriétaire
    if (ownerJid) {
      try {
        await main.sendMessage(
          ownerJid,
          `🎂 *SOUHAIT D'ANNIVERSAIRE ENVOYÉ !* 🎉\n\n` +
          `👤 *Destinataire :* ${entry.contactName} (\`${entry.contactJid.replace('@s.whatsapp.net', '')}\`)\n` +
          `💌 *Mode :* ${entry.autoSendDirect ? 'Envoi direct au contact' : 'Rappel seulement'}\n\n` +
          `💬 *Message envoyé :*\n${formattedMessage}`
        );
      } catch (err) {
        logger.error({ error: err }, '[Bootstrap] Failed to notify owner about birthday');
      }
    }
  });

  logger.info('[Bootstrap] Automation hooks registered (Monitor + Birthday).');
}

bootstrap().catch((err) => {
  logger.fatal({ error: err }, 'Fatal error during bot initialization');
  process.exit(1);
});
