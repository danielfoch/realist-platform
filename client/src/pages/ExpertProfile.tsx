import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Award, FileText, Building2, MapPin, ChevronUp, Globe, Linkedin, Instagram, Mail, Phone } from "lucide-react";
import { format } from "date-fns";
import { track } from "@/lib/analytics";
import { EXPERT_CATEGORY_LABELS, isExpertCategory } from "@shared/contributorReputation";

interface ExpertProfileData {
  userId: string;
  name: string;
  category: string;
  companyName: string | null;
  bio: string | null;
  headshotUrl: string | null;
  serviceAreas: string[];
  socialLinks: { website?: string; linkedin?: string; instagram?: string } | null;
  publicEmail: string | null;
  phone: string | null;
  points: number;
  rank: {
    tier: { label: string };
    nextTier: { label: string } | null;
    pointsToNext: number | null;
    progressPct: number;
  };
  stats: { fieldNotes: number; dealsContributed: number };
  fieldNotes: { id: string; listingMlsNumber: string; category: string; body: string; score: number; createdAt: string }[];
}

function catLabel(category: string): string {
  return isExpertCategory(category) ? EXPERT_CATEGORY_LABELS[category] : "Industry Expert";
}

/**
 * The professional's outbound business links — this is how a contributor
 * turns field-note reputation into traffic to their own business. Links are
 * nofollow (we're not vouching for the destination) and click-tracked so the
 * contributor can see the referrals their notes earned.
 */
function ProfileLinks({ expert }: { expert: ExpertProfileData }) {
  const links = expert.socialLinks || {};
  const items: { key: string; href: string; label: string; icon: typeof Globe }[] = [];
  if (links.website) items.push({ key: "website", href: links.website, label: "Website", icon: Globe });
  if (links.linkedin) items.push({ key: "linkedin", href: links.linkedin, label: "LinkedIn", icon: Linkedin });
  if (links.instagram) items.push({ key: "instagram", href: links.instagram, label: "Instagram", icon: Instagram });
  if (expert.publicEmail) items.push({ key: "email", href: `mailto:${expert.publicEmail}`, label: "Email", icon: Mail });
  if (expert.phone) items.push({ key: "phone", href: `tel:${expert.phone.replace(/[^\d+]/g, "")}`, label: "Call", icon: Phone });
  if (items.length === 0) return null;

  const isExternal = (href: string) => href.startsWith("http");
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map(({ key, href, label, icon: Icon }) => (
        <a
          key={key}
          href={href}
          {...(isExternal(href) ? { target: "_blank", rel: "nofollow noopener noreferrer" } : {})}
          onClick={() =>
            track({ event: "cta_clicked", cta: `expert_link_${key}`, location: "expert_profile", destination: href })
          }
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          data-testid={`link-expert-${key}`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </a>
      ))}
    </div>
  );
}

export default function ExpertProfile() {
  const [, params] = useRoute("/experts/:userId");
  const userId = params?.userId || "";

  const { data: expert, isLoading, error } = useQuery<ExpertProfileData>({
    queryKey: [`/api/experts/${userId}`],
    enabled: !!userId,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-16 text-muted-foreground">Loading expert…</main>
      </div>
    );
  }

  if (error || !expert) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-16">
          <h1 className="text-3xl font-bold">Expert not found</h1>
          <p className="mt-2 text-muted-foreground">This profile is unavailable or not public.</p>
          <Link href="/experts" className="mt-4 inline-block text-primary underline">Back to the expert network</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <SEO
        title={`${expert.name} — ${catLabel(expert.category)} on Realist`}
        description={expert.bio || `${expert.name}, ${catLabel(expert.category)}${expert.companyName ? ` at ${expert.companyName}` : ""}, contributes expert field notes to real estate deals on Realist.`}
        canonicalUrl={`/experts/${expert.userId}`}
      />

      <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
        <div className="flex items-start gap-5 flex-wrap">
          <Avatar className="h-20 w-20">
            {expert.headshotUrl && <AvatarImage src={expert.headshotUrl} alt={expert.name} />}
            <AvatarFallback className="text-xl">{expert.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-bold" data-testid="text-expert-name">{expert.name}</h1>
              <Badge variant="secondary">{catLabel(expert.category)}</Badge>
            </div>
            {expert.companyName && (
              <p className="mt-1 flex items-center gap-1 text-muted-foreground">
                <Building2 className="h-4 w-4" />{expert.companyName}
              </p>
            )}
            {expert.serviceAreas.length > 0 && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />{expert.serviceAreas.join(", ")}
              </p>
            )}
            {expert.bio && <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{expert.bio}</p>}
            <ProfileLinks expert={expert} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 text-primary">
                <Award className="h-5 w-5" />
                <span className="text-lg font-bold" data-testid="text-rank-tier">{expert.rank.tier.label}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{expert.points} reputation points</p>
              {expert.rank.nextTier && (
                <div className="mt-3">
                  <Progress value={expert.rank.progressPct} className="h-2" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {expert.rank.pointsToNext} pts to {expert.rank.nextTier.label}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-2xl font-bold">{expert.stats.fieldNotes}</p>
              <p className="text-sm text-muted-foreground">field notes contributed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-2xl font-bold">{expert.stats.dealsContributed}</p>
              <p className="text-sm text-muted-foreground">deals contributed to</p>
            </CardContent>
          </Card>
        </div>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-2xl font-bold">
            <FileText className="h-5 w-5" />
            Field notes
          </h2>
          {expert.fieldNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No field notes yet.</p>
          ) : (
            <div className="space-y-3">
              {expert.fieldNotes.map((note) => (
                <Card key={note.id} data-testid={`profile-note-${note.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="text-[10px]">{catLabel(note.category)}</Badge>
                      <Link href={`/listings/${note.listingMlsNumber}`} className="text-primary hover:underline">
                        MLS {note.listingMlsNumber}
                      </Link>
                      <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                        <ChevronUp className="h-3.5 w-3.5" />{note.score}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{note.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{format(new Date(note.createdAt), "MMM d, yyyy")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
