import crypto from "crypto";
import { db } from "./db";
import { askRealistInteractions, findDealsQueries, type InsertAskRealistInteraction } from "@shared/schema";

export function hashDemandText(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 16);
}

export function summarizeToolInput(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const allowed = [
    "city",
    "province",
    "price",
    "monthlyRent",
    "units",
    "beds",
    "downPaymentPercent",
    "interestRate",
    "vacancyRate",
    "expenseRatio",
  ];
  const summary: Record<string, unknown> = {};
  for (const key of allowed) {
    const value = source[key];
    if (typeof value === "string") summary[key] = value.slice(0, 120);
    else if (typeof value === "number" || typeof value === "boolean") summary[key] = value;
  }
  if (typeof source.query === "string") summary.queryHash = hashDemandText(source.query);
  return Object.keys(summary).length ? summary : null;
}

export function logAskRealistInteraction(row: InsertAskRealistInteraction): void {
  db.insert(askRealistInteractions).values(row).catch((error) => {
    console.error("[demand-ledger] ask realist write failed:", error?.message || error);
  });
}

export function logFindDealsQuery(input: {
  rawQuery: string;
  parsedFilters?: unknown;
  resultCount?: number | null;
  source: "web" | "agent_api";
  channel?: string | null;
  apiKeyId?: string | null;
  sessionId?: string | null;
  userId?: string | null;
}): void {
  const rawQuery = input.rawQuery.trim();
  if (!rawQuery) return;
  db.insert(findDealsQueries).values({
    rawQuery,
    queryHash: hashDemandText(rawQuery),
    parsedFilters: input.parsedFilters as any ?? null,
    resultCount: input.resultCount ?? null,
    source: input.source,
    channel: input.channel ?? input.source,
    apiKeyId: input.apiKeyId ?? null,
    sessionId: input.sessionId ?? null,
    userId: input.userId ?? null,
  }).catch((error) => {
    console.error("[demand-ledger] find deals write failed:", error?.message || error);
  });
}
