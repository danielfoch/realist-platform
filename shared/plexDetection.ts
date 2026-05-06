export type PlexDetectionInput = {
  propertyType?: string | null;
  tags?: Array<string | null | undefined> | null;
  unitCount?: number | null;
  kitchenCount?: number | null;
  meterCount?: number | null;
  entranceCount?: number | null;
  description?: string | null;
  remarks?: string | null;
};

export type PlexDetectionResult = {
  explicit_plex_type: string | null;
  kitchen_count: number | null;
  estimated_unit_count: number | null;
  plex_confidence_score: number;
  plex_detection_reason: string;
  legal_status_known: "yes" | "no" | "unknown";
  needs_manual_review: boolean;
};

const explicitTypes = [
  { pattern: /\b(duplex|legal duplex)\b/i, type: "duplex", units: 2 },
  { pattern: /\btriplex\b/i, type: "triplex", units: 3 },
  { pattern: /\b(4plex|fourplex)\b/i, type: "fourplex", units: 4 },
  { pattern: /\b(multiplex|multi[-\s]?family)\b/i, type: "multiplex", units: 4 },
  { pattern: /\b(legal basement|secondary suite)\b/i, type: "secondary_suite", units: 2 },
];

const textCues = [
  { pattern: /\b(two|2)\s+kitchens?\b/i, label: "2 kitchens mentioned", units: 2 },
  { pattern: /\b(three|3)\s+kitchens?\b/i, label: "3 kitchens mentioned", units: 3 },
  { pattern: /\b(four|4)\s+kitchens?\b/i, label: "4 kitchens mentioned", units: 4 },
  { pattern: /\bsecond\s+kitchen\b/i, label: "second kitchen mentioned", units: 2 },
  { pattern: /\badditional\s+kitchen\b/i, label: "additional kitchen mentioned", units: 2 },
  { pattern: /\b(kitchenette|rough[-\s]?in kitchen)\b/i, label: "secondary kitchen setup mentioned", units: 2 },
  { pattern: /\bseparate entrance\b/i, label: "separate entrance mentioned" },
  { pattern: /\bbasement apartment\b/i, label: "basement apartment mentioned", units: 2 },
  { pattern: /\bin[-\s]?law suite\b/i, label: "in-law suite mentioned", units: 2 },
  { pattern: /\bupper\s*\/\s*lower units?\b/i, label: "upper/lower units mentioned", units: 2 },
  { pattern: /\bseparately metered\b/i, label: "separately metered mentioned" },
  { pattern: /\bnon[-\s]?conforming duplex\b/i, label: "non-conforming duplex mentioned", units: 2, legalKnown: "no" as const },
  { pattern: /\blegal duplex\b/i, label: "legal duplex mentioned", units: 2, legalKnown: "yes" as const },
];

function cleanText(input: PlexDetectionInput) {
  return [
    input.propertyType,
    ...(input.tags || []),
    input.description,
    input.remarks,
  ]
    .filter(Boolean)
    .join(" ");
}

function unitsFromKitchens(kitchenCount?: number | null) {
  if (!kitchenCount || kitchenCount < 2) return null;
  if (kitchenCount >= 4) return 4;
  return kitchenCount;
}

function kitchenCountFromText(text: string) {
  const normalized = text.toLowerCase();
  const direct = normalized.match(/\b(?:kitchens?|kitchen count|number of kitchens)\s*[:\-]?\s*([2-9])\b/);
  if (direct) return Math.min(4, Number(direct[1]));
  const reverse = normalized.match(/\b([2-9]|two|three|four)\s+(?:full\s+)?kitchens?\b/);
  if (!reverse) return null;
  const value = reverse[1];
  if (value === "two") return 2;
  if (value === "three") return 3;
  if (value === "four") return 4;
  return Math.min(4, Number(value));
}

export function detectPossiblePlex(input: PlexDetectionInput): PlexDetectionResult {
  const text = cleanText(input);
  const explicit = explicitTypes.find((candidate) => candidate.pattern.test(text));
  const cueMatches = textCues.filter((candidate) => candidate.pattern.test(text));
  const inferredKitchenCount = input.kitchenCount ?? kitchenCountFromText(text);
  const kitchenUnits = unitsFromKitchens(inferredKitchenCount);
  const fieldUnits = input.unitCount && input.unitCount > 1 ? input.unitCount : null;
  const cueUnits = Math.max(0, ...cueMatches.map((cue) => cue.units || 0)) || null;
  const estimatedUnits = explicit?.units || fieldUnits || kitchenUnits || cueUnits || null;
  const legalCue = cueMatches.find((cue) => cue.legalKnown)?.legalKnown;

  let score = 0;
  if (explicit) score += 55;
  if (fieldUnits) score += 25;
  if (kitchenUnits) score += 25;
  if ((input.meterCount || 0) > 1) score += 10;
  if ((input.entranceCount || 0) > 1) score += 8;
  score += Math.min(cueMatches.length * 8, 24);
  if (!estimatedUnits) score = Math.min(score, 30);
  score = Math.max(0, Math.min(100, score));

  const reasons = [
    explicit ? `explicit ${explicit.type.replace(/_/g, " ")} signal` : null,
    fieldUnits ? `${fieldUnits} unit field` : null,
    kitchenUnits ? `${inferredKitchenCount} kitchens detected` : null,
    ...cueMatches.map((cue) => cue.label),
  ].filter(Boolean);

  return {
    explicit_plex_type: explicit?.type || null,
    kitchen_count: inferredKitchenCount ?? null,
    estimated_unit_count: estimatedUnits,
    plex_confidence_score: score,
    plex_detection_reason: reasons.length
      ? `Possible ${estimatedUnits || "multi"}-unit setup based on ${reasons.join(", ")}. Verify legal status before underwriting.`
      : "No strong plex signal detected from available fields.",
    legal_status_known: legalCue || (explicit?.type?.startsWith("legal") ? "yes" : "unknown"),
    needs_manual_review: Boolean(estimatedUnits) && (score < 80 || legalCue !== "yes"),
  };
}
