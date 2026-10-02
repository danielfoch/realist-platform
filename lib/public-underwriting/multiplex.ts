import { underwriteRequestSchema, executeMultiplexUnderwriter, type UnderwriteRequest } from "@/lib/multiplex/underwriter";
import { apiError, enforceLimit, reply } from "./http";
import { PublicApiError, parseQuery, readJson } from "./model";
import { escapeMarkup } from "./visuals";
import { PUBLIC_BASE } from "./service";

export const publicMultiplexSchema = underwriteRequestSchema.omit({ assumptionOverrides: true }).strict().superRefine((input, ctx) => {
  if ((input.lat === undefined) !== (input.lng === undefined)) ctx.addIssue({ code: "custom", path: ["lat"], message: "Supply both lat and lng." });
  if (input.lat !== undefined && (input.lat < 43.57 || input.lat > 43.87 || input.lng! < -79.65 || input.lng! > -79.10)) ctx.addIssue({ code: "custom", path: ["lat"], message: "This underwriter supports Toronto only." });
});
const numberKeys = ["lat", "lng", "lotFrontageFt", "lotDepthFt", "lotAreaSqft", "purchasePrice"];
const booleanKeys = ["laneAccess", "cornerLot", "majorStreet"];
export function parseMultiplex(input: unknown) {
  const parsed = publicMultiplexSchema.safeParse(input);
  if (!parsed.success) throw new PublicApiError(400, "invalid_input", parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  return parsed.data;
}

export async function calculateMultiplex(input: UnderwriteRequest) {
  const result = await executeMultiplexUnderwriter(input, { persist: false, useAiNarrative: false });
  if (result.site.lat == null || result.site.lng == null || result.site.lat < 43.57 || result.site.lat > 43.87 || result.site.lng < -79.65 || result.site.lng > -79.1) throw new PublicApiError(422, "outside_coverage", "This underwriter supports Toronto only.");
  if (result.status !== "complete") return { ...result, authentication: "none", currency: "CAD" };
  const concept = result.underwrite.feasibility.developmentReport?.concept;
  const concepts = concept ? [concept] : [];
  const visuals = concepts.map(concept => {
    const plan = concept.sitePlan;
    const scale = 400 / Math.max(plan.lotDepthFt, 1);
    const width = plan.lotFrontageFt * scale;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 ${width + 24} 440" role="img"><title>${escapeMarkup(concept.title)} — schematic site plan</title><rect x="0" y="0" width="${width}" height="400" fill="#f5f5f5" stroke="#666"/>${plan.buildings.map(building => `<rect x="${building.offsetLeftFt * scale}" y="${building.offsetTopFt * scale}" width="${building.widthFt * scale}" height="${building.depthFt * scale}" fill="#f8e5e8" stroke="#be1730"/><text x="${(building.offsetLeftFt + building.widthFt / 2) * scale}" y="${(building.offsetTopFt + building.depthFt / 2) * scale}" text-anchor="middle" font-family="Arial" font-size="11" fill="#242424">${building.units}u · ${building.storeys}st</text>`).join("")}<text x="${width / 2}" y="421" text-anchor="middle" font-family="Arial" font-size="10">${Math.round(plan.lotFrontageFt)} × ${Math.round(plan.lotDepthFt)} ft</text></svg>`;
    return { title: concept.title, schematic: true, sitePlanSvg: svg, illustration: `${PUBLIC_BASE}${concept.sampleDrawing.imagePath}` };
  });
  return { ...result, authentication: "none", currency: "CAD", visuals, notes: ["Public calls use the existing deterministic Toronto engine and template narrative. No paid AI or member/community analysis is created.", "Site-plan visuals are the engine's schematic concepts, not surveyed layouts or architectural drawings.", "The existing geodata resolver may refresh its shared source caches. Permissions, program terms and assumptions carry their original source dates and still require verification."] };
}

export async function multiplexRoute(request: Request) {
  if (request.method === "GET" && !new URL(request.url).search) return reply({ name: "Realist public Toronto multiplex underwriting", authentication: "none", skill: `${PUBLIC_BASE}/api/underwriting/skill`, instructions: "GET query parameters or POST JSON: address, lotFrontageFt and lotDepthFt (or lotAreaSqft), optional purchasePrice. Toronto only. Source evidence and schematic concept visuals returned." });
  try {
    const input = parseMultiplex(request.method === "POST" ? await readJson(request) : parseQuery(request, numberKeys, booleanKeys));
    await enforceLimit(request, "multiplex");
    return reply(await calculateMultiplex(input));
  } catch (error) {
    if (error instanceof Error && error.name === "SiteResolutionError") return apiError(new PublicApiError(422, "site_unresolved", error.message));
    return apiError(error);
  }
}
