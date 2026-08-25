import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { IPluginCommand } from './types.js';
import logger from '../logger/logger.js';

export class PluginManager {
  private static instance: PluginManager;
  private commands: Map<string, IPluginCommand> = new Map();
  private aliases: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  public async loadPlugins(commandsDir: string): Promise<void> {
    this.commands.clear();
    this.aliases.clear();

    if (!fs.existsSync(commandsDir)) {
      logger.warn(`[PluginManager] Directory not found: ${commandsDir}`);
      return;
    }

    await this.scanDirectory(commandsDir);
    logger.info(
      `[PluginManager] Loaded ${this.commands.size} commands and ${this.aliases.size} aliases successfully.`
    );
  }

  private async scanDirectory(dir: string): Promise<void> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath);
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) &&
        !entry.name.endsWith('.d.ts')
      ) {
        await this.loadPluginFile(fullPath);
      }
    }
  }

  private async loadPluginFile(filePath: string): Promise<void> {
    try {
      const fileUrl = pathToFileURL(filePath).href;
      const imported = await import(fileUrl);
      const plugin: IPluginCommand = imported.default || imported.plugin;

      if (!plugin || !plugin.name || typeof plugin.execute !== 'function') {
        logger.debug(`[PluginManager] File ${filePath} is not a valid plugin. Skipping.`);
        return;
      }

      const lowerName = plugin.name.toLowerCase();
      this.commands.set(lowerName, plugin);

      if (plugin.aliases && Array.isArray(plugin.aliases)) {
        for (const alias of plugin.aliases) {
          this.aliases.set(alias.toLowerCase(), lowerName);
        }
      }

      logger.debug(`[PluginManager] Registered plugin: .${lowerName} (${plugin.category})`);
    } catch (error) {
      logger.error({ error, filePath }, `[PluginManager] Failed to load plugin file.`);
    }
  }

  public getCommand(nameOrAlias: string): IPluginCommand | undefined {
    const key = nameOrAlias.toLowerCase();
    const commandName = this.aliases.get(key) || key;
    return this.commands.get(commandName);
  }

  public getAllCommands(): IPluginCommand[] {
    return Array.from(this.commands.values());
  }

  public getCommandsByCategory(): Map<string, IPluginCommand[]> {
    const categoriesMap = new Map<string, IPluginCommand[]>();

    for (const cmd of this.commands.values()) {
      const cat = cmd.category || 'General';
      if (!categoriesMap.has(cat)) {
        categoriesMap.set(cat, []);
      }
      categoriesMap.get(cat)!.push(cmd);
    }

    return categoriesMap;
  }
}

export default PluginManager.getInstance();
