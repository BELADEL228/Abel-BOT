import dotenv from 'dotenv';

dotenv.config();

export const config = {
  get botName() { return process.env.BOT_NAME || 'Abel-Bot'; },
  get botPrefix() { return process.env.BOT_PREFIX || '.'; },
  get botOwner() { return process.env.BOT_OWNER || ''; },
  get timezone() { return process.env.BOT_TIMEZONE || 'UTC'; },

  get databaseUrl() { return process.env.DATABASE_URL || ''; },
  get redisUrl() { return process.env.REDIS_URL || 'redis://localhost:6379'; },

  get aiApiKey() {
    dotenv.config({ override: true });
    return (process.env.AI_API_KEY || '').trim();
  },
  get urlSecurityApiKey() { return process.env.URL_SECURITY_API_KEY || ''; },

  get port() { return parseInt(process.env.PORT || '3000', 10); },
  get logLevel() { return process.env.LOG_LEVEL || 'info'; }
};
