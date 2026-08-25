import { IPluginCommand, CommandContext } from '../plugin-system/types.js';
import logger from '../logger/logger.js';
import { botState } from '../state/bot-state.js';

/**
 * Per-user command burst limiter.
 * Tracks how many commands a user fires per 60-second window.
 * If they exceed MAX_COMMANDS_PER_MINUTE, the message is silently dropped
 * (no reply = no extra WhatsApp traffic that could trigger ban detection).
 */
const burstTracker: Map<string, { count: number; windowStart: number }> = new Map();
const MAX_COMMANDS_PER_MINUTE = 8;
const MAX_TRACKED_USERS = 2000;

export class PermissionGuard {
  // Per-user per-command cooldowns
  private static cooldowns: Map<string, number> = new Map();

  public static canExecute(
    command: IPluginCommand,
    ctx: CommandContext
  ): { allowed: boolean; reason?: string } {
    const { sender, chat } = ctx;

    const isOwner = sender.isOwner;
    const isSudo = sender.isSudo || botState.isSudo(sender.id);
    const hasCustomGrant = botState.hasCustomPermission(sender.id, command.name, command.category);

    // 0. Global bot-state check (mode, blacklist, rate limit)
    const globalCheck = botState.canUserInteract(sender.id, isOwner, isSudo);
    if (!globalCheck.allowed) return globalCheck;

    // 1. Per-user command burst limiter (anti-spam / anti-ban)
    // Owner and sudo bypass burst limiting to ensure full control
    if (!isOwner && !isSudo) {
      const now = Date.now();
      const burst = burstTracker.get(sender.id);

      if (burst) {
        if (now - burst.windowStart < 60_000) {
          if (burst.count >= MAX_COMMANDS_PER_MINUTE) {
            // Silent drop — no reply to avoid generating extra WhatsApp traffic
            logger.warn(`[PermissionGuard] Burst limit hit for user ${sender.id}. Silent drop.`);
            return { allowed: false }; // No reason = no reply sent
          }
          burst.count++;
        } else {
          burstTracker.set(sender.id, { count: 1, windowStart: now });
        }
      } else {
        // Prevent unbounded Map size
        if (burstTracker.size >= MAX_TRACKED_USERS) {
          const oldestKey = burstTracker.keys().next().value;
          if (oldestKey) burstTracker.delete(oldestKey);
        }
        burstTracker.set(sender.id, { count: 1, windowStart: now });
      }
    }

    // 2. Group / Private scope check
    if (command.groupOnly && !chat.isGroup) {
      return { allowed: false, reason: '⚠️ Cette commande est réservée aux groupes.' };
    }

    if (command.privateOnly && chat.isGroup) {
      return { allowed: false, reason: "⚠️ Cette commande ne peut être utilisée qu'en message privé." };
    }

    // 3. Owner / Sudo / Custom Grant check
    if (command.ownerOnly && !isOwner && !isSudo && !hasCustomGrant) {
      return { allowed: false, reason: '🚫 Accès refusé : Commande réservée au propriétaire (Owner) ou aux utilisateurs autorisés.' };
    }

    // 4. User Admin check in group
    if (command.userAdminRequired && chat.isGroup && !sender.isAdmin && !isOwner && !isSudo && !hasCustomGrant) {
      return { allowed: false, reason: '🚫 Accès refusé : Seuls les administrateurs du groupe peuvent utiliser cette commande.' };
    }

    // 5. Role requirements
    if (command.roles && command.roles.length > 0 && !isOwner && !isSudo && !hasCustomGrant) {
      const userRole = sender.isAdmin ? 'ADMIN' : 'USER';
      if (!command.roles.includes(userRole)) {
        return { allowed: false, reason: `🚫 Permission insuffisante. Rôle requis: ${command.roles.join(', ')}` };
      }
    }

    // 6. Per-command cooldown check (default 5s — raised from 3s to reduce WA traffic)
    const cooldownSeconds = command.cooldown ?? 5;
    const cooldownKey = `${sender.id}:${command.name}`;
    const now = Date.now();
    const lastExecuted = this.cooldowns.get(cooldownKey);

    if (lastExecuted) {
      const expirationTime = lastExecuted + cooldownSeconds * 1000;
      if (now < expirationTime) {
        const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
        return {
          allowed: false,
          reason: `⏱️ Veuillez patienter ${timeLeft}s avant de réutiliser la commande .${command.name}.`
        };
      }
    }

    // Cap cooldown map size
    if (this.cooldowns.size >= MAX_TRACKED_USERS) {
      const oldestKey = this.cooldowns.keys().next().value;
      if (oldestKey) this.cooldowns.delete(oldestKey);
    }

    this.cooldowns.set(cooldownKey, now);

    logger.debug({ command: command.name, user: sender.id }, '[PermissionGuard] Access granted');
    return { allowed: true };
  }
}
