export interface UnifiedUser {
  id: string; // JID: 228xxxxxx@s.whatsapp.net
  phone: string;
  name?: string;
  isOwner: boolean;
  isSudo: boolean;
  isAdmin: boolean;
}

export interface UnifiedChat {
  id: string; // JID (@g.us or @s.whatsapp.net)
  isGroup: boolean;
  name?: string;
}

export interface QuotedMessage {
  id: string;
  senderJid: string;
  text?: string;
  mediaType?: string;
}

export interface UnifiedMessage {
  id: string;
  chatJid: string;
  senderJid: string;
  senderName?: string;
  text: string;
  isGroup: boolean;
  isMedia: boolean;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  quotedMessage?: QuotedMessage;
  raw: any; // Raw WhatsApp event payload
  timestamp: number;
}

export interface MessageOptions {
  quoted?: boolean | any;
  mentions?: string[];
  gifPlayback?: boolean;
  mimetype?: string;
  fileName?: string;
}

export type SessionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'qr_ready' | 'pairing_code_ready';

export interface IWhatsAppProvider {
  sessionId: string;
  sessionOwnerJid?: string;
  sessionOwnerName?: string;
  sessionPhone?: string;
  status: SessionStatus;
  startedAt: number;
  lastQrCode?: string;
  lastPairingCode?: string;

  start(phoneNumberForPairing?: string): Promise<void>;
  stop(): Promise<void>;
  requestPairingCode(phoneNumber: string): Promise<string>;
  sendMessage(chatJid: string, text: string, options?: MessageOptions): Promise<any>;
  sendMedia(
    chatJid: string,
    type: 'image' | 'video' | 'audio' | 'document' | 'sticker',
    mediaBuffer: Buffer,
    caption?: string,
    options?: MessageOptions
  ): Promise<any>;
  sendPresence(chatJid: string, presence: 'composing' | 'recording' | 'available' | 'unavailable'): Promise<void>;
  downloadMedia(message: any): Promise<Buffer | null>;
  kickMember(groupJid: string, userJid: string): Promise<void>;
  promoteMember(groupJid: string, userJid: string): Promise<void>;
  demoteMember(groupJid: string, userJid: string): Promise<void>;
  deleteMessage(chatJid: string, messageId: string, fromMe?: boolean, participantJid?: string): Promise<void>;
  sendInteractiveMessage(chatJid: string, interactiveMessage: any, options?: MessageOptions): Promise<any>;
}
