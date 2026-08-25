import { UnifiedMessage, UnifiedUser, UnifiedChat, IWhatsAppProvider, MessageOptions } from '../bot/types.js';

export type RolePermission = 'OWNER' | 'SUDO' | 'ADMIN' | 'USER';

export type ExtendedPermission =
  | 'canUseAI'
  | 'canModerate'
  | 'canDownload'
  | 'canBroadcast'
  | 'canManageGroups'
  | 'canUseOwnerCommands';

export interface CommandContext {
  message: UnifiedMessage;
  args: string[];
  rawText: string;
  commandName: string;
  sender: UnifiedUser;
  chat: UnifiedChat;
  provider: IWhatsAppProvider;
  reply: (text: string, options?: MessageOptions) => Promise<void>;
  replyMedia: (
    type: 'image' | 'video' | 'audio' | 'document' | 'sticker',
    buffer: Buffer,
    caption?: string
  ) => Promise<void>;
}

export interface IPluginCommand {
  name: string;
  aliases?: string[];
  category: string;
  description: string;
  usage: string;
  cooldown?: number; // In seconds
  roles?: RolePermission[];
  permissions?: ExtendedPermission[];
  groupOnly?: boolean;
  privateOnly?: boolean;
  ownerOnly?: boolean;
  botAdminRequired?: boolean;
  userAdminRequired?: boolean;

  execute(ctx: CommandContext): Promise<void>;
}
