/**
 * OpenAPI 3 document for the Realist Agent API + jobs spine.
 * Served at GET /api/agent/openapi.json (read scope).
 * Human-readable copy: docs/openapi/agent-api.yaml
 */
import {
  AGENT_API_SCOPES,
  AGENT_JOB_STATUSES,
  AGENT_JOB_TYPES,
  SPECIALIST_REGISTRY,
} from "./agentSpine";

const jobTypeEnum = [...AGENT_JOB_TYPES];
const jobStatusEnum = [...AGENT_JOB_STATUSES];
const scopeEnum = [...AGENT_API_SCOPES];

const errorSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
    message: { type: "string" },
    details: { type: "array", items: { type: "object" } },
  },
  required: ["error"],
};

const jobSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    type: { type: "string", enum: jobTypeEnum },
    status: { type: "string", enum: jobStatusEnum },
    input: { type: "object", additionalProperties: true },
    result: { type: "object", nullable: true, additionalProperties: true },
    error: { type: "string", nullable: true },
    specialistId: { type: "string", nullable: true },
    createdByUserId: { type: "string" },
    createdByApiKeyId: { type: "string", nullable: true },
    approvalRequired: { type: "boolean" },
    approvedAt: { type: "string", format: "date-time", nullable: true },
    approvedByUserId: { type: "string", nullable: true },
    idempotencyKey: { type: "string", nullable: true },
    auditTrail: {
      type: "array",
      items: {
        type: "object",
        properties: {
          at: { type: "string" },
          action: { type: "string" },
          actorUserId: { type: "string", nullable: true },
          fromStatus: { type: "string", nullable: true },
          toStatus: { type: "string" },
          note: { type: "string" },
        },
      },
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["id", "type", "status"],
};

