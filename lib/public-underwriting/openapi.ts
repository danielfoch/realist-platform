import { z } from "zod";
import { rentalSchema } from "./model";
import { publicMultiplexSchema } from "./multiplex";
import { PUBLIC_BASE, SAMPLE } from "./service";

const rental = z.toJSONSchema(rentalSchema, { unrepresentable: "any" });
const multiplex = z.toJSONSchema(publicMultiplexSchema, { unrepresentable: "any" });
function queryParameters(schema: { required?: unknown; properties?: Record<string, unknown> }, nested: string[] = []) {
  const required = schema.required as string[] ?? [];
  return Object.entries(schema.properties ?? {}).filter(([key]) => !nested.includes(key)).map(([name, property]) => ({ name, in: "query", required: required.includes(name), schema: property }));
}
const jsonContent = { "application/json": { schema: { type: "object", additionalProperties: true } } };
const errors = {
  "400": { description: "Invalid input or JSON", content: jsonContent },
  "429": { description: "Rate limit reached; respect Retry-After", headers: { "Retry-After": { schema: { type: "string" } } }, content: jsonContent },
  "503": { description: "Service temporarily unavailable", content: jsonContent },
};
const description = "No API key, account, cookies or authorization header. All money CAD; monthlyRent is the total rent across all units. Percentages use points (interestRate=5.5 means 5.5%). Missing optional fields use disclosed Realist defaults. Caller inputs are scenario claims. GET supports URL-only LLM clients. Inputs in visual links are readable by anyone with the link.";
export const UNDERWRITING_OPENAPI = {
  openapi: "3.1.0", info: { title: "Realist public underwriting API", version: "1.0.0", description }, servers: [{ url: PUBLIC_BASE }], security: [],
  paths: {
    "/api/underwriting": {
      get: { operationId: "realistUnderwriteRentalGet", summary: "Calculate a rental deal or discover the API", description, parameters: queryParameters(rental).map(parameter => ({ ...parameter, required: false })), responses: { "200": { description: "Discovery when no query is supplied; otherwise calculated metrics, inputs/provenance, sensitivities, memo, offer prices and PNG/SVG/report links", content: jsonContent }, ...errors } },
      post: { operationId: "realistUnderwriteRentalPost", summary: "Calculate a rental deal from JSON", requestBody: { required: true, content: { "application/json": { schema: rental, example: SAMPLE } } }, responses: { "200": { description: "Calculated rental underwriting with visual links", content: jsonContent }, ...errors } },
    },
    "/api/underwriting/multiplex": {
      get: { operationId: "realistUnderwriteMultiplexGet", summary: "Toronto multiplex screen", parameters: queryParameters(multiplex, ["mliCommitments"]), responses: { "200": { description: "Complete screen including schematic concept visuals, or needs_lot_dimensions", content: jsonContent }, "422": { description: "Address could not be resolved in Toronto", content: jsonContent }, ...errors } },
      post: { operationId: "realistUnderwriteMultiplexPost", summary: "Toronto multiplex screen from JSON", requestBody: { required: true, content: { "application/json": { schema: multiplex } } }, responses: { "200": { description: "Site, underwriting, source evidence and schematic concept visuals", content: jsonContent }, "422": { description: "Unresolved or unsupported address", content: jsonContent }, ...errors } },
    },
    ...Object.fromEntries(["chart.png", "chart.svg", "report"].map(path => [`/api/underwriting/${path}`, {
      get: { operationId: `realistUnderwriting${path.replace(/\./g, "_")}`, summary: `Render ${path} from the same rental inputs`, parameters: queryParameters(rental), responses: { "200": { description: "Visual or editable report. Use the absolute link returned by the calculator.", content: { [path === "chart.png" ? "image/png" : path === "chart.svg" ? "image/svg+xml" : "text/html"]: { schema: { type: "string", ...(path !== "report" ? { format: "binary" } : {}) } } } }, ...errors } },
    }])),
    "/api/underwriting/skill": { get: { operationId: "realistReadUnderwritingSkill", summary: "Instructions for an LLM, including a no-setup sample test", responses: { "200": { description: "Instruction document", content: { "text/markdown": { schema: { type: "string" } } } } } } },
  },
  "x-mcp": { url: `${PUBLIC_BASE}/api/underwriting/mcp`, authentication: "none", transport: "streamable-http", tools: ["realist_underwrite_rental", "realist_solve_offer", "realist_compare_scenarios", "realist_underwrite_multiplex"] },
};
