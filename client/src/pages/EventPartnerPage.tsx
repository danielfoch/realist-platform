import { useParams, Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, ArrowLeft, Calendar, Building2, Tag } from "lucide-react";
import { getEventPartner } from "@/lib/eventPartners";
import NotFound from "@/pages/not-found";

export default function EventPartnerPage() {
  const { slug } = useParams<{ slug: string }>();
  const partner = getEventPartner(slug ?? "");

  if (!partner) return <NotFound />;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": partner.name,
    "url": partner.website,
    "description": partner.description[0],
    "knowsAbout": partner.relatedTopics,
    "subjectOf": {
      "@type": "Event",
      "name": partner.event,
      "url": `https://realist.ca${partner.eventPath}`,
      "organizer": {
        "@type": "Organization",
        "name": "Realist.ca",
        "url": "https://realist.ca"
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${partner.name} — ${partner.event} Sponsor | Realist.ca`}
        description={partner.description[0]}
        keywords={partner.keywords.join(", ")}
        canonicalUrl={`/community/events/partners/${partner.slug}`}
        structuredData={structuredData}
      />
      <Navigation />

      <main className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 md:px-6">

          {/* Back link */}
          <Link href={partner.eventPath} data-testid="link-back-to-event">
            <Button variant="ghost" size="sm" className="gap-2 mb-8 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to {partner.event}
            </Button>
          </Link>

          {/* Header card */}
          <div className="rounded-2xl border border-border/60 bg-card p-8 md:p-12 mb-10 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center gap-8">
              {/* Logo */}
              <div className="shrink-0 flex items-center justify-center w-40 h-28 rounded-xl bg-white border border-border/40 p-4">
                <img
                  src={partner.logo}
                  alt={`${partner.name} logo`}
                  className="max-h-full max-w-full object-contain"
                  data-testid="img-partner-logo"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant="secondary" className="gap-1">
                    <Tag className="h-3 w-3" />
                    {partner.category}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {partner.event}
                  </Badge>
                </div>
                <h1
                  className="text-3xl md:text-4xl font-bold mb-2"
                  data-testid="text-partner-name"
                >
                  {partner.name}
                </h1>
                <p className="text-lg text-muted-foreground mb-4">
                  {partner.tagline}
                </p>
                <a
                  href={partner.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-partner-website"
                >
                  <Button className="gap-2">
                    Visit {partner.shortName}
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </div>

          {/* Body content */}
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-6">
              <h2 className="text-2xl font-bold">About {partner.shortName}</h2>
              {partner.description.map((para, i) => (
                <p key={i} className="text-base text-muted-foreground leading-relaxed">
                  {para}
                </p>
              ))}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">

              {/* Why they partnered */}
              <div className="rounded-xl border border-border/60 bg-muted/30 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Why This Sponsor?</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {partner.whyPartner}
                </p>
              </div>

              {/* Topics */}
              <div className="rounded-xl border border-border/60 bg-muted/30 p-6">
                <h3 className="font-semibold mb-3">Related Topics</h3>
                <div className="flex flex-wrap gap-2">
                  {partner.relatedTopics.map((topic) => (
                    <Badge key={topic} variant="outline" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* CTA to event */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
                <h3 className="font-semibold mb-2">{partner.event}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {partner.shortName} is a proud sponsor of this Realist.ca event.
                </p>
                <Link href={partner.eventPath}>
                  <Button variant="outline" size="sm" className="w-full gap-2" data-testid="link-view-event">
                    <Calendar className="h-4 w-4" />
                    View Event Details
                  </Button>
                </Link>
              </div>

              {/* Website link */}
              <a
                href={partner.website}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
                data-testid="link-partner-website-sidebar"
              >
                <Button variant="default" className="w-full gap-2">
                  Visit {partner.shortName}
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 rounded-2xl border border-border/60 bg-card p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Ready to learn more?</h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Join us at {partner.event} and hear directly from {partner.shortName} alongside
              Canada's top multiplex investors, developers, and finance professionals.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href={partner.eventPath}>
                <Button size="lg" className="gap-2" data-testid="button-view-event-bottom">
                  <Calendar className="h-5 w-5" />
                  View {partner.event}
                </Button>
              </Link>
              <a href={partner.website} target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="gap-2" data-testid="button-visit-partner-bottom">
                  Visit {partner.shortName}
                  <ExternalLink className="h-5 w-5" />
                </Button>
              </a>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
