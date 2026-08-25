import pino from 'pino';
import { config } from '../../config/env.js';

// Base Pino instance
const rawLogger = pino({
  level: config.logLevel,
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname'
          }
        }
      : undefined
});

/**
 * Extracts a searchable string from log arguments.
 */
function extractLogText(first: any, second?: any): string {
  let text = '';
  if (typeof first === 'string') {
    text += first;
  } else if (first && typeof first === 'object') {
    if (first.message) text += ' ' + first.message;
    if (first.msg) text += ' ' + first.msg;
    if (first.error) {
      const err = first.error;
      text += ' ' + (typeof err === 'object' ? (err.message || err.stack || JSON.stringify(err)) : String(err));
    }
  }
  if (typeof second === 'string') {
    text += ' ' + second;
  }
  return text;
}

/**
 * Filter non-critical Baileys noise (e.g. Bad MAC decryption, duplicate packets, harmless socket warnings)
 * As prescribed by Abel-Bot Optimization Strategy v2.0
 */
export function shouldIgnoreLog(first: any, second?: any): boolean {
  const text = extractLogText(first, second);
  return (
    text.includes('Bad MAC') ||
    text.includes('verifyMAC') ||
    text.includes('Message validation failed') ||
    text.includes('Duplicate message') ||
    (text.includes('WARN') && text.includes('socket')) ||
    text.includes('Rate-overlimit') ||
    text.includes('Session error: Bad MAC')
  );
}

// Proxy wrapper to filter logs across all logger methods and child loggers
function createFilteredLogger(target: any): any {
  return new Proxy(target, {
    get(obj, prop) {
      if (prop === 'error' || prop === 'warn') {
        return (first: any, second?: any, ...args: any[]) => {
          if (shouldIgnoreLog(first, second)) {
            // Silently suppressed to maintain clean logs (Phase 2 Bad MAC fix)
            return;
          }
          return obj[prop](first, second, ...args);
        };
      }

      if (prop === 'child') {
        return (...args: any[]) => {
          const childRaw = obj.child(...args);
          return createFilteredLogger(childRaw);
        };
      }

      return obj[prop];
    }
  });
}

export const logger = createFilteredLogger(rawLogger);
export default logger;
