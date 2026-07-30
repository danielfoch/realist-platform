/**
 * GPT Image 2 concept rendering for the public multiplex feasibility report.
 *
 * The endpoint accepts only a small, server-defined massing vocabulary. Users
 * cannot submit arbitrary prompts, and the image is always presented as an
 * illustration subordinate to the deterministic site-plan dimensions.
 */

import crypto from "node:crypto";
import { z } from "zod";

const MAIN_FORMS = [
  "narrow stacked multiplex",
  "stacked triplex",
  "central-core apartment multiplex",
  "stacked fourplex",
  "side-by-side sixplex form",
  "semi-detached fourplex form",
  "wide-lot courtyard multiplex",
  "side-by-side family multiplex",
] as const;

export const multiplexConceptImageSchema = z.object({
  model: z.literal("gpt-image-2"),
  endpoint: z.literal("/api/multiplex-concept-image"),
  frontageFt: z.number().min(15).max(100),
  depthFt: z.number().min(60).max(300),
  principalUnits: z.number().int().min(2).max(12),
  totalUnits: z.number().int().min(2).max(13),
  storeys: z.number().int().min(1).max(8),
  mainForm: z.enum(MAIN_FORMS),
  rearSuiteType: z.enum(["laneway", "garden"]).nullable(),
  rearSuiteStoreys: z.number().int().min(1).max(3).nullable(),
  laneAccess: z.boolean(),
  majorStreet: z.boolean(),
  transitStatus: z.enum([
    "unknown",
    "outside",
    "likely_mtsa_inferred",
    "mtsa",
    "pmtsa",
  ]),
});

export type MultiplexConceptImageInput = z.infer<typeof multiplexConceptImageSchema>;

interface OpenAiImageResponse {
  data?: Array<{ b64_json?: string }>;
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
}

export interface MultiplexConceptImageResult {
  imageDataUrl: string;
  mediaType: "image/webp";
  model: "gpt-image-2";
  prompt: string;
  cached: boolean;
  requestId: string | null;
}

const cache = new Map<string, Omit<MultiplexConceptImageResult, "cached">>();
const MAX_CACHE_ITEMS = 50;

export function multiplexConceptImageConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function buildMultiplexConceptImagePrompt(input: MultiplexConceptImageInput): string {
  const rearBuilding = input.rearSuiteType
    ? `A separate ${input.rearSuiteStoreys}-storey, one-home ${input.rearSuiteType} suite sits at the back of the lot.`
    : "The rear yard remains open and landscaped; there is no detached rear building.";
  const access = input.laneAccess
    ? "A clearly legible public lane runs along the rear property line."
    : "There is no rear lane.";
  const street = input.majorStreet
    ? "The frontage faces a Toronto avenue / major street."
    : "The frontage faces a quiet Toronto residential street.";
  const transit = input.transitStatus === "pmtsa" || input.transitStatus === "mtsa"
    ? "The design language may feel transit-oriented, but keep the building residential in scale."
    : "";

  return [
    "Use case: photorealistic-natural",
    "Asset type: architectural concept rendering inside a real-estate feasibility report",
    "Primary request: Create one cohesive, landscape architectural presentation board with exactly two large views of the same proposed Toronto multiplex: a street-level front three-quarter view on the left and an elevated rear three-quarter view on the right.",
    `Site: a narrow rectangular urban lot exactly ${input.frontageFt} feet wide by ${input.depthFt} feet deep. ${street} ${access}`,
    `Main building: a coherent ${input.storeys}-storey ${input.mainForm} containing ${input.principalUnits} homes. Its apparent width must respect the ${input.frontageFt}-foot lot; do not make it look like a mid-rise or a wide suburban apartment block.`,
    `Rear condition: ${rearBuilding}`,
    `Total program: ${input.totalUnits} homes across all buildings. ${transit}`,
    "Style/medium: photorealistic contemporary Toronto missing-middle architecture, buildable wood-frame expression, restrained brick and warm wood or fibre-cement accents, real windows and entrances, modest native landscaping.",
    "Composition/framing: two equal architectural views separated by a clean gutter, no additional panels, no floor plans, no diagrams. Show enough neighbouring context to communicate the tight infill lot without hiding the project.",
    "Lighting/mood: bright overcast architectural photography, neutral colour, realistic materials and shadows, professional feasibility-study quality.",
    "Constraints: both views must depict the same building design and rear condition; preserve the stated storey count, lane condition, and presence or absence of the detached suite; concept-level only.",
    "Avoid: text, labels, dimensions, logos, watermarks, fantasy architecture, impossible cantilevers, underground parking ramps, towers, extra detached buildings, extra storeys, crowds, cars blocking the building, or an oversized lot.",
  ].filter(Boolean).join("\n");
}

export async function generateMultiplexConceptImage(
  input: MultiplexConceptImageInput,
): Promise<MultiplexConceptImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const prompt = buildMultiplexConceptImagePrompt(input);
  const cacheKey = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const cached = cache.get(cacheKey);
  if (cached) return { ...cached, cached: true };

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt,
      size: "1536x1024",
      quality: "medium",
      output_format: "webp",
      output_compression: 82,
      n: 1,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const requestId = response.headers.get("x-request-id");
  const payload = await response.json() as OpenAiImageResponse;
  const imageBase64 = payload.data?.[0]?.b64_json;
  if (!response.ok || !imageBase64) {
    const code = payload.error?.code || payload.error?.type || `http_${response.status}`;
    const message = payload.error?.message || "OpenAI returned no image";
    throw new Error(`${code}: ${message}`);
  }

  const result: Omit<MultiplexConceptImageResult, "cached"> = {
    imageDataUrl: `data:image/webp;base64,${imageBase64}`,
    mediaType: "image/webp",
    model: "gpt-image-2",
    prompt,
    requestId,
  };

  if (cache.size >= MAX_CACHE_ITEMS) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(cacheKey, result);
  return { ...result, cached: false };
}

