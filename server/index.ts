import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { seedGeographies } from "./seedGeographies";
import { seedCourseContent } from "./courseSeed";

const app = express();
// Trust proxy for secure cookies behind Replit's reverse proxy
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log('DATABASE_URL not set, skipping Stripe initialization', 'stripe');
    return;
  }

  try {
    log('Initializing Stripe schema...', 'stripe');
    await runMigrations({ 
      databaseUrl,
      schema: 'stripe'
    });
    log('Stripe schema ready', 'stripe');

    const stripeSync = await getStripeSync();

    if (process.env.REPLIT_DOMAINS) {
      log('Setting up managed webhook...', 'stripe');
      try {
        const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
        const { webhook } = await stripeSync.findOrCreateManagedWebhook(
          `${webhookBaseUrl}/api/stripe/webhook`
        );
        log(`Webhook configured: ${webhook?.url || 'pending'}`, 'stripe');
      } catch (webhookError: any) {
        log(`Webhook setup failed (non-critical): ${webhookError.message}`, 'stripe');
      }
    } else {
      log('REPLIT_DOMAINS not set, skipping webhook setup', 'stripe');
    }

    log('Syncing Stripe data in background...', 'stripe');
    stripeSync.syncBackfill()
      .then(() => log('Stripe data synced', 'stripe'))
      .catch((err: Error) => log(`Error syncing Stripe data: ${err.message}`, 'stripe'));
  } catch (error: any) {
    log(`Failed to initialize Stripe: ${error.message}`, 'stripe');
  }
}

async function ensureAppTables() {
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS area_yield_history (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        area_type text NOT NULL,
        area_key text NOT NULL,
        area_name text NOT NULL,
        city text,
        province text NOT NULL,
        month varchar(7) NOT NULL,
        listing_count integer NOT NULL DEFAULT 0,
        avg_gross_yield real,
        median_gross_yield real,
        avg_net_yield real,
        avg_list_price real,
        median_list_price real,
        avg_rent_per_unit real,
        avg_days_on_market real,
        avg_price_per_sqft real,
        inventory_count integer DEFAULT 0,
        avg_beds_per_listing real,
        yield_trend real,
        computed_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS area_yield_history_area_month_idx
      ON area_yield_history(area_type, area_key, province, month)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS area_yield_history_lookup_idx
      ON area_yield_history(area_type, province, month)
    `);
    log("App reporting tables ready", "db");
  } catch (error: any) {
    log(`Failed to ensure app tables: ${error.message}`, "db");
  }
}

(async () => {
  await initStripe();
  await ensureAppTables();

  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const signature = req.headers['stripe-signature'];

      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature' });
      }

      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;

        if (!Buffer.isBuffer(req.body)) {
          log('STRIPE WEBHOOK ERROR: req.body is not a Buffer', 'stripe');
          return res.status(500).json({ error: 'Webhook processing error' });
        }

        await WebhookHandlers.processWebhook(req.body as Buffer, sig);
        res.status(200).json({ received: true });
      } catch (error: any) {
        log(`Webhook error: ${error.message}`, 'stripe');
        res.status(400).json({ error: 'Webhook processing error' });
      }
    }
  );

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        log(logLine);
      }
    });

    next();
  });

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      seedGeographies().catch((err) => log(`Seed error: ${err.message}`, "seed"));
      seedCourseContent().catch((err) => log(`Course seed error: ${err.message}`, "course-seed"));

      (async () => {
        try {
          const { db } = await import("./db");
          const { analyses, leads, users } = await import("@shared/schema");
          const { sql, eq, isNull } = await import("drizzle-orm");
          const [{ count }] = await db.select({ count: sql<number>`count(*)` })
            .from(analyses)
            .where(isNull(analyses.userId));
          if (Number(count) > 0) {
            const result = await db.execute(sql`
              UPDATE analyses a
              SET user_id = u.id
              FROM leads l, users u
              WHERE a.lead_id = l.id
                AND LOWER(l.email) = LOWER(u.email)
                AND a.user_id IS NULL
            `);
            log(`Backfilled user_id on ${result.rowCount ?? 0} orphaned analyses`, "analysis-backfill");
          }
        } catch (err: any) {
          log(`Analysis backfill error: ${err.message}`, "analysis-backfill");
        }
      })();
      import("./weeklyDigest").then(({ scheduleWeeklyDigest }) => {
        scheduleWeeklyDigest();
      }).catch((err) => log(`Weekly digest schedule error: ${err.message}`, "digest"));
    },
  );
})();
