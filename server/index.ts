import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { seedGeographies } from "./seedGeographies";
import { seedCourseContent } from "./courseSeed";
import { processPendingGhlNotifications } from "./notifications";

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
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS property_analyses (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_mls_number text NOT NULL,
        property_id varchar,
        user_id varchar NOT NULL,
        parent_analysis_id varchar,
        source_analysis_id varchar,
        visibility text NOT NULL DEFAULT 'public',
        title text,
        summary text,
        user_notes text,
        ai_analysis_text text,
        user_analysis_text text,
        sentiment text,
        city text,
        province text,
        market text,
        neighbourhood text,
        property_type text,
        listing_price real,
        listing_snapshot jsonb,
        source_context jsonb,
        assumptions jsonb,
        calculated_metrics jsonb,
        ai_assumptions jsonb,
        final_assumptions jsonb,
        data_use_consent jsonb,
        model_version text,
        prompt_version text,
        is_deleted boolean NOT NULL DEFAULT false,
        is_anonymized boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS property_analyses_listing_lookup_idx
      ON property_analyses(listing_mls_number, visibility, created_at)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS analysis_assumption_changes (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_id varchar NOT NULL,
        field_name text NOT NULL,
        ai_value jsonb,
        user_value jsonb,
        delta_value jsonb,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS analysis_feedback (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_id varchar NOT NULL,
        user_id varchar NOT NULL,
        feedback_type text NOT NULL,
        comment text,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS analysis_consent_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        analysis_id varchar NOT NULL,
        visibility text NOT NULL,
        use_for_product_improvement boolean NOT NULL DEFAULT false,
        use_for_ai_training boolean NOT NULL DEFAULT false,
        use_for_anonymized_market_dataset boolean NOT NULL DEFAULT false,
        allow_commercial_data_licensing boolean NOT NULL DEFAULT false,
        consent_text_version text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS analysis_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_id varchar,
        listing_mls_number text NOT NULL,
        user_id varchar,
        event_type text NOT NULL,
        visibility text,
        metadata jsonb,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS listing_watchers (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL,
        listing_mls_number text NOT NULL,
        source_type text NOT NULL,
        source_id varchar,
        watch_analysis_updates boolean NOT NULL DEFAULT true,
        watch_comment_updates boolean NOT NULL DEFAULT true,
        watch_price_updates boolean NOT NULL DEFAULT true,
        watch_status_updates boolean NOT NULL DEFAULT true,
        watch_consensus_updates boolean NOT NULL DEFAULT true,
        last_seen_at timestamp NOT NULL DEFAULT now(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS listing_watchers_user_listing_source_idx
      ON listing_watchers(user_id, listing_mls_number, source_type, source_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS listing_watchers_listing_idx
      ON listing_watchers(listing_mls_number, updated_at)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notification_events (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type text NOT NULL,
        user_id varchar,
        listing_mls_number text,
        analysis_id varchar,
        comment_id varchar,
        market text,
        city text,
        payload_json jsonb NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS notification_events_type_created_idx
      ON notification_events(event_type, created_at)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notification_queue (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_user_id varchar NOT NULL,
        notification_event_id varchar NOT NULL,
        channel text NOT NULL,
        template_key text NOT NULL,
        dedupe_key text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        scheduled_for timestamp NOT NULL DEFAULT now(),
        sent_at timestamp,
        failure_reason text,
        payload_json jsonb NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS notification_queue_dedupe_idx
      ON notification_queue(dedupe_key)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS notification_queue_status_schedule_idx
      ON notification_queue(status, scheduled_for)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL UNIQUE,
        marketing_email_enabled boolean NOT NULL DEFAULT true,
        product_updates_enabled boolean NOT NULL DEFAULT true,
        listing_watch_alerts_enabled boolean NOT NULL DEFAULT true,
        market_alerts_enabled boolean NOT NULL DEFAULT true,
        community_alerts_enabled boolean NOT NULL DEFAULT true,
        digest_enabled boolean NOT NULL DEFAULT true,
        quiet_hours_start text,
        quiet_hours_end text,
        updated_at timestamp NOT NULL DEFAULT now(),
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS underwriting_assumption_snapshots (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_id varchar NOT NULL,
        snapshot_type text NOT NULL,
        assumptions jsonb NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_prompt_versions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        version text NOT NULL,
        prompt_template text,
        metadata jsonb,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_output_versions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_id varchar NOT NULL,
        prompt_version text,
        model_version text,
        output_text text,
        output_json jsonb,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS community_metric_snapshots (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_mls_number text NOT NULL,
        aggregate_json jsonb NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS property_investment_metrics (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id text NOT NULL,
        source_listing_id text,
        calculation_version text NOT NULL,
        gross_yield real,
        cap_rate real,
        cash_on_cash_return real,
        irr real,
        noi real,
        annual_gross_rent real,
        annual_operating_expenses real,
        monthly_cash_flow real,
        dscr real,
        expense_ratio real,
        rent_assumption_source text,
        expense_assumption_source text,
        financing_assumption_source text,
        exit_assumption_source text,
        assumptions_complete boolean NOT NULL DEFAULT false,
        cap_rate_confidence text,
        irr_confidence text,
        calculation_warnings jsonb,
        assumptions_json jsonb,
        calculated_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS property_investment_metrics_property_idx ON property_investment_metrics(property_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS property_investment_metrics_listing_idx ON property_investment_metrics(source_listing_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS property_investment_metrics_gross_yield_idx ON property_investment_metrics(gross_yield)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS property_investment_metrics_cap_rate_idx ON property_investment_metrics(cap_rate)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS property_investment_metrics_cash_on_cash_idx ON property_investment_metrics(cash_on_cash_return)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS property_investment_metrics_irr_idx ON property_investment_metrics(irr)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS property_investment_metrics_monthly_cf_idx ON property_investment_metrics(monthly_cash_flow)`);
    await db.execute(sql`ALTER TABLE listing_comments ADD COLUMN IF NOT EXISTS parent_comment_id varchar`);
    await db.execute(sql`ALTER TABLE listing_comments ADD COLUMN IF NOT EXISTS referenced_analysis_id varchar`);
    await db.execute(sql`ALTER TABLE listing_comments ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'`);
    await db.execute(sql`ALTER TABLE listing_comments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`);
    await db.execute(sql`ALTER TABLE listing_comments ADD COLUMN IF NOT EXISTS helpful_count integer NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE listing_comments ADD COLUMN IF NOT EXISTS reply_count integer NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE listing_comments ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE listing_comments ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE listing_comments ADD COLUMN IF NOT EXISTS user_display_snapshot text`);
    await db.execute(sql`ALTER TABLE listing_comments ADD COLUMN IF NOT EXISTS metadata_json jsonb`);
    await db.execute(sql`ALTER TABLE listing_comments ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now()`);
    await db.execute(sql`ALTER TABLE listing_comments ADD COLUMN IF NOT EXISTS edited_at timestamp`);
    await db.execute(sql`ALTER TABLE listing_comments ADD COLUMN IF NOT EXISTS deleted_at timestamp`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS total_analysis_count integer NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS public_analysis_count integer NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS unique_public_user_count integer NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS public_comment_count integer NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS unique_public_comment_user_count integer NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS latest_public_comment_at timestamp`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS latest_public_analysis_at timestamp`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS latest_comment_preview text`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS latest_comment_at timestamp`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS median_cap_rate real`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS median_cash_on_cash real`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS median_projected_rent real`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS median_noi real`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS median_monthly_cash_flow real`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS median_expense_ratio real`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS bullish_count integer NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS neutral_count integer NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS bearish_count integer NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS consensus_label text`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS confidence_score real`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS latest_private_note_at timestamp`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS pinned_comment_count integer NOT NULL DEFAULT 0`);
    await db.execute(sql`ALTER TABLE listing_analysis_aggregates ADD COLUMN IF NOT EXISTS reported_comment_count integer NOT NULL DEFAULT 0`);
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
      const drainNotifications = async () => {
        try {
          const result = await processPendingGhlNotifications();
          if (result.sent || result.failed) {
            log(`Notification queue drained: sent=${result.sent}, failed=${result.failed}`, "notifications");
          }
        } catch (err: any) {
          log(`Notification queue error: ${err.message}`, "notifications");
        }
      };
      drainNotifications();
      setInterval(drainNotifications, 60 * 1000);
    },
  );
})();
