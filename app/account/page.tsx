import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getActorStats, type ActorStats } from "@/lib/analyses/community";
import { badgeProgress } from "@/lib/analyses/profile";
import { listAnalyses } from "@/lib/analyses/store";
import { getCurrentUser } from "@/lib/auth/current";
import { getDb } from "@/lib/db";
import { savedDeals, type DealAnalysis, type SavedDeal } from "@/lib/db/schema";
import { emailConfigured } from "@/lib/email";
import { AnalysesList, TrackRecordBlock } from "@/components/auth/MyTrackRecord";
import { PasswordForm } from "@/components/auth/PasswordForm";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { SavedDealsList, type SavedDealItem } from "@/components/auth/SavedDealsList";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { eyebrowClass, formatDay } from "@/components/auth/shared";
import { TeamChecklist } from "@/components/team/TeamChecklist";
import { ConfirmEmailNotice } from "@/components/auth/ConfirmEmailNotice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your account",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false },
};

async function loadSavedDeals(userId: string): Promise<SavedDeal[]> {
  try {
    return await getDb()
      .select()
      .from(savedDeals)
      .where(eq(savedDeals.userId, userId))
      .orderBy(desc(savedDeals.createdAt))
      .limit(500);
  } catch (error) {
    console.error("[account] loading saved deals failed:", (error as Error).message);
    return [];
  }
}

/** The member's numbers and their analysis log. Trouble reads as an empty record, never an error page. */
async function loadTrackRecord(userId: string): Promise<{ stats: ActorStats; analyses: DealAnalysis[] }> {
  const actorKey = `user:${userId}`;
  try {
    const [stats, analyses] = await Promise.all([getActorStats(actorKey), listAnalyses(actorKey, 50)]);
    return { stats, analyses };
  } catch (error) {
    console.error("[account] loading the track record failed:", (error as Error).message);
    return { stats: { deals: 0, thisWeek: 0, streakWeeks: 0, score: 0 }, analyses: [] };
  }
}

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="font-display text-xl font-semibold tracking-tight">
      {children}
    </h2>
  );
}

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const [saved, record] = await Promise.all([loadSavedDeals(user.id), loadTrackRecord(user.id)]);
  const items: SavedDealItem[] = saved.map((row) => ({
    id: row.id,
    kind: row.kind,
    refKey: row.refKey,
    title: row.title,
    snapshot: row.snapshot ?? null,
    note: row.note,
    createdAt: new Date(row.createdAt).toISOString(),
  }));
  const memberSince = formatDay(user.createdAt);

  return (
    <>
      <section className="border-b border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
          <p className={`${eyebrowClass} text-brand`}>Your account</p>
          <h1 className="font-display mt-2 break-words text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
            {user.name?.trim() || user.email}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {user.name?.trim() && <>{user.email} · </>}
            {memberSince && <>Member since {memberSince}</>}
          </p>
        </div>
      </section>

      {!user.emailVerifiedAt && !user.legacy && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
          <ConfirmEmailNotice email={user.email} canSend={emailConfigured()} />
        </div>
      )}

      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[1.35fr_1fr] lg:gap-14 lg:py-14">
        <div className="min-w-0 space-y-12">
          <section aria-labelledby="account-track-record">
            <SectionHeading id="account-track-record">Track record</SectionHeading>
            <p className="mt-1.5 text-sm text-ink-soft">
              Every deal you underwrite counts once. The more of it you work, the more it scores.
            </p>
            <div className="mt-6">
              <TrackRecordBlock
                stats={record.stats}
                badge={badgeProgress(record.stats.deals)}
                profilePath={user.showOnLeaderboard && record.stats.deals > 0 ? `/u/${encodeURIComponent(user.id)}` : null}
              />
            </div>
          </section>

          <section aria-labelledby="account-analyses">
            <SectionHeading id="account-analyses">Your analyses</SectionHeading>
            <p className="mt-1.5 text-sm text-ink-soft">
              Your latest numbers on each deal. Open one to pick it back up.
            </p>
            <div className="mt-6">
              <AnalysesList analyses={record.analyses} />
            </div>
          </section>

          <section aria-labelledby="account-saved">
            <SectionHeading id="account-saved">Saved deals</SectionHeading>
            <p className="mt-1.5 text-sm text-ink-soft">
              Each one keeps the numbers from the day you saved it.
            </p>
            <div className="mt-6">
              <SavedDealsList initial={items} />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="account-profile" className="rounded-lg border border-hairline bg-surface p-6">
            <SectionHeading id="account-profile">Profile</SectionHeading>
            <p className="mt-1.5 text-sm text-ink-soft">
              Tell us where and what you buy, and we&rsquo;ll point you at the right meetups and deals.
            </p>
            <div className="mt-5">
              <ProfileForm
                email={user.email}
                initial={{
                  name: user.name ?? "",
                  phone: user.phone ?? "",
                  city: user.city ?? "",
                  province: user.province ?? "",
                  investorFocus: user.investorFocus ?? "",
                  consentMarketing: user.consentMarketing,
                  showOnLeaderboard: user.showOnLeaderboard,
                }}
              />
            </div>
          </section>

          <section aria-labelledby="account-team" className="rounded-lg border border-hairline bg-surface p-6">
            <SectionHeading id="account-team">Your power team</SectionHeading>
            <p className="mt-1.5 text-sm text-ink-soft">
              The nine people around a deal. Mark who you have; we&rsquo;ll introduce you to the rest.
            </p>
            <div className="mt-5">
              <TeamChecklist initial={user.powerTeam ?? {}} city={user.city} province={user.province} />
            </div>
          </section>

          <section aria-labelledby="account-password" className="rounded-lg border border-hairline bg-surface p-6">
            <SectionHeading id="account-password">Password</SectionHeading>
            <div className="mt-4">
              <PasswordForm hasPassword={Boolean(user.passwordHash)} emailLinkAvailable={emailConfigured()} />
            </div>
          </section>

          <SignOutButton />
        </div>
      </div>
    </>
  );
}
