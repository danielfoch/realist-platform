import { z } from "zod";
import { COMMUNITY_LEAD_SOURCES, communityLeads } from "@/lib/db/schema";

/**
 * POST /api/community/join — one endpoint for every community hand-raise:
 * event-invite signups (/community), offer-funnel leads (/work-with-us), and
 * event RSVPs. The `source` allowlist is the routing key for the lead queue.
 */

const joinRequestSchema = z.object({
  email: z.email().max(254),
  name: z.string().trim().max(200).optional(),
  city: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
  propertyInterest: z.string().trim().max(500).optional(),
  source: z.enum(COMMUNITY_LEAD_SOURCES).default("meetup_rsvp"),
  consentMarketing: z.boolean().default(false),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const parsed = joinRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "Please check the form — a valid email is required." },
      { status: 400 },
    );
  }

  try {
    // Imported inside the handler so the route module loads (and the rest of
    // the site builds) without DATABASE_URL.
    const { getDb } = await import("@/lib/db");
    const lead = parsed.data;
    await getDb()
      .insert(communityLeads)
      .values({
        email: lead.email.toLowerCase(),
        name: lead.name || null,
        city: lead.city || null,
        message: lead.message || null,
        propertyInterest: lead.propertyInterest || null,
        source: lead.source,
        consentMarketing: lead.consentMarketing,
      });
  } catch {
    return Response.json(
      {
        ok: false,
        error:
          "We couldn't save your details right now. Please try again in a minute — or just email us.",
      },
      { status: 503 },
    );
  }

  return Response.json({ ok: true });
}
