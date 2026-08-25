import prisma from '../../core/db/prisma.js';
import logger from '../../core/logger/logger.js';

export interface StoredChatMessage {
  id: string;
  senderJid: string;
  senderName: string;
  text: string;
  timestamp: number;
  isGroup: boolean;
  isMedia?: boolean;
  mediaType?: string;
  quotedMsgId?: string;
}

export class ChatHistoryService {
  private static instance: ChatHistoryService;
  // chatJid -> Array of messages (circular buffer up to 500 messages per chat)
  private history: Map<string, StoredChatMessage[]> = new Map();
  private readonly maxMessagesPerChat = 500;
  private prismaAvailable: boolean = true;

  private constructor() {}

  public static getInstance(): ChatHistoryService {
    if (!ChatHistoryService.instance) {
      ChatHistoryService.instance = new ChatHistoryService();
    }
    return ChatHistoryService.instance;
  }

  public recordMessage(
    chatJid: string,
    senderJid: string,
    senderName: string,
    text: string,
    isGroup: boolean,
    id: string = '',
    isMedia: boolean = false,
    mediaType?: string,
    quotedMsgId?: string
  ): void {
    if (!text && !isMedia) return;

    if (!this.history.has(chatJid)) {
      this.history.set(chatJid, []);
    }

    const msgId = id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const name = senderName || senderJid.split('@')[0];
    const cleanText = (text || '').trim();
    const ts = Date.now();

    const buffer = this.history.get(chatJid)!;
    buffer.push({
      id: msgId,
      senderJid,
      senderName: name,
      text: cleanText,
      timestamp: ts,
      isGroup,
      isMedia,
      mediaType,
      quotedMsgId
    });

    if (buffer.length > this.maxMessagesPerChat) {
      buffer.shift();
    }

    // Persist to PostgreSQL Prisma database (async fire-and-forget)
    this.persistMessage(chatJid, senderJid, name, cleanText, ts, isGroup).catch(() => {});
  }

  private async persistMessage(
    chatJid: string,
    senderJid: string,
    senderName: string,
    text: string,
    timestamp: number,
    isGroup: boolean
  ): Promise<void> {
    if (!this.prismaAvailable || !prisma) return;

    try {
      // Store formatted sender prefix so queries reflect who actually said it
      const senderTag = `${senderName} (${senderJid.split('@')[0]})`;
      await prisma.chatMessage.create({
        data: {
          chatJid,
          sender: senderTag,
          text,
          timestamp: new Date(timestamp)
        }
      }).catch((err: any) => {
        if (err.code === 'P2012' || err.message?.includes('chatMessage')) {
          this.prismaAvailable = false;
        }
      });
    } catch {
      // ignore
    }
  }

  /**
   * Fetch recent messages, populating from Database if memory is sparse
   */
  public async getRecentMessagesAsync(chatJid: string, count: number = 100): Promise<StoredChatMessage[]> {
    let buffer = this.history.get(chatJid) || [];

    if (buffer.length < Math.min(count, 15) && this.prismaAvailable && prisma) {
      try {
        const dbMsgs = await prisma.chatMessage.findMany({
          where: { chatJid },
          orderBy: { timestamp: 'desc' },
          take: count
        });

        if (dbMsgs && dbMsgs.length > 0) {
          // Merge dbMsgs with in-memory buffer
          const existingIds = new Set(buffer.map(m => m.id));
          const mapped: StoredChatMessage[] = dbMsgs
            .filter(m => !existingIds.has(m.id))
            .map(m => ({
              id: m.id,
              senderJid: m.sender.includes('@') ? m.sender : chatJid,
              senderName: m.sender.split(' (')[0] || m.sender,
              text: m.text,
              timestamp: m.timestamp.getTime(),
              isGroup: chatJid.endsWith('@g.us')
            }));

          // Combine and sort chronologically
          const combined = [...mapped, ...buffer].sort((a, b) => a.timestamp - b.timestamp);
          this.history.set(chatJid, combined.slice(-this.maxMessagesPerChat));
          buffer = this.history.get(chatJid) || [];
        }
      } catch (err: any) {
        logger.debug({ error: err.message }, '[ChatHistoryService] DB fetch fallback error');
      }
    }

    return buffer.slice(-count);
  }

  public getRecentMessages(chatJid: string, count: number = 100): StoredChatMessage[] {
    const buffer = this.history.get(chatJid) || [];
    return buffer.slice(-count);
  }

  public async getMessagesInTimeRangeAsync(
    chatJid: string,
    fromTimestamp: number,
    toTimestamp: number = Date.now()
  ): Promise<StoredChatMessage[]> {
    // Ensure history is populated from DB first
    await this.getRecentMessagesAsync(chatJid, 300);

    const buffer = this.history.get(chatJid) || [];
    return buffer.filter(m => m.timestamp >= fromTimestamp && m.timestamp <= toTimestamp);
  }

  public getMessagesInTimeRange(chatJid: string, fromTimestamp: number, toTimestamp: number = Date.now()): StoredChatMessage[] {
    const buffer = this.history.get(chatJid) || [];
    return buffer.filter(m => m.timestamp >= fromTimestamp && m.timestamp <= toTimestamp);
  }

  public getMessagesBySender(chatJid: string, targetJid: string, count: number = 100): StoredChatMessage[] {
    const buffer = this.history.get(chatJid) || [];
    const cleanTarget = targetJid.split('@')[0];
    return buffer.filter(m => m.senderJid.includes(cleanTarget) || m.senderName.toLowerCase().includes(cleanTarget.toLowerCase())).slice(-count);
  }

  public getMessagesByTopic(chatJid: string, keyword: string, count: number = 100): StoredChatMessage[] {
    const buffer = this.history.get(chatJid) || [];
    const lowerKey = keyword.toLowerCase();
    return buffer.filter(m => m.text.toLowerCase().includes(lowerKey)).slice(-count);
  }

  public getFormattedGroupHistory(chatJid: string, count: number = 100): string {
    const messages = this.getRecentMessages(chatJid, count);
    if (messages.length === 0) return '';

    return messages
      .map(m => {
        const timeStr = new Date(m.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const mediaTag = m.isMedia ? ` [📎 ${m.mediaType || 'Média'}]` : '';
        return `[${timeStr}] (ID: ${m.id}) ${m.senderName}: ${m.text}${mediaTag}`;
      })
      .join('\n');
  }

  public getMessageById(chatJid: string, messageId: string): StoredChatMessage | undefined {
    const buffer = this.history.get(chatJid) || [];
    return buffer.find(m => m.id === messageId);
  }

  public removeMessage(chatJid: string, messageId: string): void {
    const buffer = this.history.get(chatJid);
    if (!buffer) return;
    const idx = buffer.findIndex(m => m.id === messageId);
    if (idx !== -1) buffer.splice(idx, 1);
  }

  public removeRecentMessages(chatJid: string, count: number): StoredChatMessage[] {
    const buffer = this.history.get(chatJid);
    if (!buffer || buffer.length === 0) return [];
    return buffer.splice(-count, count);
  }

  public removeMessagesSince(chatJid: string, messageId: string): StoredChatMessage[] {
    const buffer = this.history.get(chatJid);
    if (!buffer || buffer.length === 0) return [];
    const idx = buffer.findIndex(m => m.id === messageId);
    if (idx === -1) return [];
    return buffer.splice(idx);
  }

  public clearHistory(chatJid: string): void {
    this.history.delete(chatJid);
  }
}

export default ChatHistoryService.getInstance();
