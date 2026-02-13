import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { collectDefaultMetrics, Counter, Gauge, Registry } from 'prom-client';
import apiRoutes from './api-routes';
import { db } from './db';
import { errorTrackingMiddleware, getRecentErrors } from './error-tracking';
import { logger } from './logger';

dotenv.config();

const app = express();
const port = Number.parseInt(process.env.PORT || '3000', 10);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

const httpRequestCount = new Counter({
  name: 'realist_http_requests_total',
  help: 'Count of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

const syncDurationGauge = new Gauge({
  name: 'realist_last_sync_duration_ms',
  help: 'Duration of the latest sync run in milliseconds',
  registers: [metricsRegistry],
});

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(limiter);
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info('request', { line: message.trim() }),
    },
  }),
);

app.use((req: Request, res: Response, next: NextFunction) => {
  res.on('finish', () => {
    const route = req.route?.path || req.path;
    httpRequestCount.inc({ method: req.method, route, status_code: String(res.statusCode) });
  });
  next();
});

app.use('/api', apiRoutes);
app.use('/monitoring', express.static(path.resolve(process.cwd(), 'monitoring')));

app.get('/health', async (_req: Request, res: Response) => {
  try {
    await db.query('SELECT 1');
    res.json({
      status: 'ok',
      service: 'realist-idx-api',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'degraded',
      service: 'realist-idx-api',
      timestamp: new Date().toISOString(),
      database: 'unreachable',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const latestSync = await db.query<{
      duration_ms: number | null;
      processed_count: number;
      inserted_count: number;
      updated_count: number;
      failed_count: number;
      finished_at: string | null;
    }>(
      `SELECT duration_ms, processed_count, inserted_count, updated_count, failed_count, finished_at
       FROM sync_runs
       ORDER BY id DESC
       LIMIT 1`,
    );

    const row = latestSync.rows[0];
    if (row?.duration_ms) {
      syncDurationGauge.set(row.duration_ms);
    }

    const payload = {
      sync: row || null,
      recentErrors: getRecentErrors().slice(0, 10),
    };

    const prometheusMetrics = await metricsRegistry.metrics();

    res.setHeader('Content-Type', 'application/json');
    res.json({
      stats: payload,
      prometheus: prometheusMetrics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.originalUrl}` });
});

app.use(errorTrackingMiddleware);

if (require.main === module) {
  app.listen(port, () => {
    logger.info('Server started', { port });
  });
}

export default app;
