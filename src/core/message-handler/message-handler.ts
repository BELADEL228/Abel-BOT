import { WAMessage, isJidGroup, jidNormalizedUser } from '@whiskeysockets/baileys';
import { UnifiedMessage, UnifiedUser, UnifiedChat, IWhatsAppProvider } from '../bot/types.js';
import commandDispatcher from '../command-handler/command-dispatcher.js';
import autoReplyEngine from '../../services/automation/auto-reply-engine.js';
import chatHistoryService from '../../services/chat/chat-history-service.js';
import { config } from '../../config/env.js';
import botDetector from '../../services/protection/bot-detector.js';
import logger from '../logger/logger.js';
import { healthMonitor } from '../monitoring/health-check.js';
import monitorService from '../../services/automation/monitor-service.js';
import pollService from '../../services/automation/poll-service.js';
import gameManager, { gameStatsService, WhatsAppGameRenderer } from '../../games/index.js';
import { BaileysProvider } from '../bot/baileys-provider.js';

/**
 * Bot startup timestamp — messages sent before the bot started or older than 90s are ignored.
 */
const botStartTime = Date.now();

/**
 * Message ID Deduplication Cache — ensures every WhatsApp message ID is executed once and ONLY once.
 */
const processedMessageIds: Set<string> = new Set();
const messageIdQueue: string[] = [];
const MAX_PROCESSED_IDS = 5000;

function isAlreadyProcessed(messageId: string): boolean {
  if (!messageId) return false;
  if (processedMessageIds.has(messageId)) {
    return true;
  }
  processedMessageIds.add(messageId);
  messageIdQueue.push(messageId);

  if (messageIdQueue.length > MAX_PROCESSED_IDS) {
    const oldestId = messageIdQueue.shift();
    if (oldestId) processedMessageIds.delete(oldestId);
  }
  return false;
}

/**
 * Echo/loop protection — tracks the last message text per chat.
 * If the same message text arrives twice in under 10 seconds from the same chat,
 * the second one is silently dropped to prevent bot-to-bot loops and WhatsApp spam detection.
 */
const recentMessageCache: Map<string, { text: string; ts: number }> = new Map();
const ECHO_WINDOW_MS = 10_000; // 10 seconds

