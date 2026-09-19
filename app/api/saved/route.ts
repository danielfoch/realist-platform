import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { savedDeals } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/current";
import { UNAVAILABLE, fail, readJson } from "@/lib/auth/http";
import { crossOriginResponse, isSameOrigin } from "@/lib/auth/origin";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  kind: z.enum(["listing", "multiplex"]),
  refKey: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  // Headline numbers frozen at save time. Bounded so this is never a blob store.
  snapshot: z
    .record(z.string().max(60), z.union([z.string().max(500), z.number(), z.boolean(), z.null()]))
    .refine((value) => Object.keys(value).length <= 24, "too many snapshot fields")
    .optional(),
  note: z.string().trim().max(1000).optional(),
});

const removeSchema = z.object({
  kind: z.enum(["listing", "multiplex", "analysis"]),
  refKey: z.string().trim().min(1).max(200),
});

/** The signed-in member's saved deals, newest first. Signed out → empty list. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ signedIn: false, saved: [] }, { headers: { "Cache-Control": "no-store" } });
  try {
    const saved = await getDb()
      .select()
      .from(savedDeals)
      .where(eq(savedDeals.userId, user.id))
      .orderBy(desc(savedDeals.createdAt))
      .limit(500);
    return Response.json({ signedIn: true, saved }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[saved:get]", (error as Error).message);
    return fail(503, UNAVAILABLE);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) return fail(401, "Sign in to save deals.");
  const parsed = saveSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, "That deal couldn't be saved.");

  try {
    const [row] = await getDb()
      .insert(savedDeals)
      .values({
        userId: user.id,
        kind: parsed.data.kind,
        refKey: parsed.data.refKey,
        title: parsed.data.title,
        snapshot: parsed.data.snapshot ?? null,
        note: parsed.data.note || null,
      })
      // Saving twice is not an error; the latest snapshot wins. A note is only
      // replaced when a new one is sent, never blanked by a plain re-save.
      .onConflictDoUpdate({
        target: [savedDeals.userId, savedDeals.kind, savedDeals.refKey],
        set: {
          title: parsed.data.title,
          snapshot: parsed.data.snapshot ?? null,
          ...(parsed.data.note ? { note: parsed.data.note } : {}),
        },
      })
      .returning();
    return Response.json({ ok: true, saved: row });
  } catch (error) {
    console.error("[saved:post]", (error as Error).message);
    return fail(503, UNAVAILABLE);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return crossOriginResponse();
  const user = await getCurrentUser();
  if (!user) return fail(401, "Sign in to manage saved deals.");
  const parsed = removeSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail(400, "Nothing to remove.");

  try {
    // Scoped to the owner in the WHERE clause — an id alone is never enough.
    await getDb()
      .delete(savedDeals)
      .where(
        and(
          eq(savedDeals.userId, user.id),
          eq(savedDeals.kind, parsed.data.kind),
          eq(savedDeals.refKey, parsed.data.refKey),
        ),
      );
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[saved:delete]", (error as Error).message);
    return fail(503, UNAVAILABLE);
  }
}
