/**
 * Shared plumbing for the agent platform: the per-call context every tool
 * handler receives, the typed error handlers throw, and the public origin used
 * for links handed back to agents.
 *
 * One tool registry (server/agent/tools.ts) is served over three transports —
 * the legacy REST routes (/api/agent/*), the versioned REST surface
 * (/api/v1/tools/:name) and the hosted MCP endpoint (/mcp). Handlers only see
 * this context, never req/res, so the transports cannot drift.
 */
import type { Request } from "express";
import { BRAND_BASE_URL } from "@shared/brand";
import {
  AGENT_API_SCOPES,
  DEFAULT_AGENT_API_SCOPES,
  type AgentApiScope,
} from "@shared/agentSpine";

/** Version of the agent platform surface (MCP serverInfo, OpenAPI info.version). */
export const AGENT_PLATFORM_VERSION = "1.0.0";

export { AGENT_API_SCOPES, DEFAULT_AGENT_API_SCOPES, type AgentApiScope };

/** Which transport the call arrived on — recorded on views and usage events. */
export type AgentChannel = "rest" | "v1" | "mcp";

export interface AgentContext {
  userId: string;
  keyId: string;
  scopes: AgentApiScope[];
  channel: AgentChannel;
  /** The underlying HTTP request, for IP / user-agent attribution only. */
  req?: Request | null;
}

/**
 * A failure the caller can act on. `status` is the HTTP status the REST
 * transports return; `code` is the stable machine-readable error string
 * (kept identical to the pre-registry /api/agent/* error codes).
 */
export class AgentToolError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message || code);
    this.name = "AgentToolError";
  }

  toBody(): Record<string, unknown> {
    const body: Record<string, unknown> = { error: this.code, ...this.extra };
    if (this.message && this.message !== this.code) body.message = this.message;
    return body;
  }
}

/**
 * Public origin for links returned to agents (view URLs, OpenAPI servers[],
 * MCP endpoint docs). Deliberately NOT server/auth.ts#appBaseUrl(), which
 * prefers the Replit dev domain.
 */
export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || BRAND_BASE_URL).replace(/\/$/, "");
}

/** Loopback origin for the few tools that proxy an existing web route. */
export function internalBaseUrl(): string {
  return process.env.AGENT_INTERNAL_BASE_URL || `http://127.0.0.1:${process.env.PORT || 5000}`;
}
