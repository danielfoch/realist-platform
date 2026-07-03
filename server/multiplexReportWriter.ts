/**
 * Multiplex Underwriter report writer (Phase 5).
 *
 * Doctrine: deterministic math computes, the LLM narrates. Claude receives the
 * full computed underwrite and writes the site summary, zoning gloss, variance
 * narrative, and recommendation — it never produces a number. A number-leak
 * validator rejects any narrative containing figures not present in the input
 * payload (one retry, then deterministic template fallback). Also falls back
 * to templates when ANTHROPIC_API_KEY is not configured.
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

let client: Anthropic | null = null;

export function reportWriterConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

// ─── Output schema ───────────────────────────────────────────────────────────

const reportSchema = z.object({
  siteSummary: z.string(),
  zoningSummary: z.string(),
  varianceNarrative: z.string(),
  riskNarrative: z.string(),
  recommendation: z.object({
    bestPath: z.string(),
    dealKillers: z.array(z.string()),
    verifyWithProfessionals: z.array(z.string()),
    nextSteps: z.array(z.string()),
  }),
});

export type MultiplexReport = z.infer<typeof reportSchema>;

/** JSON Schema for the API's structured-output constraint (repo zod is v3;
 *  the SDK's zodOutputFormat helper needs v4, so we hand the schema over raw
 *  and validate the parsed JSON with zod ourselves). */
const REPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    siteSummary: { type: "string" },
    zoningSummary: { type: "string" },
    varianceNarrative: { type: "string" },
    riskNarrative: { type: "string" },
    recommendation: {
      type: "object",
      properties: {
        bestPath: { type: "string" },
        dealKillers: { type: "array", items: { type: "string" } },
        verifyWithProfessionals: { type: "array", items: { type: "string" } },
        nextSteps: { type: "array", items: { type: "string" } },
      },
      required: ["bestPath", "dealKillers", "verifyWithProfessionals", "nextSteps"],
      additionalProperties: false,
    },
  },
  required: ["siteSummary", "zoningSummary", "varianceNarrative", "riskNarrative", "recommendation"],
  additionalProperties: false,
} as const;

// ─── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the narrative layer of realist.ca's Toronto multiplex underwriter. A deterministic engine has already computed every figure — zoning permissions, buildable envelope, build configurations, development costs, residual land value, variance risk, and the two exit takeouts: a CMHC MLI Select rental hold and a condo termination (condo-townhouse vs condo-apartment form, registration and absorption costed). The engine's dual-takeout comparison (each config's "takeout.decision" and the site-level "recommendedTakeout") already picks the better exit in comparable dollars. Your job is to explain the results the way a seasoned Toronto infill development analyst would brief an investor client.

Rules, in order of importance:
1. Use ONLY facts and figures present in the provided data. Never invent, estimate, or adjust a number. If you reference a figure, copy it exactly as given.
2. Where the data marks something inferred, assumed, or unverified, say so plainly — the reader must know what still needs professional verification.
3. Be direct and specific. Talk like an investor: cap rates, DSCR, margin on cost, residual land value. Zero hype, no hedging filler.
4. Canadian spelling. Dollar figures rounded as given in the data.
5. This is a preliminary screen, not professional advice — the recommendation must direct the reader to the right professionals for what the screen cannot verify.

