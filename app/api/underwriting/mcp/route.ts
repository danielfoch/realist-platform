import { mcpPost, mcpGet } from "@/lib/public-underwriting/mcp";
import { options } from "@/lib/public-underwriting/http";
export const runtime = "nodejs";
export const maxDuration = 120;
export const GET = mcpGet;
export const POST = mcpPost;
export const OPTIONS = options;
