import { IPluginCommand, CommandContext } from '../../core/plugin-system/types.js';
import sessionManager from '../../core/bot/session-manager.js';
import logger from '../../core/logger/logger.js';
import { config } from '../../config/env.js';

// ✅ CONSTANTES DE CONFIGURATION
const MAX_SESSIONS = 10;  // Limite de sessions simultanées
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;  // Validation numéro international

/**
 * ✅ Valide et nettoie un numéro de téléphone
 */
function validatePhoneNumber(input: string): string | null {
  const cleaned = input.replace(/[^\d+]/g, '').replace(/^\+/, '');
  
  if (!PHONE_REGEX.test(input)) {
    return null;  // Invalide
  }
  
  // Ajouter le + au début s'il n'existe pas
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

/**
 * ✅ Valide le nom de session
 */
function validateSessionName(input: string): string | null {
  if (!input || input.length < 2 || input.length > 32) {
    return null;
  }
  
  const cleaned = input.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

const SessionsCommand: IPluginCommand = {
  name: 'sessions',
  aliases: [
    'session', 'listsessions', 'paircode', 'pair', 'addsession',
    'stopsession', 'delsession', 'removesession', 'sessionstatus'
  ],
  category: 'Owner',
  description: 'Gestionnaire Multi-Sessions / Multi-Comptes WhatsApp : connecter de nouveaux comptes via code de jumelage 8 chiffres ou QR code.',
  usage: '.sessions | .paircode <nom> <numéro> | .stopsession <nom> | .delsession <nom>',
  ownerOnly: true,
  cooldown: 3,

  async execute(ctx: CommandContext) {
    const sub = ctx.commandName;
    const args = ctx.args;

    // ✅ VÉRIFIER QUE sessionManager EXISTE
    if (!sessionManager || typeof sessionManager.createWithPairingCode !== 'function') {
      await ctx.reply('❌ *SessionManager non disponible.* Le système multi-session n\'est pas initialisé.');
      logger.error('[SessionsCommand] sessionManager is undefined or missing methods');
      return;
    }

    // ── 1. GENERATE PAIRING CODE (.paircode / .pair / .addsession) ───────────
    if (sub === 'paircode' || sub === 'pair' || sub === 'addsession' || (sub === 'sessions' && args[0]?.toLowerCase() === 'add')) {
      const rawSessionName = sub === 'sessions' ? args[1] : args[0];
      const rawPhone = sub === 'sessions' ? args[2] : args[1];

      // ✅ VALIDATION
      const sessionName = validateSessionName(rawSessionName);
      const phoneNumber = validatePhoneNumber(rawPhone);

      if (!sessionName || !phoneNumber) {
        await ctx.reply(
          `📱 *CONNEXION D'UN NOUVEAU COMPTE WHATSAPP*\n\n` +
          `⚠️ *Usage :* \`.paircode <nom> <numéro>\`\n\n` +
          `*Exemple :*\n` +
          `\`.paircode kevin 22890123456\` ou \`.paircode kevin +228 901 23456\`\n\n` +
          `💡 *Règles :*\n` +
          `• Nom: 2-32 caractères (lettre, chiffre, tiret, underscore)\n` +
          `• Numéro: Numéro international valide (7-15 chiffres)\n` +
          `• Le bot vous renverra un code 8 chiffres à saisir dans WhatsApp\n` +
          `• Aucun scan caméra nécessaire !`
        );
        return;
      }

      // ✅ VÉRIFIER LA LIMITE DE SESSIONS
      const existingSessions = sessionManager.listSessionsInfo();
      if (existingSessions.length >= MAX_SESSIONS) {
        await ctx.reply(
          `⚠️ *Limite de sessions atteinte !*\n\n` +
          `Vous avez actuellement ${existingSessions.length}/${MAX_SESSIONS} sessions actives.\n\n` +
          `Pour ajouter une nouvelle session, vous devez d'abord en supprimer une :\n` +
          `\`.delsession <nom>\``
        );
        return;
      }

      // ✅ VÉRIFIER QUE LA SESSION N'EXISTE PAS DÉJÀ
      if (existingSessions.some(s => s.id === sessionName)) {
        await ctx.reply(`⚠️ Une session nommée \`${sessionName}\` existe déjà.`);
        return;
      }

      await ctx.provider.sendPresence(ctx.chat.id, 'composing');
      await ctx.reply(`⏳ *Initialisation de la session "${sessionName}" et génération du code de jumelage pour ${phoneNumber}...*`);

      try {
        const result = await sessionManager.createWithPairingCode(sessionName, phoneNumber);
        
        // ✅ VÉRIFIER QUE LA RÉPONSE EST VALIDE
        if (!result || !result.code) {
          throw new Error('sessionManager.createWithPairingCode() returned invalid result');
        }

        const { code } = result;
        const targetJid = `${phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`;

        // ── ENVOI DU CODE AU NUMÉRO CIBLE ──
        const directMessage =
          `👋 *Bonjour !* Tu as demandé à lier ton compte WhatsApp à l'assistant *${config.botName}*.\n\n` +
          `🔑 *TON CODE DE CONNEXION :*\n` +
          `👉 \`\`\`${code}\`\`\` 👈\n\n` +
          `📋 *COMMENT FAIRE :*\n` +
          `1. Va dans tes *Paramètres WhatsApp*\n` +
          `2. Sélectionne *Appareils connectés*\n` +
          `3. Appuie sur *Connecter un appareil*\n` +
          `4. Choisis *"Se connecter avec un numéro"* en bas\n` +
          `5. Saisis le code ci-dessus.\n\n` +
          `⚠️ _Ce code expire dans 60 secondes._`;

        // Tentative d'envoi direct au numéro concerné
        try {
          await ctx.provider.sendMessage(targetJid, directMessage);
          logger.info(`[SessionsCommand] Pairing code sent directly to ${phoneNumber}`);
        } catch (sendErr) {
          logger.warn(`[SessionsCommand] Could not send direct message to ${phoneNumber}, it might be a new contact.`);
        }

        // ── AFFICHAGE DANS TON BOX (DISCUSSION ACTUELLE) ──
        const guide =
          `╭━━━━━━〔 📱 JUMELAGE EN COURS 〕━━━━━━╮\n` +
          `┃ 🆔 *Session :* \`${sessionName}\`\n` +
          `┃ 📞 *Numéro :* \`${phoneNumber}\`\n` +
          `┃\n` +
          `┃ 🔑 *CODE GÉNÉRÉ :*\n` +
          `┃ 👉 \`\`\`${code}\`\`\` 👈\n` +
          `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n` +
          `┃ ✅ *INFO :* Le code a été envoyé directement\n` +
          `┃ par message privé à @${phoneNumber.replace(/\D/g, '')}.\n` +
          `┃\n` +
          `┃ ⚡ _Le code expire dans 60 secondes._\n` +
          `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

        await ctx.reply(guide, { mentions: [targetJid] });
        logger.info(`[SessionsCommand] Generated pairing code for session ${sessionName} (${phoneNumber})`);
      } catch (err: any) {
        logger.error({ error: err.message, stack: err.stack }, '[SessionsCommand] Failed to generate pairing code');
        await ctx.reply(
          `❌ *Erreur lors de la création de la session :*\n\n` +
          `\`${err.message || 'Unknown error'}\`\n\n` +
          `💡 *Conseil:* Assurez-vous que:\n` +
          `• Le numéro est valide\n` +
          `• Le téléphone a une connexion Internet\n` +
          `• Aucune autre session n'utilise ce numéro`
        );
      }
      return;
    }

    // ── 2. STOP SESSION (.stopsession) ───────────────────────────────────────
    if (sub === 'stopsession' || (sub === 'sessions' && args[0]?.toLowerCase() === 'stop')) {
      const rawSessionName = sub === 'sessions' ? args[1] : args[0];
      const sessionName = validateSessionName(rawSessionName);

      if (!sessionName) {
        await ctx.reply('⚠️ Usage : `.stopsession <nom>` (ex: `.stopsession kevin`)');
        return;
      }

      try {
        const stopped = await sessionManager.stopSession(sessionName);
        if (stopped) {
          await ctx.reply(`🛑 Session \`${sessionName}\` déconnectée avec succès.\n_(Les données sont conservées)_`);
          logger.info(`[SessionsCommand] Stopped session ${sessionName}`);
        } else {
          await ctx.reply(`⚠️ Session \`${sessionName}\` introuvable.`);
        }
      } catch (err: any) {
        logger.error({ error: err.message }, '[SessionsCommand] Failed to stop session');
        await ctx.reply(`❌ Erreur : ${err.message}`);
      }
      return;
    }

    // ── 3. DELETE SESSION (.delsession / .removesession) ──────────────────────
    if (sub === 'delsession' || sub === 'removesession' || (sub === 'sessions' && args[0]?.toLowerCase() === 'del')) {
      const rawSessionName = sub === 'sessions' ? args[1] : args[0];
      const sessionName = validateSessionName(rawSessionName);

      if (!sessionName) {
        await ctx.reply('⚠️ Usage : `.delsession <nom>` (ex: `.delsession kevin`)');
        return;
      }

      try {
        const deleted = await sessionManager.deleteSession(sessionName);
        if (deleted) {
          await ctx.reply(
            `🗑️ Session \`${sessionName}\` supprimée définitivement.\n` +
            `_(Toutes les données associées ont été effacées)_`
          );
          logger.info(`[SessionsCommand] Deleted session ${sessionName}`);
        } else {
          await ctx.reply(`⚠️ Session \`${sessionName}\` introuvable.`);
        }
      } catch (err: any) {
        logger.error({ error: err.message }, '[SessionsCommand] Failed to delete session');
        await ctx.reply(`❌ Erreur : ${err.message}`);
      }
      return;
    }

    // ── 4. LIST SESSIONS (.sessions / .listsessions) ──────────────────────────
    try {
      const sessions = sessionManager.listSessionsInfo();

      if (sessions.length === 0) {
        await ctx.reply(
          `📭 *Aucune session active.*\n\n` +
          `Pour connecter un nouveau compte WhatsApp :\n` +
          `\`.paircode <nom> <numéro>\``
        );
        return;
      }

      const statusBadge: Record<string, string> = {
        connected: '🟢 Connecté (En ligne)',
        connecting: '🟡 Connexion en cours...',
        pairing_code_ready: '🔑 En attente code jumelage',
        qr_ready: '📷 En attente scan QR',
        disconnected: '🔴 Déconnecté',
        idle: '⚪ Inactif'
      };

      let report = `╭━━━━━━━〔 🌐 SESSIONS WHATSAPP ACTIVES (${sessions.length}/${MAX_SESSIONS}) 〕━━━━━━━╮\n`;

      for (const s of sessions) {
        const isMain = s.isMain ? ' ★ (Principal)' : '';
        const uptimeStr = s.uptimeSeconds > 0
          ? `${Math.floor(s.uptimeSeconds / 3600)}h ${Math.floor((s.uptimeSeconds % 3600) / 60)}m`
          : '0s';

        report += `┃\n`;
        report += `┃ 🆔 *Session :* \`${s.id}\`${isMain}\n`;
        report += `┃ 👤 *Propriétaire :* ${s.ownerName || '_Non identifié_'}\n`;
        report += `┃ 📞 *Numéro :* ${s.phone ? `\`${s.phone}\`` : '_Non lié_'}\n`;
        report += `┃ ⚡ *Statut :* ${statusBadge[s.status] || `\`${s.status}\``}\n`;
        report += `┃ ⏱️ *Uptime :* \`${uptimeStr}\`\n`;
        if (s.lastPairingCode && s.status === 'pairing_code_ready') {
          report += `┃ 🔑 *Code en attente :* \`${s.lastPairingCode}\` _(expire dans ~60s)_\n`;
        }
      }

      report +=
        `┃\n` +
        `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n` +
        `┃ 💡 *COMMANDES DISPONIBLES :*\n` +
        `┃ • \`.paircode <nom> <numéro>\` ➜ Connecter un nouveau compte\n` +
        `┃ • \`.stopsession <nom>\` ➜ Déconnecter une session\n` +
        `┃ • \`.delsession <nom>\` ➜ Supprimer une session\n` +
        `┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n` +
        `┃ ℹ️ *INFOS :*\n` +
        `┃ • Utilisez des noms simples : \`kevin\`, \`pro1\`, \`client-abc\`\n` +
        `┃ • Chaque session = 1 compte WhatsApp indépendant\n` +
        `┃ • Maximum ${MAX_SESSIONS} sessions simultanées\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;

      await ctx.reply(report);
    } catch (err: any) {
      logger.error({ error: err.message }, '[SessionsCommand] Failed to list sessions');
      await ctx.reply(`❌ Erreur lors de l'affichage des sessions : ${err.message}`);
    }
  }
};

export default SessionsCommand;