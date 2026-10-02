import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { unauthorizedCron } from "@/lib/cron";
import { DATASETS, ensureSnapshotTables, refreshSnapshot } from "@/lib/property/snapshots";
import { fetchSnapshot, parallelMap } from "@/lib/property/refresh";
export const runtime = "nodejs";
export const maxDuration = 300;
async function run() {
  try {
    await ensureSnapshotTables();
    const results = await parallelMap([...DATASETS], 2, key => refreshSnapshot(key, () => fetchSnapshot(key)));
    return Response.json({ success: results.every(r => ["succeeded", "already_running"].includes(r.status)), results }, { status: results.some(r => r.status === "failed" || r.status === "lease_lost") ? 502 : 200, headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ success: false, error: "refresh_database_unavailable" }, { status: 503 }); }
}
export async function GET(request: NextRequest) { const denied = unauthorizedCron(request); return denied ?? run(); }
// A dedicated, narrowly scoped operator token permits initial refresh verification without retrieving CRON_SECRET.
export async function POST(request: Request) {
  const secret = process.env.PROPERTY_REFRESH_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const candidate = Buffer.from(supplied), required = Buffer.from(expected);
  if (!secret || candidate.length !== required.length || !timingSafeEqual(candidate, required)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return run();
}
