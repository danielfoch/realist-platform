import { execFileSync } from "child_process";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { db } from "../src/db";

type QueryRow = Record<string, any>;

const REVIEW_EVENT_NAMES = new Set([
  "underwriting_opened",
  "underwriting_started",
  "underwriting_completed",
  "underwriting_inputs_changed",
  "underwriting_exported_or_saved",
  "analysis_started",
  "analysis_completed",
  "deal_saved",
  "deal_rejected",
  "deal_submitted",
  "buyer_rep_requested",
  "referral_requested",
  "call_booked",
]);

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function markdownTable(rows: QueryRow[], columns: string[]): string {
  if (!rows.length) return "_No rows._";
  if (rows.some((row) => row.error) && !columns.includes("error")) {
    return markdownTable(rows, ["error"]);
  }
  const header = `| ${columns.join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((column) => String(row[column] ?? "")).join(" | ")} |`);
  return [header, divider, ...body].join("\n");
}

async function queryRows(sql: string, params: readonly unknown[]): Promise<QueryRow[]> {
  try {
    const result = await db.query(sql, params);
    return result.rows;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [{ error: message }];
  }
}

function gitLogSince(since: string): QueryRow[] {
  try {
    const output = execFileSync("git", [
      "log",
      `--since=${since}`,
      "--date=short",
      "--pretty=format:%h%x09%ad%x09%an%x09%s",
    ], { encoding: "utf8" }).trim();

    if (!output) return [];
    return output.split("\n").slice(0, 30).map((line) => {
      const [sha, date, author, ...subjectParts] = line.split("\t");
      return { sha, date, author, subject: subjectParts.join("\t") };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [{ sha: "error", date: "", author: "", subject: message }];
  }
}

function buildInsights(input: {
  events: QueryRow[];
  activityEvents: QueryRow[];
  dealActivity: QueryRow[];
  propertyAnalyses: QueryRow[];
  assumptionEdits: QueryRow[];
  propertyKeys: QueryRow[];
  aiDefaults: QueryRow[];
  trainingRuns: QueryRow[];
  modelPredictionQuality: QueryRow[];
}): string[] {
  const insights: string[] = [];
  const queryErrors = [
    ...input.events,
    ...input.activityEvents,
    ...input.dealActivity,
    ...input.propertyAnalyses,
    ...input.assumptionEdits,
    ...input.propertyKeys,
    ...input.aiDefaults,
    ...input.trainingRuns,
    ...input.modelPredictionQuality,
  ].filter((row) => row.error);

  if (queryErrors.length) {
    return [
      `Database access failed for ${queryErrors.length} weekly learning query group(s). Fix runtime database access before proposing product changes.`,
    ];
  }

  const totalEvents = input.events.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const totalActivityEvents = input.activityEvents.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const reviewEvents = input.events
    .filter((row) => REVIEW_EVENT_NAMES.has(String(row.event)))
    .reduce((sum, row) => sum + Number(row.count || 0), 0);
  const reviewActivityEvents = input.activityEvents
    .filter((row) => REVIEW_EVENT_NAMES.has(String(row.event_name)))
    .reduce((sum, row) => sum + Number(row.count || 0), 0);

  if (totalEvents + totalActivityEvents === 0) {
    insights.push("No behavioral events were captured in the period. Verify tracking, traffic, or production database access before proposing product changes.");
  } else {
    insights.push(`${totalActivityEvents} canonical activity events and ${totalEvents} legacy API events were captured; ${reviewActivityEvents + reviewEvents} were deal-analysis or execution-intent events.`);
  }

  const hasPayloadKeys = input.propertyKeys.some((row) => row.property_key && !row.error);
  if (!hasPayloadKeys && totalEvents + totalActivityEvents > 0) {
    insights.push("Events exist but structured payload keys are thin. Prioritize richer client-side analytics before asking AI to infer product changes.");
  }

  const saved = input.events.find((row) => row.event === "deal_saved" || row.event === "underwriting_exported_or_saved");
  const opened = input.events.find((row) => row.event === "underwriting_opened" || row.event === "underwriting_started");
  if (opened && !saved) {
    insights.push("Users are opening underwriting without enough save/export signals. Replit should inspect the post-analysis CTA path.");
  }

  const editedAssumptions = input.assumptionEdits.reduce((sum, row) => sum + Number(row.edits || 0), 0);
  if (editedAssumptions > 0) {
    insights.push(`${editedAssumptions} user-edited underwriting assumptions were captured. These are the first proprietary learning signals.`);
  }

  const dealCount = input.dealActivity.reduce((sum, row) => sum + Number(row.analyses || 0), 0);
  const propertyAnalysisCount = input.propertyAnalyses.reduce((sum, row) => sum + Number(row.analyses || 0), 0);
  if (dealCount > 0) {
    insights.push(`${dealCount} legacy deal analyses were created. Use city/property/strategy clusters to tune default assumptions.`);
  }
  if (propertyAnalysisCount > 0) {
    insights.push(`${propertyAnalysisCount} canonical property analyses were created. Use their assumptions/final assumptions as the primary learning source.`);
  }

  const trainedMetrics = input.aiDefaults.reduce((sum, row) => sum + Number(row.metrics || 0), 0);
  if (trainedMetrics > 0) {
    insights.push(`${trainedMetrics} market-default metrics are already trained in ai_market_defaults. Product suggestions should use that table instead of inventing new defaults.`);
  }

  const latestTraining = input.trainingRuns.find((row) => row.created_at);
  if (latestTraining) {
    insights.push(`Latest AI-default training run: ${latestTraining.created_at} across ${latestTraining.markets_trained} markets and ${latestTraining.metrics_written} metrics.`);
  }

  const resolvedPredictions = input.modelPredictionQuality.reduce((sum, row) => sum + Number(row.resolved_predictions || 0), 0);
  if (resolvedPredictions > 0) {
    insights.push(`${resolvedPredictions} model predictions have resolved outcomes. Use model_predictions error metrics for estimator improvements.`);
  }

  return insights;
}

function buildReplitPrompt(reportPath: string, insights: string[]): string {
  return [
    "# Replit Handoff: Realist Platform Learning Loop",
    "",
    "You are Replit Agent working in `realist-platform`. Respect `AGENTS.md`: frontend/UI files are yours; backend scripts and APIs belong to Clyde.",
    "",
    "## Goal",
    "Improve the user-facing deal-analysis flow based on the latest weekly learning report.",
    "",
    "## Context",
    `Read \`${reportPath}\` first.`,
    "",
    "## Product Signals",
    ...insights.map((insight) => `- ${insight}`),
    "",
    "## Constraints",
    "- Do not change database schema.",
    "- Use the existing learning tables: user_activity_events, property_analyses, underwriting_assumptions, ai_market_defaults, ai_training_runs, and model_predictions.",
    "- Do not edit `src/**`, `server/**`, `scripts/**`, or migrations.",
    "- Keep changes small enough for one reviewable PR.",
    "- Run the existing frontend checks before handing back.",
    "",
    "## Acceptance",
    "- The changed UI captures or clarifies the exact investor action being optimized.",
    "- Any new analytics use `track(...)` from `client/src/lib/analytics.ts`.",
    "- No marketing-page detour. Improve the actual workflow.",
  ].join("\n");
}

async function main() {
  const anchor = process.argv[2] ? new Date(process.argv[2]) : new Date();
  const end = anchor;
  const start = new Date(anchor);
  start.setDate(start.getDate() - 7);

  const params = [start.toISOString(), end.toISOString()];

  const events = await queryRows(`
    SELECT
      event,
      COUNT(*)::int AS count,
      COUNT(DISTINCT COALESCE(user_id::text, session_id))::int AS actors,
      MAX(created_at)::text AS latest
    FROM user_events
    WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
    GROUP BY event
    ORDER BY count DESC, event ASC
    LIMIT 25
  `, params);

  const activityEvents = await queryRows(`
    SELECT
      event_name,
      COUNT(*)::int AS count,
      COUNT(DISTINCT COALESCE(user_id::text, session_id))::int AS actors,
      MAX(event_timestamp)::text AS latest
    FROM user_activity_events
    WHERE event_timestamp >= $1::timestamptz AND event_timestamp < $2::timestamptz
    GROUP BY event_name
    ORDER BY count DESC, event_name ASC
    LIMIT 25
  `, params);

  const propertyKeys = await queryRows(`
    WITH keys AS (
      SELECT key
      FROM user_events, LATERAL jsonb_object_keys(COALESCE(properties, '{}'::jsonb)) AS key
      WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
      UNION ALL
      SELECT key
      FROM user_activity_events, LATERAL jsonb_object_keys(COALESCE(metadata, '{}'::jsonb)) AS key
      WHERE event_timestamp >= $1::timestamptz AND event_timestamp < $2::timestamptz
    )
    SELECT key AS property_key, COUNT(*)::int AS count
    FROM keys
    GROUP BY key
    ORDER BY count DESC, key ASC
    LIMIT 30
  `, params);

  const dealActivity = await queryRows(`
    SELECT
      COALESCE(city, 'unknown') AS city,
      COALESCE(province, '') AS province,
      COALESCE(property_type, 'unknown') AS property_type,
      COUNT(*)::int AS analyses,
      COUNT(DISTINCT user_id)::int AS users,
      ROUND(AVG(deal_score)::numeric, 1)::text AS avg_deal_score
    FROM deal_analyses
    WHERE analyzed_at >= $1::timestamptz AND analyzed_at < $2::timestamptz
    GROUP BY city, province, property_type
    ORDER BY analyses DESC
    LIMIT 20
  `, params);

  const propertyAnalyses = await queryRows(`
    SELECT
      COALESCE(city, 'unknown') AS city,
      COALESCE(province, '') AS province,
      COALESCE(property_type, 'unknown') AS property_type,
      COUNT(*)::int AS analyses,
      COUNT(DISTINCT user_id)::int AS users,
      COUNT(*) FILTER (WHERE final_assumptions IS NOT NULL)::int AS final_assumption_sets,
      COUNT(*) FILTER (WHERE ai_assumptions IS NOT NULL)::int AS ai_assumption_sets
    FROM property_analyses
    WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
      AND is_deleted IS NOT TRUE
      AND is_anonymized IS NOT TRUE
    GROUP BY city, province, property_type
    ORDER BY analyses DESC
    LIMIT 20
  `, params);

  const assumptionEdits = await queryRows(`
    SELECT
      key,
      source,
      COUNT(*)::int AS edits
    FROM underwriting_assumptions
    WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
    GROUP BY key, source
    ORDER BY edits DESC
    LIMIT 25
  `, params);

  const aiDefaults = await queryRows(`
    SELECT
      market,
      strategy,
      COUNT(*)::int AS metrics,
      SUM(sample_size)::int AS samples,
      MAX(trained_at)::text AS latest_training
    FROM ai_market_defaults
    GROUP BY market, strategy
    ORDER BY metrics DESC, samples DESC
    LIMIT 25
  `, []);

  const trainingRuns = await queryRows(`
    SELECT
      created_at::text,
      analyses_total,
      markets_trained,
      metrics_written,
      COALESCE(notes, '') AS notes
    FROM ai_training_runs
    ORDER BY created_at DESC
    LIMIT 5
  `, []);

  const modelPredictionQuality = await queryRows(`
    SELECT
      model_key,
      model_version,
      COUNT(*)::int AS predictions,
      COUNT(*) FILTER (WHERE resolved_at IS NOT NULL)::int AS resolved_predictions,
      ROUND(AVG(abs_error) FILTER (WHERE abs_error IS NOT NULL)::numeric, 2)::text AS avg_abs_error,
      ROUND(AVG(pct_error) FILTER (WHERE pct_error IS NOT NULL)::numeric, 2)::text AS avg_pct_error,
      MAX(created_at)::text AS latest_prediction
    FROM model_predictions
    WHERE (created_at >= $1::timestamptz AND created_at < $2::timestamptz)
       OR (resolved_at >= $1::timestamptz AND resolved_at < $2::timestamptz)
    GROUP BY model_key, model_version
    ORDER BY predictions DESC
    LIMIT 20
  `, params);

  const commits = gitLogSince(start.toISOString());
  const insights = buildInsights({
    events,
    activityEvents,
    dealActivity,
    propertyAnalyses,
    assumptionEdits,
    propertyKeys,
    aiDefaults,
    trainingRuns,
    modelPredictionQuality,
  });

  const outDir = path.join(process.cwd(), "reports", "platform-learning");
  await mkdir(outDir, { recursive: true });

  const reportName = `${isoDate(end)}.md`;
  const reportPath = path.join(outDir, reportName);
  const relativeReportPath = path.relative(process.cwd(), reportPath);
  const handoffPath = path.join(outDir, `${isoDate(end)}-replit-handoff.md`);
  const relativeHandoffPath = path.relative(process.cwd(), handoffPath);

  const report = [
    `# Realist Platform Learning Loop - ${isoDate(end)}`,
    "",
    `Window: ${start.toISOString()} to ${end.toISOString()}`,
    "",
    "## Decision",
    insights.some((insight) => insight.includes("Database access failed"))
      ? "Do not generate product PRs yet. Fix weekly loop database access first."
      : insights.some((insight) => insight.includes("No user events"))
      ? "Do not generate product PRs yet. Fix traffic/tracking visibility first."
      : "Review-worthy signals exist. Use the Replit handoff if the insights point to a workflow issue.",
    "",
    "## Insights",
    ...insights.map((insight) => `- ${insight}`),
    "",
    "## Event Summary",
    "Canonical events from `user_activity_events`:",
    "",
    markdownTable(activityEvents, ["event_name", "count", "actors", "latest"]),
    "",
    "Legacy/API events from `user_events`:",
    "",
    markdownTable(events, ["event", "count", "actors", "latest"]),
    "",
    "## Event Payload Keys",
    markdownTable(propertyKeys, ["property_key", "count"]),
    "",
    "## Canonical Property Analysis Clusters",
    markdownTable(propertyAnalyses, ["city", "province", "property_type", "analyses", "users", "final_assumption_sets", "ai_assumption_sets"]),
    "",
    "## Legacy Deal Analysis Clusters",
    markdownTable(dealActivity, ["city", "province", "property_type", "analyses", "users", "avg_deal_score"]),
    "",
    "## Underwriting Assumption Signals",
    markdownTable(assumptionEdits, ["key", "source", "edits"]),
    "",
    "## AI Market Defaults",
    markdownTable(aiDefaults, ["market", "strategy", "metrics", "samples", "latest_training"]),
    "",
    "## AI Training Runs",
    markdownTable(trainingRuns, ["created_at", "analyses_total", "markets_trained", "metrics_written", "notes"]),
    "",
    "## Model Prediction Quality",
    markdownTable(modelPredictionQuality, ["model_key", "model_version", "predictions", "resolved_predictions", "avg_abs_error", "avg_pct_error", "latest_prediction"]),
    "",
    "## Git Commits Since Window Start",
    markdownTable(commits, ["sha", "date", "author", "subject"]),
    "",
    "## Replit Handoff",
    `Generated: \`${relativeHandoffPath}\``,
    "",
    "## Next Loop Upgrade",
    "- Call the existing AI defaults trainer before report generation when the scheduler has production database access.",
    "- Add GitHub PR API ingestion once the GitHub token is available in the runtime.",
    "- Add Telegram/calendar delivery from the scheduler host, not from the web app runtime.",
    "- Push new product instrumentation into `user_activity_events` so it joins the Fable-built intelligence layer.",
  ].join("\n");

  await writeFile(reportPath, `${report}\n`);
  await writeFile(handoffPath, `${buildReplitPrompt(relativeReportPath, insights)}\n`);

  console.log(JSON.stringify({
    ok: true,
    report: relativeReportPath,
    replitHandoff: relativeHandoffPath,
    insights,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
