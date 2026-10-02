import { multiplexRoute } from "@/lib/public-underwriting/multiplex";
import { options } from "@/lib/public-underwriting/http";
export const runtime = "nodejs";
export const maxDuration = 120;
export const GET = multiplexRoute;
export const POST = multiplexRoute;
export const OPTIONS = options;
