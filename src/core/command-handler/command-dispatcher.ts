import { UnifiedMessage, UnifiedUser, UnifiedChat, IWhatsAppProvider } from '../bot/types.js';
import { CommandContext } from '../plugin-system/types.js';
import pluginManager from '../plugin-system/plugin-manager.js';
import { PermissionGuard } from '../permission-system/permission-guard.js';
import { config } from '../../config/env.js';
import logger from '../logger/logger.js';

export class CommandDispatcher {
  public async dispatch(
    message: UnifiedMessage,
    sender: UnifiedUser,
    chat: UnifiedChat,
    provider: IWhatsAppProvider
  ): Promise<boolean> {
    const text = message.text.trim();
    const prefix = config.botPrefix;

    if (!text.startsWith(prefix)) {
      return false; // Not a command
    }

    const args = text.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) {
      return false;
    }

    const plugin = pluginManager.getCommand(commandName);
    if (!plugin) {
      return false; // Unknown command
    }

    const context: CommandContext = {
      message,
      args,
      rawText: text,
      commandName,
      sender,
      chat,
      provider,
      reply: async (replyText, options) => {
        await provider.sendMessage(chat.id, replyText, { quoted: message.raw, ...options });
      },
      replyMedia: async (type, buffer, caption) => {
        await provider.sendMedia(chat.id, type, buffer, caption, { quoted: message.raw });
      },
      replyInteractive: async (interactiveMessage, options) => {
        return await provider.sendInteractiveMessage(chat.id, interactiveMessage, { quoted: message.raw, ...options });
      }
    };

    // Permission Guard
    const guardResult = PermissionGuard.canExecute(plugin, context);
    if (!guardResult.allowed) {
      if (guardResult.reason) {
        await context.reply(guardResult.reason);
      }
      return true;
    }

    // Execution Isolation
    const startTime = Date.now();
    try {
      logger.info(
        {
          command: plugin.name,
          user: sender.phone,
          chat: chat.id,
          isGroup: chat.isGroup
        },
        `[CommandDispatcher] Executing .${plugin.name}`
      );

      await plugin.execute(context);

      const duration = Date.now() - startTime;
      logger.info(
        { command: plugin.name, durationMs: duration },
        `[CommandDispatcher] Completed .${plugin.name}`
      );
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        { error, command: plugin.name, durationMs: duration },
        `[CommandDispatcher] Error executing command .${plugin.name}`
      );
      await context.reply(
        `❌ Une erreur est survenue lors de l'exécution de la commande .${plugin.name}.`
      );
      return true;
    }
  }
}

export default new CommandDispatcher();
