import express from 'express';
import cors from 'cors';
import { config } from '../../config/env.js';
import pluginManager from '../../core/plugin-system/plugin-manager.js';
import logger from '../../core/logger/logger.js';

import { healthMonitor } from '../../core/monitoring/health-check.js';

export function startObservabilityServer(): void {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => {
    const health = healthMonitor.getMetrics();
    res.status(health.isHealthy ? 200 : 503).json({
      status: health.isHealthy ? 'OK' : 'DEGRADED',
      health,
      timestamp: new Date().toISOString()
    });
  });

  app.get('/status', (req, res) => {
    const memory = process.memoryUsage();
    const uptimeSeconds = process.uptime();
    const metrics = healthMonitor.getMetrics();

    res.status(200).json({
      botName: config.botName,
      status: 'ONLINE',
      uptimeSeconds,
      metrics,
      memory: {
        rssMb: (memory.rss / 1024 / 1024).toFixed(2),
        heapTotalMb: (memory.heapTotal / 1024 / 1024).toFixed(2),
        heapUsedMb: (memory.heapUsed / 1024 / 1024).toFixed(2)
      },
      pluginCount: pluginManager.getAllCommands().length
    });
  });

  app.listen(config.port, () => {
    logger.info(`[ObservabilityServer] Health check & status API listening on port ${config.port}`);
  });
}