Section guidance:
- siteSummary: 2-4 sentences — the lot, its zoning status, what the screens found.
- zoningSummary: 2-4 sentences — what's permitted as-of-right here and why (cite the by-law names given in the data).
- varianceNarrative: 2-4 sentences — the variance risk read and its drivers.
- riskNarrative: 2-4 sentences — trees, conservation, heritage, and screening gaps.
- recommendation.bestPath: 2-4 sentences — which configuration and takeout the numbers favour (follow recommendedTakeout: MLI Select hold vs condo termination, naming the condo form where relevant), and why.
- recommendation.dealKillers: the 2-4 things that would kill this deal, each one sentence.
- recommendation.verifyWithProfessionals: 3-5 items, each naming the professional and what they must confirm.
- recommendation.nextSteps: 3-5 concrete diligence actions in order.`;

// ─── Number-leak validator ───────────────────────────────────────────────────

/**
 * Every number in the narrative must appear somewhere in the input payload.
 * Tolerates formatting ($1,234,567 vs 1234567), rounding to thousands/millions
 * ("$4.3M", "643k"), percentages of fractions (0.0475 -> 4.75%), and years.
 */
export function findLeakedNumbers(narrative: string, payload: unknown): string[] {
  const allowed = new Set<string>();
  const addNumber = (n: number) => {
    if (!Number.isFinite(n)) return;
    const abs = Math.abs(n);
    const variants = [
      n,
      Math.round(n),
      Math.round(n * 100) / 100,
      Math.round(n * 10) / 10,
      // percentage form of fractions
      Math.round(n * 100),
      Math.round(n * 1000) / 10,
      Math.round(n * 10000) / 100,
      // thousands / millions roundings
      Math.round(abs / 1000),
      Math.round(abs / 100000) / 10,
      Math.round(abs / 1000000),
      Math.round(abs / 100000) / 10,
      Math.round(abs / 10000) / 100,
    ];
    for (const v of variants) allowed.add(String(Math.abs(v)));
  };
  const walk = (v: unknown) => {
    if (typeof v === "number") addNumber(v);
    else if (typeof v === "string") {
      for (const m of v.match(/-?\d+(?:\.\d+)?/g) ?? []) addNumber(Number(m));
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(payload);
  // Small counts and common structural numbers are always fine
  for (let i = 0; i <= 20; i++) allowed.add(String(i));

  const leaks: string[] = [];
  const numbersInText = narrative.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? [];
  for (const raw of numbersInText) {
    const n = Number(raw);
    // years and by-law numbers read as citations, not figures
    if (n >= 1900 && n <= 2100) continue;
    if (!allowed.has(String(n))) leaks.push(raw);
  }
  return Array.from(new Set(leaks));
}

// ─── Template fallback (no API key, or validator failed twice) ──────────────

function templateReport(payload: ReportInput): MultiplexReport {
  const { address, site, underwrite } = payload;
  const zone = site.zoning?.zoneCode ?? "unverified";
  const configs = underwrite.configs ?? [];
  const best = configs.find((c: any) => c.config.key === (underwrite.winner?.hold ?? underwrite.winner?.flip)) ?? configs[0];

  return {
    siteSummary: `${address} resolved with zone ${zone}${site.zoning ? " (verified against the zoning layer)" : " (zone not verified — confirm manually)"}. Screens run: street trees (${site.trees.status}), heritage register (${site.heritage.status}), TRCA regulated area (${site.trca.status}).`,
    zoningSummary: `Modelled at up to ${underwrite.maxUnitsAsOfRight} units as-of-right. Sixplex status for this location: ${underwrite.sixplex?.status ?? "unknown"} (${underwrite.sixplex?.certainty ?? "inferred"}). See the configuration cards for the by-law envelope math.`,
    varianceNarrative: best
      ? `The ${best.config.label} carries a ${best.varianceRisk.level.toUpperCase()} variance-risk read with ${best.varianceRisk.factors.length} contributing factor(s). Review each factor listed on the configuration card.`
      : "No buildable configuration fit the envelope — any development here likely requires variances.",
    riskNarrative: [
      site.trees.cityTreeConflict ? "A City-owned tree sits near the frontage — permits and hoarding add cost and schedule risk." : null,
      site.trca.regulated ? "The site intersects the TRCA Regulated Area — a TRCA permit precedes any building permit." : null,
      site.heritage.listed ? "The property appears on the Heritage Register — alterations face heritage review." : null,
      ...(site.notes ?? []),
    ].filter(Boolean).join(" ") || "No screened risks were flagged; on-site verification is still required.",
    recommendation: {
      bestPath: (() => {
        const rec = underwrite.recommendedTakeout;
        if (rec?.configKey) {
          const recConfig = configs.find((c: any) => c.config.key === rec.configKey);
          const takeoutLabel = rec.takeout === "mli_hold" ? "a CMHC MLI Select rental hold" : "condo termination";
          return `The numbers favour the ${recConfig?.config.label ?? rec.configKey} taken out via ${takeoutLabel}. ${rec.reasons?.[0] ?? ""} Compare the configuration cards and adjust assumptions to your basis.`;
        }
        return best
          ? `The numbers favour the ${best.config.label} (${best.comparison.recommendedExit === "condo" ? "condo exit" : best.comparison.recommendedExit === "hold" ? "rental hold via MLI Select" : "neither exit pencils at these assumptions"}). Compare the configuration cards and adjust assumptions to your basis.`
          : "Re-run with confirmed lot dimensions before drawing conclusions.";
      })(),
      dealKillers: [
        "Purchase price above the residual land value for your intended exit",
        "A variance or TRCA permit the Committee/authority won't grant",
        "Hard costs materially above the modelled $/sf assumption",
      ],
      verifyWithProfessionals: [
        "Planner: zoning interpretation, ward-verified sixplex permission, and variance strategy",
        "Architect: massing, unit layouts, and the practical GFA of this specific lot",
        "Arborist: on-lot protected trees (the City inventory covers street trees only)",
        "Mortgage broker: current CMHC MLI Select appetite and pricing",
      ],
      nextSteps: [
        "Confirm lot frontage and depth against the survey",
        "Pull the zoning certificate and confirm the ward",
        "Walk the site for trees, grade, and access",
        "Get a builder's $/sf letter for this typology",
        "Re-run the underwrite with confirmed inputs",
      ],
    },
  };
}

// ─── Writer ──────────────────────────────────────────────────────────────────

export interface ReportInput {
  address: string;
  site: any;
  underwrite: any;
}

export async function writeMultiplexReport(input: ReportInput): Promise<{ report: MultiplexReport; source: "ai" | "template" }> {
  if (!reportWriterConfigured()) {
    return { report: templateReport(input), source: "template" };
  }

  const payloadJson = JSON.stringify({ address: input.address, site: input.site, underwrite: input.underwrite });

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Write the underwriting report for this computed result:\n\n${payloadJson}`,
    },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await getClient().messages.create({
        model: "claude-opus-4-8",
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        // Below Opus 4.8's 4096-token cacheable minimum today; the marker is
        // harmless and starts paying once the prompt grows past it.
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages,
        output_config: { format: { type: "json_schema", schema: REPORT_JSON_SCHEMA as any } },
      });

      const text = response.content.find((b) => b.type === "text")?.text;
      if (!text) throw new Error("no text block in response");
      const parsed = reportSchema.safeParse(JSON.parse(text));
      if (!parsed.success) throw new Error(`schema validation failed: ${parsed.error.issues[0]?.message}`);
      const report = parsed.data;

      const narrative = [
        report.siteSummary,
        report.zoningSummary,
        report.varianceNarrative,
        report.riskNarrative,
        report.recommendation.bestPath,
        ...report.recommendation.dealKillers,
        ...report.recommendation.verifyWithProfessionals,
        ...report.recommendation.nextSteps,
      ].join("\n");

      const leaks = findLeakedNumbers(narrative, { address: input.address, site: input.site, underwrite: input.underwrite });
      if (leaks.length === 0) {
        return { report, source: "ai" };
      }

      console.warn(`[multiplex-report] number leak detected (attempt ${attempt + 1}): ${leaks.join(", ")}`);
      messages.push(
        { role: "assistant", content: JSON.stringify(report) },
        {
          role: "user",
          content: `Your report contained figures not present in the data: ${leaks.join(", ")}. Rewrite it using ONLY numbers that appear in the provided payload, copied exactly.`,
        },
      );
    } catch (err: any) {
      console.error(`[multiplex-report] generation failed (attempt ${attempt + 1}):`, err.message);
      break;
    }
  }

  return { report: templateReport(input), source: "template" };
}
