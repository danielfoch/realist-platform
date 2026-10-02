const nullable = (type: string) => ({ type: [type, "null"] });
const source = { type: ["object", "null"], properties: Object.fromEntries(["id", "name", "url", "licence", "attribution"].map(k => [k, { type: "string" }])), required: ["id", "name", "url", "licence", "attribution"] };
const layer = { type: "object", required: ["status", "data", "source", "retrievedAt", "sourceUpdatedAt", "note"], properties: { status: { type: "string", enum: ["available", "no_match", "not_supported", "not_loaded", "unavailable", "ambiguous", "skipped"] }, data: {}, source, retrievedAt: nullable("string"), sourceUpdatedAt: nullable("string"), importedAt: nullable("string"), note: nullable("string"), truncated: { type: "boolean" } } };
const layers = ["location", "assessment", "permits", "variance", "neighbourhood", "parcel", "ward", "zoning", "development"];
export const PROPERTY_OPENAPI = {
  openapi: "3.1.0", info: { title: "Homies property enrichment", version: "1.0.0", description: "Anonymous Canadian civic-address enrichment backed by municipal open data and available Realist imports. Unknown fields remain null; every layer carries availability and attribution." },
  servers: [{ url: "https://realist-lean.vercel.app" }], security: [],
  paths: {
    "/api/property": { get: { operationId: "enrichProperty", summary: "Enrich one Canadian property", description: "Supply a civic address including municipality/province, or lat and lng. Optional separate city/province. With no parameters returns usage instructions. Unit-specific matching and batch lookup are not supported. Only status=available layers establish published facts.", parameters: [
      ...["address", "city", "province"].map(name => ({ name, in: "query", required: false, schema: { type: "string", maxLength: name === "address" ? 240 : name === "city" ? 80 : 40 }, ...(name === "address" ? { example: "15 Deermeade Pl SE, Calgary, AB" } : {}) })),
      { name: "lat", in: "query", schema: { type: "number", minimum: 41, maximum: 84 }, description: "Verified property latitude; supply lng too." },
      { name: "lng", in: "query", schema: { type: "number", minimum: -142, maximum: -52 }, description: "Verified property longitude; supply lat too." },
    ], responses: {
      "200": { description: "Property result, including partial/no_data results, or usage instructions when no parameters are given", content: { "application/json": { schema: { oneOf: [{ $ref: "#/components/schemas/PropertyResult" }, { type: "object", required: ["name", "instructions"], additionalProperties: true }] } } } },
      "400": { description: "Invalid, duplicate or unknown query parameters" }, "422": { description: "Unit-specific address unsupported" }, "429": { description: "Limit reached or limiter unavailable; retry after 60 seconds", headers: { "Retry-After": { schema: { type: "integer" }, description: "Seconds before retry" } } }, "503": { description: "Lookup temporarily unavailable" },
    } } },
    "/api/property/coverage": { get: { operationId: "propertyCoverage", summary: "Inspect live adapters and imported-source registry", responses: { "200": { description: "Configured coverage with database reachability and imported-source freshness; not proof of source uptime or a matching property" } } } },
    "/api/property/skill": { get: { operationId: "propertySkill", summary: "Read the ready-to-use Homies skill", responses: { "200": { description: "SKILL.md instructions", content: { "text/markdown": { schema: { type: "string" } } } } } } },
  },
  components: { schemas: {
    Layer: layer,
    Assessment: { type: ["object", "null"], description: "Only fields published by a matching source. CAD and m². Assessed value is not a market-value estimate.", properties: { address: { type: "string" }, city: { type: "string" }, rollNumber: nullable("string"), ...Object.fromEntries(["rollYear", "assessedValue", "landValue", "buildingValue", "yearBuilt", "floorAreaM2", "lotAreaM2", "frontageM", "dwellingUnits", "bedrooms", "bathrooms"].map(k => [k, nullable("number")])), landUse: nullable("string"), currency: { const: "CAD" }, valuationKind: { const: "municipal_assessment" }, marketValueEstimate: { type: "null" } } },
    PropertyResult: { type: "object", required: ["success", "apiVersion", "country", "status", "data", "layers", "available", "missing"], properties: {
      success: { const: true }, apiVersion: { const: "1.0" }, country: { const: "CA" }, query: { type: "object" }, status: { enum: ["partial", "no_data"] },
      data: { type: "object", properties: { address: nullable("string"), city: nullable("string"), province: nullable("string"), latitude: nullable("number"), longitude: nullable("number"), assessment: { $ref: "#/components/schemas/Assessment" }, ...Object.fromEntries(layers.filter(n => !["location", "assessment"].includes(n)).map(n => [n, {}])) } },
      layers: { type: "object", properties: Object.fromEntries(layers.map(n => [n, { $ref: "#/components/schemas/Layer" }])) }, available: { type: "array", items: { type: "string" } }, missing: { type: "array", items: { type: "object", properties: { layer: { type: "string" }, status: { type: "string" } } } }, notes: { type: "array", items: { type: "string" } },
    } },
  } },
};