export const AGENT_API_OPENAPI = {
  openapi: "3.0.3",
  info: {
    title: "Realist Agent API",
    version: "1.6.0",
    description:
      "Bearer-authenticated API used by @realist/mcp and specialist tools. " +
      "Keys are `realist_live_*`, SHA-256 hashed in `api_keys`. " +
      "P0 spine + P1 Ontario forms + P2 worldwide listing extract " +
      "+ P3 Realist CRM writes + P4 listing-portal browser playbooks " +
      "+ P5 document routing. Realist-only.",
  },
  servers: [{ url: "https://realist.ca", description: "Production" }],
  tags: [
    { name: "Agent", description: "Existing underwrite / search / analyses routes" },
    { name: "Jobs", description: "Specialist job spine" },
    { name: "Forms", description: "Ontario / OREA field maps + fill (maps only, no PDF bodies)" },
    { name: "Listings", description: "Worldwide URL extract + underwrite (Zillow for Earth for AI agents)" },
    { name: "CRM", description: "Realist-owned contacts only. No external CRM." },
    { name: "Browser", description: "Public listing-portal playbooks (cookie banner, expand, gallery, scroll, extract). No login." },
    { name: "Docs", description: "Classify user-supplied deal documents. No blank-form storage." },
    { name: "Schemas", description: "Canonical Realist domain objects" },
  ],
  paths: {
    "/api/agent/me": {
      get: {
        tags: ["Agent"],
        summary: "Verify the key and return the owning user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Key is valid",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    user: { type: "object" },
                    keyId: { type: "string" },
                    scopes: { type: "array", items: { type: "string", enum: scopeEnum } },
                  },
                },
              },
            },
          },
          "401": { description: "Missing or invalid bearer token" },
        },
      },
    },
    "/api/agent/underwrite/listing": {
      post: {
        tags: ["Agent"],
        summary: "Underwrite a CREA-listed property by MLS number",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UnderwriteListingInput" },
            },
          },
        },
        responses: {
          "200": { description: "Underwriting result + saved analysis" },
          "403": { description: "underwrite scope required" },
        },
      },
    },
    "/api/agent/underwrite/custom": {
      post: {
        tags: ["Agent"],
        summary: "Underwrite a custom address with caller-provided price",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UnderwriteCustomInput" },
            },
          },
        },
        responses: { "200": { description: "Underwriting result + saved analysis" } },
      },
    },
    "/api/agent/find-deals": {
      post: {
        tags: ["Agent"],
        summary: "Natural-language deal search over CREA DDF",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["query"],
                properties: {
                  query: { type: "string" },
                  limit: { type: "integer", minimum: 1, maximum: 25 },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Matching listings" } },
      },
    },
    "/api/agent/estimate-rent": {
      post: {
        tags: ["Agent"],
        summary: "Rent estimate from the prediction-ledger engine",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Estimate or no_data_for_market" } },
      },
    },
    "/api/agent/underwrite-multiplex": {
      post: {
        tags: ["Agent"],
        summary: "Multiplex underwriter (same engine as /api/multiplex-underwriter)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Multiplex underwrite result" } },
      },
    },
    "/api/agent/deal-desk-submit": {
      post: {
        tags: ["Agent"],
        summary: "Submit a deal to Deal Desk",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Opportunity created" } },
      },
    },
    "/api/agent/analyses": {
      get: {
        tags: ["Agent"],
        summary: "List the calling user's saved underwritings",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "limit", in: "query", schema: { type: "integer" } }],
        responses: { "200": { description: "Analyses list" } },
      },
    },
    "/api/agent/analyses/{id}": {
      get: {
        tags: ["Agent"],
        summary: "Fetch one analysis the caller owns",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Analysis" }, "404": { description: "Not found" } },
      },
    },
    "/api/agent/community/submit": {
      post: {
        tags: ["Agent"],
        summary: "Submit an underwriting to the community feed",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Published" }, "403": { description: "community:write required" } },
      },
    },
    "/api/agent/mortgage-rates": {
      get: {
        tags: ["Agent"],
        summary: "Current mortgage rates",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Rates payload" } },
      },
    },
    "/api/agent/market-report": {
      get: {
        tags: ["Agent"],
        summary: "City-level market report",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "city", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Report or city list" } },
      },
    },
    "/api/agent/referrals/{outcomeId}": {
      get: {
        tags: ["Agent"],
        summary: "Partner-owned referral outcome",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "outcomeId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Outcome" } },
      },
      post: {
        tags: ["Agent"],
        summary: "Update a partner-owned referral outcome",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "outcomeId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Updated outcome" } },
      },
    },
    "/api/agent/forms": {
      get: {
        tags: ["Forms"],
        summary: "List registered OREA field maps",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Form summaries (no PDF bodies)" } },
      },
    },
    "/api/agent/forms/{formId}": {
      get: {
        tags: ["Forms"],
        summary: "Get one field map",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "formId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Field map metadata" }, "404": { description: "Unknown form id" } },
      },
    },
    "/api/agent/forms/fill": {
      post: {
        tags: ["Forms"],
        summary: "Create a forms.fill job (always needs_approval)",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Draft fill job" }, "403": { description: "forms:write or jobs:write required" } },
      },
    },
    "/api/agent/listings/extractors": {
      get: {
        tags: ["Listings"],
        summary: "List registered listing URL extractors (major portals worldwide)",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Extractor registry: realtor.ca, Zillow, Redfin, Realtor.com, Homes.com, Rightmove, Zoopla, Domain, realestate.com.au, ImmoScout, SeLoger, Idealista, PropertyGuru, plus generic JSON-LD/OG" } },
      },
    },
    "/api/agent/listings/extract": {
      post: {
        tags: ["Listings"],
        summary: "Extract Property + Listing from a public URL, HTML, or MLS number",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "listing.extract job + extract payload" } },
      },
    },
    "/api/agent/crm/contacts": {
      get: {
        tags: ["CRM"],
        summary: "Search the calling user's Realist CRM contacts",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "query", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Owned contacts" } },
      },
    },
    "/api/agent/crm/contacts/upsert": {
      post: {
        tags: ["CRM"],
        summary: "Create a crm.update upsert job (needs_approval + proposed diff)",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Draft CRM write job" }, "403": { description: "crm:write or jobs:write required" } },
      },
    },
    "/api/agent/crm/contacts/{id}": {
      get: {
        tags: ["CRM"],
        summary: "Get one owned Realist CRM contact",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Contact" }, "404": { description: "Not found" } },
      },
    },
    "/api/agent/listings/underwrite-url": {
      post: {
        tags: ["Listings"],
        summary: "Extract a listing URL then underwrite in listing currency",
        security: [{ bearerAuth: [] }],
        responses: { "201": { description: "Extract + underwrite jobs" } },
      },
    },
    "/api/agent/docs/classes": {
      get: {
        tags: ["Docs"],
        summary: "List document classes and closing-checklist maps",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Doc class enum + stage checklists" } },
      },
    },
    "/api/agent/docs/route": {
      post: {
        tags: ["Docs"],
        summary: "Create a docs.route job (needs_approval before attachment metadata persist)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DocsRouteInput" },
            },
          },
        },
        responses: {
          "201": { description: "docs.route job + proposed classification" },
          "403": { description: "docs:write or jobs:write required" },
        },
      },
    },
    "/api/agent/browser/playbooks": {
      get: {
        tags: ["Browser"],
        summary: "List host → allowed public listing-portal actions",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Playbook registry" } },
      },
    },
    "/api/agent/browser/act": {
      post: {
        tags: ["Browser"],
        summary: "Create a browser.act job. Clicks need_approval; extract_after_render may run immediately.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/BrowserActInput" },
            },
          },
        },
        responses: {
          "201": { description: "browser.act job" },
          "403": { description: "browser:write or jobs:write required" },
        },
      },
    },
    "/api/agent/openapi.json": {
      get: {
        tags: ["Agent"],
        summary: "This OpenAPI document",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "OpenAPI 3 JSON" } },
      },
    },
    "/api/agent/jobs": {
      get: {
        tags: ["Jobs"],
        summary: "List the calling user's jobs",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } }],
        responses: {
          "200": {
            description: "Caller's jobs",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    count: { type: "integer" },
                    jobs: { type: "array", items: { $ref: "#/components/schemas/AgentJob" } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Jobs"],
        summary: "Create a specialist job (idempotent on idempotencyKey)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateAgentJobRequest" },
            },
          },
        },
        responses: {
          "201": { description: "Job created (and maybe executed)" },
          "200": { description: "Idempotent replay of an existing job" },
          "400": { description: "Invalid input" },
          "403": { description: "Scope required for this job type" },
        },
      },
    },
    "/api/agent/jobs/{id}": {
      get: {
        tags: ["Jobs"],
        summary: "Get one job the caller owns",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            description: "Job",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { job: { $ref: "#/components/schemas/AgentJob" } },
                },
              },
            },
          },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/agent/jobs/{id}/approve": {
      post: {
        tags: ["Jobs"],
        summary: "Approve a job in needs_approval, then run the specialist",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Approved and executed" },
          "409": { description: "Job is not awaiting approval" },
        },
      },
    },
    "/api/agent/jobs/{id}/cancel": {
      post: {
        tags: ["Jobs"],
        summary: "Cancel a queued, running, or needs_approval job",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Cancelled" },
          "409": { description: "Job is not cancellable" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "realist_live_*",
        description: "API keys minted at /account/api-keys. Stored as SHA-256 hashes; plaintext returned once.",
      },
    },
    schemas: {
      Error: errorSchema,
      AgentJob: jobSchema,
      Property: {
        type: "object",
        required: ["address"],
        properties: {
          id: { type: "string" },
          address: { type: "string" },
          city: { type: "string", nullable: true },
          province: { type: "string", nullable: true },
          country: { type: "string", description: "ISO 3166-1 alpha-2", default: "CA" },
          state: { type: "string", nullable: true },
          region: { type: "string", nullable: true },
          postalCode: { type: "string", nullable: true },
          zip: { type: "string", nullable: true },
          parcelId: { type: "string", nullable: true },
          areaSqft: { type: "number", nullable: true },
          areaSqm: { type: "number", nullable: true },
          areaUnit: { type: "string", enum: ["sqft", "sqm"], nullable: true },
          geo: {
            type: "object",
            properties: { lat: { type: "number" }, lng: { type: "number" } },
          },
          beds: { type: "integer", nullable: true },
          baths: { type: "number", nullable: true },
          units: { type: "integer", nullable: true },
          annualPropertyTax: { type: "number", nullable: true },
        },
      },
      Listing: {
        type: "object",
        properties: {
          mlsNumber: { type: "string", nullable: true, description: "Optional outside CREA DDF" },
          status: { type: "string" },
          listPrice: { type: "number", nullable: true },
          currency: { type: "string", description: "ISO 4217. Metrics stay in this currency unless fxToCad is supplied." },
          property: { $ref: "#/components/schemas/Property" },
          daysOnMarket: { type: "integer", nullable: true },
          source: { type: "string" },
          sourceUrl: { type: "string" },
          sourceHost: { type: "string" },
          externalId: { type: "string" },
        },
      },
      Deal: {
        type: "object",
        properties: {
          id: { type: "string" },
          analysisId: { type: "string", nullable: true },
          mlsNumber: { type: "string", nullable: true },
          property: { $ref: "#/components/schemas/Property" },
          strategy: { type: "string" },
          assumptions: { type: "object" },
          metrics: { type: "object" },
        },
      },
      Contact: {
        type: "object",
        required: ["email"],
        properties: {
          id: { type: "string" },
          userId: { type: "string", nullable: true },
          email: { type: "string", format: "email" },
          name: { type: "string", nullable: true },
          firstName: { type: "string", nullable: true },
          lastName: { type: "string", nullable: true },
          phone: { type: "string", nullable: true },
        },
      },
      TransactionFile: {
        type: "object",
        required: ["id", "dealId", "docClass"],
        properties: {
          id: { type: "string" },
          dealId: { type: "string" },
          docClass: { type: "string" },
          status: { type: "string" },
        },
      },
      AgentOrg: {
        type: "object",
        required: ["id", "userId"],
        properties: {
          id: { type: "string" },
          userId: { type: "string" },
          name: { type: "string", nullable: true },
        },
      },
      UnderwriteListingInput: {
        type: "object",
        required: ["mlsNumber"],
        properties: {
          mlsNumber: { type: "string" },
          strategyType: { type: "string", default: "buyHold" },
          monthlyRent: { type: "number" },
          downPaymentPercent: { type: "number" },
          interestRate: { type: "number" },
          vacancyRate: { type: "number" },
          expenseRatio: { type: "number" },
        },
      },
      UnderwriteCustomInput: {
        type: "object",
        required: ["address", "price"],
        properties: {
          address: { type: "string" },
          city: { type: "string" },
          province: { type: "string" },
          countryMode: { type: "string", description: "ISO 3166-1 alpha-2", default: "CA" },
          strategyType: { type: "string", default: "buyHold" },
          price: { type: "number" },
          currency: { type: "string", description: "ISO 4217. Defaults to CAD for existing callers." },
          fxToCad: { type: "number", description: "Optional caller-supplied FX. Never invented." },
          monthlyRent: { type: "number" },
          units: { type: "integer" },
          beds: { type: "integer" },
          downPaymentPercent: { type: "number" },
          interestRate: { type: "number" },
          vacancyRate: { type: "number" },
          expenseRatio: { type: "number" },
        },
      },
      DocsRouteInput: {
        type: "object",
        properties: {
          filename: { type: "string" },
          mimeType: { type: "string" },
          textContent: { type: "string", description: "Extracted text. Required for high confidence. OCR is not in v1." },
          base64: { type: "string", description: "Size-capped bytes. Not OCR'd in v1." },
          dealId: { type: "string" },
          analysisId: { type: "string" },
          mlsNumber: { type: "string" },
          documentId: { type: "string" },
          docClass: { type: "string", description: "Optional caller hint. Never invents parties, prices, or dates." },
          hints: { type: "object", additionalProperties: true },
        },
      },
      BrowserActInput: {
        type: "object",
        required: ["url"],
        properties: {
          url: { type: "string", format: "uri", description: "Public listing URL. Login/checkout/WEBForms URLs are rejected." },
          actions: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "dismiss_cookie_banner",
                "expand_description",
                "open_listing_gallery",
                "scroll_to_load",
                "extract_after_render",
              ],
            },
            description: "Playbook actions. Defaults to extract_after_render.",
          },
          maxSteps: { type: "integer", minimum: 1, maximum: 20 },
          timeoutMs: { type: "integer", minimum: 1000, maximum: 60000 },
          idempotencyKey: { type: "string" },
        },
      },
      ListingExtractInput: {
        type: "object",
        properties: {
          url: { type: "string", format: "uri" },
          html: { type: "string", description: "Caller-supplied public HTML (offline / already-fetched)" },
          rawText: { type: "string" },
          mlsNumber: { type: "string", description: "CREA DDF fast path when configured" },
          country: { type: "string", description: "ISO 3166-1 alpha-2 hint" },
          currency: { type: "string", description: "ISO 4217 hint" },
        },
        description: "Provide at least one of url, html, rawText, or mlsNumber.",
      },
      CreateAgentJobRequest: {
        type: "object",
        required: ["type"],
        properties: {
          type: { type: "string", enum: jobTypeEnum },
          input: { type: "object", additionalProperties: true },
          idempotencyKey: { type: "string" },
          approvalRequired: { type: "boolean" },
        },
      },
      SpecialistRegistry: {
        type: "object",
        additionalProperties: true,
        description: "Job type → specialist metadata",
        example: SPECIALIST_REGISTRY,
      },
    },
  },
} as const;
