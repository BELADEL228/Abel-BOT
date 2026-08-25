import prisma from '../db/prisma.js';
import logger from '../logger/logger.js';

export type BotMode = 'PUBLIC' | 'PRIVATE' | 'MAINTENANCE';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

class BotState {
  private static instance: BotState;

  public mode: BotMode = 'PUBLIC';
  public sudoUsers: Set<string> = new Set();
  public blacklistedUsers: Set<string> = new Set();
  public whitelistedUsers: Set<string> = new Set();
  
  // Custom granular permissions: userId -> Set of granted command names or categories (lowercase)
  public userCustomPermissions: Map<string, Set<string>> = new Map();

  public rateLimitMap: Map<string, RateLimitEntry> = new Map();

  // Global rate limit config
  public rateLimitMaxRequests = 8;    // max requests per window (reduced from 10 for anti-ban)
  public rateLimitWindowMs = 60_000;  // 1-minute window

  private constructor() {}

  public static getInstance(): BotState {
    if (!BotState.instance) {
      BotState.instance = new BotState();
    }
    return BotState.instance;
  }

  /**
   * Initializes the bot state from the database.
   */
  public async init(): Promise<void> {
    try {
      logger.info('[BotState] Syncing state with database...');

      const users = await prisma.user.findMany({
        where: {
          OR: [
            { role: 'SUDO' },
            { role: 'OWNER' },
            { isBlocked: true },
            { isWhitelisted: true }
          ]
        }
      });

      this.sudoUsers.clear();
      this.blacklistedUsers.clear();
      this.whitelistedUsers.clear();

      for (const user of users) {
        if (user.role === 'SUDO' || user.role === 'OWNER') this.sudoUsers.add(user.id);
        if (user.isBlocked) this.blacklistedUsers.add(user.id);
        if (user.isWhitelisted) this.whitelistedUsers.add(user.id);
      }

      logger.info(`[BotState] Synced: ${this.sudoUsers.size} Sudo, ${this.blacklistedUsers.size} Blacklisted, ${this.whitelistedUsers.size} Whitelisted users.`);
    } catch (error) {
      logger.error({ error }, '[BotState] Failed to sync state with database');
    }
  }

  /**
   * Check if a user is allowed to use the bot in the current mode.
   * Returns { allowed, reason }
   */
  public canUserInteract(userId: string, isOwner: boolean, isSudo: boolean): { allowed: boolean; reason?: string } {
    // Owner/sudo always allowed
    if (isOwner || isSudo) return { allowed: true };

    // Blacklisted users — silent ignore
    if (this.blacklistedUsers.has(userId)) {
      return { allowed: false };
    }

    // Maintenance mode — silent ignore
    if (this.mode === 'MAINTENANCE') {
      return { allowed: false };
    }

    // Private mode — silent ignore (no reply sent if user is not authorized)
    if (this.mode === 'PRIVATE' && !this.whitelistedUsers.has(userId) && !this.userCustomPermissions.has(userId)) {
      return { allowed: false };
    }

    // Global rate limiting
    const now = Date.now();
    const entry = this.rateLimitMap.get(userId);

    if (entry) {
      if (now - entry.windowStart < this.rateLimitWindowMs) {
        if (entry.count >= this.rateLimitMaxRequests) {
          const remaining = Math.ceil((this.rateLimitWindowMs - (now - entry.windowStart)) / 1000);
          return { allowed: false, reason: `⏱️ Trop de requêtes. Réessayez dans ${remaining}s.` };
        }
        entry.count++;
      } else {
        // Reset window
        this.rateLimitMap.set(userId, { count: 1, windowStart: now });
      }
    } else {
      this.rateLimitMap.set(userId, { count: 1, windowStart: now });
    }

    return { allowed: true };
  }

  public async addSudo(userId: string): Promise<void> {
    this.sudoUsers.add(userId);
    await prisma.user.upsert({
      where: { id: userId },
      update: { role: 'SUDO' },
      create: { id: userId, phone: userId.split('@')[0], role: 'SUDO' }
    });
  }

  public async removeSudo(userId: string): Promise<void> {
    this.sudoUsers.delete(userId);
    await prisma.user.updateMany({
      where: { id: userId },
      data: { role: 'USER' }
    });
  }

  public isSudo(userId: string): boolean { return this.sudoUsers.has(userId); }

  public async addBlacklist(userId: string): Promise<void> {
    this.blacklistedUsers.add(userId);
    await prisma.user.upsert({
      where: { id: userId },
      update: { isBlocked: true },
      create: { id: userId, phone: userId.split('@')[0], isBlocked: true }
    });
  }

  public async removeBlacklist(userId: string): Promise<void> {
    this.blacklistedUsers.delete(userId);
    await prisma.user.updateMany({
      where: { id: userId },
      data: { isBlocked: false }
    });
  }

  public async addWhitelist(userId: string): Promise<void> {
    this.whitelistedUsers.add(userId);
    await prisma.user.upsert({
      where: { id: userId },
      update: { isWhitelisted: true },
      create: { id: userId, phone: userId.split('@')[0], isWhitelisted: true }
    });
  }

  public async removeWhitelist(userId: string): Promise<void> {
    this.whitelistedUsers.delete(userId);
    await prisma.user.updateMany({
      where: { id: userId },
      data: { isWhitelisted: false }
    });
  }

  /**
   * Granular Permissions
   */
  public grantPermission(userId: string, target: string): void {
    const key = target.toLowerCase().trim();
    if (!this.userCustomPermissions.has(userId)) {
      this.userCustomPermissions.set(userId, new Set());
    }
    this.userCustomPermissions.get(userId)!.add(key);
  }

  public revokePermission(userId: string, target: string): void {
    const key = target.toLowerCase().trim();
    const perms = this.userCustomPermissions.get(userId);
    if (perms) {
      perms.delete(key);
      if (perms.size === 0) {
        this.userCustomPermissions.delete(userId);
      }
    }
  }

  public hasCustomPermission(userId: string, commandName: string, category: string): boolean {
    const perms = this.userCustomPermissions.get(userId);
    if (!perms) return false;
    const cmd = commandName.toLowerCase().trim();
    const cat = category.toLowerCase().trim();
    return perms.has('all') || perms.has(cmd) || perms.has(cat);
  }

  public getUserGrants(userId: string): string[] {
    const perms = this.userCustomPermissions.get(userId);
    return perms ? Array.from(perms) : [];
  }
}

export const botState = BotState.getInstance();
