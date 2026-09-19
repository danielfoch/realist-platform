import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { dealsForBox, getBuyBox } from "@/lib/analyses/buyBox";
import { badgeFor, getActorStats } from "@/lib/analyses/community";
import { listingStreetLine } from "@/components/listings/listingDisplay";
import { nextMeetupFor } from "@/lib/community/nextMeetup";
import { unauthorizedCron } from "@/lib/cron";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { digestRecipients, getLastWeekBoard } from "@/lib/digest/data";
import { unsubscribeOneClickUrl, unsubscribePageUrl } from "@/lib/digest/unsubscribe";
import { composeWeeklyDigest } from "@/lib/digest/weekly";
import { emailConfigured, sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH = 150;
/** How many past suggestions a member's record keeps — a year of Mondays at three a week. */
const SUGGESTION_MEMORY = 150;

/**
 * Monday morning: the weekly digest. OFF unless WEEKLY_DIGEST_ENABLED=1, and it
 * will not send without a sending key, a postal address (CASL) and a secret to
 * sign unsubscribe links with. Re-runnable: each member is stamped as sent, so
 * a second run the same week sends nothing twice. Counts only in the response.
 */
export async function GET(request: NextRequest) {
  const denied = unauthorizedCron(request);
  if (denied) return denied;

  const postalAddress = process.env.EMAIL_POSTAL_ADDRESS?.trim() ?? "";
  if (process.env.WEEKLY_DIGEST_ENABLED !== "1") return NextResponse.json({ ok: true, sent: 0, reason: "disabled" });
  if (!emailConfigured() || !postalAddress) return NextResponse.json({ ok: true, sent: 0, reason: "email or postal address not configured" });

  try {
    const [board, recipients] = await Promise.all([getLastWeekBoard(), digestRecipients(BATCH)]);
    let sent = 0;
    let failed = 0;
    for (const member of recipients) {
      const unsubscribeUrl = unsubscribePageUrl(member.id);
      const oneClick = unsubscribeOneClickUrl(member.id);
      if (!unsubscribeUrl || !oneClick) return NextResponse.json({ ok: false, error: "no secret to sign unsubscribe links" }, { status: 503 });

      const place = board.find((row) => row.userId === member.id) ?? null;
      const ahead = place && place.rank > 1 ? board[place.rank - 2] : null;
      const stats = await getActorStats(`user:${member.id}`);
      const meetup = await nextMeetupFor(member.city);
      const box = await getBuyBox(member.id).catch(() => null);
      // Never the same suggestion twice: what earlier notes carried is left out of this one.
      const alreadySent = Array.isArray(member.digestListings) ? member.digestListings : [];
      const fits = (box ? await dealsForBox(member.id, box, 3, alreadySent).catch(() => []) : []).filter((listing) => listing.listOfficeName);
      const email = composeWeeklyDigest({
        firstName: member.name?.trim().split(/\s+/)[0] ?? null,
        stats,
        lastWeekDeals: place?.deals ?? 0,
        lastWeekRank: place?.rank ?? null,
        ahead: ahead ? { name: ahead.name, deals: ahead.deals } : null,
        board,
        badge: badgeFor(stats.deals),
        meetup: meetup
          ? {
              title: meetup.title,
              when: new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: meetup.timezone ?? "America/Toronto" }).format(new Date(meetup.startsAt)),
            }
          : null,
        // A listing without its brokerage is never shown — not on the site, not in an email.
        fits: fits.map((listing) => ({
          street: listingStreetLine(listing.address) || `MLS® ${listing.mlsNumber}`,
          city: listing.address.city,
          price: listing.listPrice,
          netYield: listing.underwrite?.netYield ?? null,
          url: `/listings/${encodeURIComponent(listing.mlsNumber)}`,
          brokerage: listing.listOfficeName as string,
        })),
        unsubscribeUrl,
        postalAddress,
      });
      try {
        await sendEmail({
          to: member.email,
          ...email,
          headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        });
        await getDb()
          .update(users)
          .set({ lastDigestAt: new Date(), digestListings: [...alreadySent, ...fits.map((listing) => listing.mlsNumber)].slice(-SUGGESTION_MEMORY) })
          .where(eq(users.id, member.id));
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error("[cron/digest] send failed:", (error as Error).message);
      }
    }
    return NextResponse.json({ ok: true, sent, failed, remaining: recipients.length === BATCH });
  } catch (error) {
    console.error("[cron/digest]", (error as Error).message);
    return NextResponse.json({ ok: false, error: "digest unavailable" }, { status: 503 });
  }
}
