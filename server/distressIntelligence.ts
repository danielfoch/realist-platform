import type { Express } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { distressListingObservations, distressSnapshots } from "@shared/schema";
import {
  previousCalendarMonth,
  summarizeDistressCohort,
  type DistressObservationForCohort,
  type DistressMarketIntelligenceResponse,
  type DistressPrimaryCategory,
} from "@shared/distressIntelligence";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function validPrimaryCategory(value: string): DistressPrimaryCategory {
  return value === "foreclosure_pos" || value === "vtb" ? value : "motivated";
}

function cohortRow(row: typeof distressListingObservations.$inferSelect): DistressObservationForCohort {
  return {
    listingKey: row.listingKey,
    listPrice: row.listPrice,
    primaryCategory: validPrimaryCategory(row.primaryCategory),
    foreclosurePos: row.foreclosurePos,
    motivated: row.motivated,
    vtb: row.vtb,
  };
}

export async function getDistressMarketIntelligence(input: {
  month?: string;
  province?: string;
  city?: string;
}): Promise<DistressMarketIntelligenceResponse | null> {
  let month = input.month;
  if (!month) {
    const [latest] = await db.selectDistinct({ month: distressListingObservations.snapshotMonth })
      .from(distressListingObservations)
      .orderBy(desc(distressListingObservations.snapshotMonth))
      .limit(1);
    month = latest?.month;
  }
  if (!month) return null;
  if (!MONTH_RE.test(month)) throw new Error("invalid_month");

  const province = input.province?.trim().toUpperCase() || undefined;
  const city = input.city?.trim() || undefined;
  if (province && !/^[A-Z]{2}$/.test(province)) throw new Error("invalid_province");
  if (city && city.length > 120) throw new Error("invalid_city");

  const previousMonth = previousCalendarMonth(month);
  const scopeConditions = [
    ...(province ? [eq(distressListingObservations.province, province)] : []),
    ...(city ? [eq(distressListingObservations.city, city)] : []),
  ];
  const rowsForMonth = async (targetMonth: string) => db.select()
    .from(distressListingObservations)
    .where(and(eq(distressListingObservations.snapshotMonth, targetMonth), ...scopeConditions));

  const [currentRows, previousRows] = await Promise.all([
    rowsForMonth(month),
    rowsForMonth(previousMonth),
  ]);
  const cohort = summarizeDistressCohort(currentRows.map(cohortRow), previousRows.map(cohortRow));

  const coverageConditions = [
    eq(distressSnapshots.month, month),
    sql`${distressSnapshots.city} IS NULL`,
    ...(province ? [eq(distressSnapshots.province, province)] : []),
  ];
  const coverageRows = await db.select().from(distressSnapshots).where(and(...coverageConditions));
  const currentCapturedAt = currentRows.reduce<Date | null>((latest, row) => (
    !latest || row.capturedAt > latest ? row.capturedAt : latest
  ), null);

  return {
    month,
    previousMonth,
    scope: { province: province || null, city: city || null },
    cohort,
    confidenceCounts: {
      high: currentRows.filter((row) => row.confidence === "high").length,
      medium: currentRows.filter((row) => row.confidence === "medium").length,
      low: currentRows.filter((row) => row.confidence === "low").length,
    },
    coverage: {
      provincesCaptured: new Set(coverageRows.map((row) => row.province)).size,
      citiesCaptured: new Set(currentRows.map((row) => `${row.province}:${row.city || ""}`).filter((value) => !value.endsWith(":"))).size,
      queriesAttempted: coverageRows.reduce((sum, row) => sum + row.queriesAttempted, 0),
      queriesSucceeded: coverageRows.reduce((sum, row) => sum + row.queriesSucceeded, 0),
      capturedAt: currentCapturedAt?.toISOString() || coverageRows[0]?.capturedAt?.toISOString() || null,
      methodologyVersion: coverageRows[0]?.methodologyVersion || "distress-v2",
    },
    methodology: {
      source: "CREA DDF active-listing PublicRemarks",
      cadence: "Monthly point-in-time capture",
      unit: "Unique active listing per capture month",
      categoriesOverlap: true,
      primaryCategoryPriority: ["foreclosure_pos", "vtb", "motivated"],
      caveats: [
        "A language match is a screening signal, not proof that an owner is in financial distress.",
        "Triggered category counts can overlap; primary category counts are mutually exclusive.",
        "No-longer-flagged listings may have sold, expired, been withdrawn, changed remarks, or fallen outside query results.",
        "Month-to-month comparisons reflect captured DDF coverage and methodology at each point in time.",
      ],
    },
  };
}

export function registerDistressIntelligenceRoutes(app: Express): void {
  app.get("/api/distress-market-intelligence", async (req, res) => {
    try {
      const result = await getDistressMarketIntelligence({
        month: typeof req.query.month === "string" ? req.query.month : undefined,
        province: typeof req.query.province === "string" ? req.query.province : undefined,
        city: typeof req.query.city === "string" ? req.query.city : undefined,
      });
      if (!result) {
        res.status(404).json({ error: "No distress observation captures are available yet" });
        return;
      }
      res.set("Cache-Control", "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600");
      res.json(result);
    } catch (error: any) {
      if (["invalid_month", "invalid_province", "invalid_city"].includes(error?.message)) {
        res.status(400).json({ error: error.message });
        return;
      }
      console.error("[distress-intelligence] Error:", error);
      res.status(500).json({ error: "Failed to build distress market intelligence" });
    }
  });
}