export class MessageHandler {
  public async handleIncomingMessage(rawMessage: WAMessage, provider: IWhatsAppProvider): Promise<void> {
    if (!rawMessage.message) {
      return; // Ignore empty messages
    }

    healthMonitor.recordMessageProcessed();

    const messageId = rawMessage.key.id || '';

    // ── 1. Message ID Deduplication (Never process the same message twice) ────
    if (messageId && isAlreadyProcessed(messageId)) {
      logger.debug(`[MessageHandler] Duplicate message ID ${messageId} ignored.`);
      return;
    }

    // ── 2. Message Age & Staleness Filter (Never replay old commands) ─────────
    const rawTs = Number(rawMessage.messageTimestamp || 0);
    const messageTimestampMs = rawTs > 1e11 ? rawTs : rawTs * 1000;
    const now = Date.now();

    // If message is older than 90 seconds or was sent before bot started, ignore it!
    if (messageTimestampMs > 0 && (now - messageTimestampMs > 90_000 || messageTimestampMs < (botStartTime - 10_000))) {
      logger.debug(`[MessageHandler] Old/stale message ignored (Sent: ${new Date(messageTimestampMs).toISOString()}).`);
      return;
    }

    const chatJid = rawMessage.key.remoteJid;
    if (!chatJid || chatJid === 'status@broadcast') {
      return; // Ignore status broadcasts
    }

    // Ignore newsletter / channel JIDs (WhatsApp Channels — not real users)
    if (chatJid.endsWith('@newsletter') || chatJid.includes('broadcast')) {
      return;
    }

    const isGroup = isJidGroup(chatJid);
    const isFromMe = Boolean(rawMessage.key.fromMe);
    const participant = rawMessage.key.participant || rawMessage.participant || chatJid;
    const senderJid = jidNormalizedUser(participant);
    const phone = senderJid.split('@')[0];

    // Text Extraction
    const msgObj = rawMessage.message;
    const text =
      msgObj.conversation ||
      msgObj.extendedTextMessage?.text ||
      msgObj.imageMessage?.caption ||
      msgObj.videoMessage?.caption ||
      msgObj.documentMessage?.caption ||
      '';

    if (!text) {
      return;
    }

    // ── Echo/Loop Protection ───────────────────────────────────────────────────
    // If the same message arrives from the same chat within ECHO_WINDOW_MS,
    // drop it silently to prevent loops and WhatsApp spam detection.
    if (!isFromMe) {
      const cacheKey = `${chatJid}:${senderJid}`;
      const cached = recentMessageCache.get(cacheKey);
      const now = Date.now();

      if (cached && cached.text === text && now - cached.ts < ECHO_WINDOW_MS) {
        logger.debug(`[MessageHandler] Echo/loop detected from ${senderJid} in ${chatJid}. Dropping duplicate.`);
        return;
      }

      recentMessageCache.set(cacheKey, { text, ts: now });

      // Cleanup stale entries every 50 inserts (lightweight GC)
      if (recentMessageCache.size > 200) {
        const cutoff = now - ECHO_WINDOW_MS;
        for (const [key, val] of recentMessageCache.entries()) {
          if (val.ts < cutoff) recentMessageCache.delete(key);
        }
      }
    }

    // ── Bot Detection & Neutralization Filter ──────────────────────────────────
    if (isGroup && !isFromMe) {
      // Analyze for bot characteristics
      botDetector.analyzeMessage(senderJid, rawMessage.pushName || undefined, text, chatJid);

      // If this bot is marked as neutralized/paused, drop its messages silently
      if (botDetector.isNeutralized(senderJid)) {
        logger.debug(`[MessageHandler] Message from neutralized bot ${senderJid} silently ignored.`);
        return;
      }
    }

    // Identify owner status: fromMe is always owner, matching provider session phone, or matching master BOT_OWNER
    const cleanOwnerPhone = config.botOwner.replace(/\D/g, '');
    const isMasterOwner = cleanOwnerPhone !== '' && phone === cleanOwnerPhone;
    const isSessionOwner = Boolean(isFromMe || (provider.sessionPhone && phone === provider.sessionPhone));
    const isOwner = isMasterOwner || isSessionOwner;

    const displayName = rawMessage.pushName || (isMasterOwner ? 'Abel' : (isSessionOwner ? (provider.sessionOwnerName || phone) : phone));

    const sender: UnifiedUser = {
      id: senderJid,
      phone,
      name: displayName,
      isOwner,
      isSudo: false,
      isAdmin: false
    };

    const chat: UnifiedChat = {
      id: chatJid,
      isGroup: Boolean(isGroup),
      name: undefined
    };

    const unifiedMessage: UnifiedMessage = {
      id: rawMessage.key.id || '',
      chatJid,
      senderJid,
      senderName: rawMessage.pushName || (isOwner ? 'Abel' : phone),
      text,
      isGroup: Boolean(isGroup),
      isMedia: !!(msgObj.imageMessage || msgObj.videoMessage || msgObj.audioMessage || msgObj.documentMessage || msgObj.stickerMessage),
      mediaType: msgObj.imageMessage
        ? 'image'
        : msgObj.videoMessage
        ? 'video'
        : msgObj.audioMessage
        ? 'audio'
        : msgObj.documentMessage
        ? 'document'
        : msgObj.stickerMessage
        ? 'sticker'
        : undefined,
      quotedMessage: msgObj.extendedTextMessage?.contextInfo?.quotedMessage
        ? {
            id: msgObj.extendedTextMessage.contextInfo.stanzaId || '',
            senderJid: msgObj.extendedTextMessage.contextInfo.participant || '',
            text:
              msgObj.extendedTextMessage.contextInfo.quotedMessage.conversation ||
              msgObj.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text ||
              ''
          }
        : undefined,
      raw: rawMessage,
      timestamp: Number(rawMessage.messageTimestamp || Date.now() / 1000)
    };

    const isCommand = text.trim().startsWith(config.botPrefix);
    const isMedia = !!(msgObj.imageMessage || msgObj.videoMessage || msgObj.audioMessage || msgObj.documentMessage || msgObj.stickerMessage);
    const mediaType = msgObj.imageMessage ? 'image' : msgObj.videoMessage ? 'video' : msgObj.audioMessage ? 'audio' : msgObj.documentMessage ? 'document' : msgObj.stickerMessage ? 'sticker' : undefined;
    const quotedMsgId = msgObj.extendedTextMessage?.contextInfo?.stanzaId;

    // Record in global chat history buffer (for real group/chat summaries)
    if (!isCommand || isMedia) {
      chatHistoryService.recordMessage(
        chatJid,
        senderJid,
        rawMessage.pushName || (isOwner ? 'Abel' : phone),
        text,
        Boolean(isGroup),
        rawMessage.key.id || '',
        isMedia,
        mediaType,
        quotedMsgId || undefined
      );
    }

    // 1. Auto-Reply Engine Processing
    if (!isFromMe) {
      if (!isCommand) {
        // Run asynchronously so commands/handlers don't block
        autoReplyEngine.processIncoming(
          chatJid,
          senderJid,
          sender.name || phone,
          text,
          Boolean(isGroup),
          provider
        ).catch(err => {
          logger.error({ error: err }, '[MessageHandler] Error in autoReplyEngine.processIncoming');
        });
      }
    } else {
      // Owner sent a message — Only record manual human typing, ignore automated bot replies
      const isBotGenerated = BaileysProvider.isBotSentMessage(rawMessage.key.id);
      if (!isBotGenerated) {
        autoReplyEngine.registerOwnerReply(chatJid, text);
      }
    }

    // 3. Keyword Monitor — Check group messages for watched keywords
    if (isGroup && !isFromMe && text) {
      monitorService.check(chatJid, sender.name || phone, text);
    }

    // 4. Poll Vote Detection — Detect "1", "2", "3" replies in active polls
    if (isGroup && !isFromMe && text && !isCommand && pollService.hasPoll(chatJid)) {
      const activePoll = pollService.getResults(chatJid);
      if (activePoll) {
        const voteChoice = pollService.isVoteMessage(text.trim(), activePoll);
        if (voteChoice > 0) {
          const result = pollService.vote(chatJid, senderJid, voteChoice);
          if (result.success) {
            const option = activePoll.options.find(o => o.index === voteChoice);
            logger.debug(`[MessageHandler] Vote recorded: ${sender.name} → option ${voteChoice} ("${option?.text}")`);
          }
        }
      }
    }

    // 5. Active Game Interaction Hook (Natural in-chat moves & invitations)
    if (!isFromMe && text && !isCommand) {
      const activeSession = gameManager.getActiveGame(chatJid);
      if (activeSession) {
        const gamePlayer = {
          id: senderJid,
          name: sender.name || phone,
          joinedAt: Date.now()
        };

        // 5a. Invitation acceptance/refusal
        if (activeSession.status === 'WAITING_FOR_PLAYERS') {
          const clean = text.trim().toLowerCase();
          if (['1', 'oui', 'yes', 'accepter', 'join', 'jouer'].includes(clean)) {
            const joinResult = gameManager.joinGame(chatJid, gamePlayer);
            if (joinResult.success && joinResult.started && joinResult.view) {
              const textOut = WhatsAppGameRenderer.toFormattedText(joinResult.view);
              await provider.sendMessage(chatJid, textOut, {
                mentions: joinResult.view.mentions,
                quoted: rawMessage
              });
              return;
            }
          } else if (['2', 'non', 'no', 'refuser', 'decline'].includes(clean)) {
            if (activeSession.isInvited(senderJid)) {
              gameManager.declineInvite(chatJid, gamePlayer);
              await provider.sendMessage(chatJid, `❌ *${gamePlayer.name}* a décliné l'invitation de jeu.`, { quoted: rawMessage });
              return;
            }
          }
        }

        // 5b. In-Game Moves (Turn execution)
        if (activeSession.status === 'IN_PROGRESS' && activeSession.hasPlayer(senderJid)) {
          const actionRes = gameManager.handleAction(chatJid, gamePlayer, text.trim());
          if (actionRes.success && actionRes.view) {
            const textOut = WhatsAppGameRenderer.toFormattedText(actionRes.view);
            await provider.sendMessage(chatJid, textOut, {
              mentions: actionRes.view.mentions,
              quoted: rawMessage
            });

            // Enregistrer les statistiques si la partie est terminée
            if (actionRes.isGameOver && actionRes.result) {
              gameStatsService.recordMatchResult(activeSession.gameId, actionRes.result, activeSession.players);
            }
            return;
          }
        }
      }
    }

    // 6. Dispatch message to command engine
    await commandDispatcher.dispatch(unifiedMessage, sender, chat, provider);
  }
}

export default new MessageHandler();

// Handle graceful shutdown to clean up timers and resources
process.on('SIGTERM', async () => {
  logger.info('[App] SIGTERM received, graceful shutdown...');
  autoReplyEngine.shutdown();
  healthMonitor.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('[App] SIGINT received, graceful shutdown...');
  autoReplyEngine.shutdown();
  healthMonitor.shutdown();
  process.exit(0);
});
