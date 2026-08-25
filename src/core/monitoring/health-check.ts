import logger from '../logger/logger.js';

export interface HealthMetrics {
  uptime: number; // Startup timestamp (ms)
  messagesProcessed: number;
  errorCount: number;
  badMacErrorCount: number;
  lastBadMacError?: Date;
  sessionCount: number;
  reconnectAttempts: number;
}

export class HealthMonitor {
  private static instance: HealthMonitor;
  private metrics: HealthMetrics = {
    uptime: Date.now(),
    messagesProcessed: 0,
    errorCount: 0,
    badMacErrorCount: 0,
    sessionCount: 0,
    reconnectAttempts: 0
  };

  private monitorInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startMonitoring();
  }

  public static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  public recordMessageProcessed(): void {
    this.metrics.messagesProcessed++;
  }

  public recordError(isBadMac: boolean = false): void {
    this.metrics.errorCount++;
    if (isBadMac) {
      this.metrics.badMacErrorCount++;
      this.metrics.lastBadMacError = new Date();
    }
  }

  public recordReconnectAttempt(attempt: number): void {
    this.metrics.reconnectAttempts = attempt;
  }

  public updateSessionCount(count: number): void {
    this.metrics.sessionCount = count;
  }

  public getMetrics(): HealthMetrics & { uptimeHours: number; errorRatePercent: number; isHealthy: boolean } {
    const uptimeHours = (Date.now() - this.metrics.uptime) / (1000 * 60 * 60);
    const divisor = this.metrics.messagesProcessed > 0 ? this.metrics.messagesProcessed : 1;
    const errorRatePercent = (this.metrics.errorCount / divisor) * 100;
    const isHealthy = errorRatePercent <= 1.0;

    return {
      ...this.metrics,
      uptimeHours: Number(uptimeHours.toFixed(2)),
      errorRatePercent: Number(errorRatePercent.toFixed(2)),
      isHealthy
    };
  }

  private startMonitoring(): void {
    if (this.monitorInterval) return;

    // Log health metrics every hour (as specified in optimization strategy)
    this.monitorInterval = setInterval(() => {
      const stats = this.getMetrics();

      logger.info(
        `[HEALTH] Uptime: ${stats.uptimeHours}h | Messages: ${stats.messagesProcessed} | Errors: ${stats.errorCount} (Bad MAC: ${stats.badMacErrorCount}) | Rate: ${stats.errorRatePercent}% | Sessions: ${stats.sessionCount}`
      );

      // Alert if error rate > 1% when there are enough messages
      if (stats.messagesProcessed >= 50 && stats.errorRatePercent > 1.0) {
        logger.warn(
          `[HEALTH ALERT] Error rate is high: ${stats.errorRatePercent}% (${stats.errorCount}/${stats.messagesProcessed} messages)`
        );
      }
    }, 60 * 60 * 1000);

    if (this.monitorInterval.unref) {
      this.monitorInterval.unref();
    }
  }

  public shutdown(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }
}

export const healthMonitor = HealthMonitor.getInstance();
export default healthMonitor;
