/**
 * Thin HTTP client for the Realist agent API. Shared by the MCP server and CLI.
 */

const DEFAULT_BASE_URL = "https://realist.ca";
const USER_AGENT = "@realist/mcp/0.1.0";

export class RealistApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "RealistApiError";
  }
}

export interface RealistClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export class RealistClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(opts: RealistClientOptions) {
    if (!opts.apiKey) throw new Error("REALIST_API_KEY is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  private async request<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url.toString(), {
      method,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* keep as text */ }
    if (!res.ok) {
      const msg = (parsed as any)?.error || (parsed as any)?.message || `HTTP ${res.status}`;
      throw new RealistApiError(res.status, parsed, msg);
    }
    return parsed as T;
  }

  me() {
    return this.request<{ ok: boolean; user: { id: string; email?: string } }>("GET", "/api/agent/me");
  }

  underwriteListing(input: {
    mlsNumber: string;
    strategyType?: string;
    monthlyRent?: number;
    downPaymentPercent?: number;
    interestRate?: number;
    vacancyRate?: number;
    expenseRatio?: number;
  }) {
    return this.request<any>("POST", "/api/agent/underwrite/listing", input);
  }

  underwriteCustom(input: {
    address: string;
    price: number;
    city?: string;
    province?: string;
    countryMode?: "CA" | "US";
    strategyType?: string;
    monthlyRent?: number;
    units?: number;
    beds?: number;
    downPaymentPercent?: number;
    interestRate?: number;
    vacancyRate?: number;
    expenseRatio?: number;
  }) {
    return this.request<any>("POST", "/api/agent/underwrite/custom", input);
  }

  findDeals(input: { query: string; limit?: number }) {
    return this.request<any>("POST", "/api/agent/find-deals", input);
  }

  listAnalyses(limit = 25) {
    return this.request<any>("GET", "/api/agent/analyses", undefined, { limit });
  }

  getAnalysis(id: string) {
    return this.request<any>("GET", `/api/agent/analyses/${encodeURIComponent(id)}`);
  }

  submitForReview(input: {
    mlsNumber: string;
    analysisId?: string;
    title?: string;
    summary?: string;
    notes?: string;
    visibility?: "public" | "private";
    metrics?: Record<string, unknown>;
    assumptions?: Record<string, unknown>;
    city?: string;
    province?: string;
    propertyType?: string;
    market?: string;
  }) {
    return this.request<any>("POST", "/api/agent/community/submit", input);
  }

  mortgageRates() {
    return this.request<any>("GET", "/api/agent/mortgage-rates");
  }

  marketReport(city?: string) {
    return this.request<any>("GET", "/api/agent/market-report", undefined, city ? { city } : undefined);
  }
}
