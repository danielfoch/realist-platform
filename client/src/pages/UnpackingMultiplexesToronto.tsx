import { useEffect } from "react";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Calendar,
  MapPin,
  Clock,
  Ticket,
  Users,
  CheckCircle2,
  Mic,
  Utensils,
  Car,
  Building2,
  TrendingUp,
  Wrench,
  HardHat,
  ChevronLeft,
  Sparkles,
  Share2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { trackTrafficEvent } from "@/lib/trafficAnalytics";
import { SpeakerCard } from "@/components/events/SpeakerCard";
import type { RealistEventSpeaker } from "@/components/events/types";
import aledHeadshot from "@assets/image_1781720568994.webp";
import joshHeadshot from "@assets/image_1781720589907.webp";
import noamHeadshot from "@assets/image_1781720616832.webp";
import ryanHeadshot from "@assets/image_1781720634648.png";
import hoomanHeadshot from "@assets/Hooman_1783450593275.png";
import benHeadshot from "@assets/Ben_Singer_1783452380339.jpg";

const TICKET_URL = "https://ci.ovationtix.com/37003/production/1277443";
// Meta Pixel scoped to this event page only (loaded in a useEffect below).
const FB_PIXEL_ID = "1661103374140663";
const EVENT_TITLE = "Unpacking Multiplexes Toronto";
const EVENT_TAGLINE = "Toronto's missing middle and multiplex development conference";
const EVENT_HERO_IMAGE = "/events/unpacking-multiplexes-toronto-ai-hero.png";
const EVENT_OG_IMAGE = "/events/unpacking-multiplexes-toronto-og.png";
const EVENT_URL = "https://realist.ca/community/events/unpacking-multiplexes-toronto";
const EVENT_DESCRIPTION =
  "Toronto's missing middle housing and multiplex development event. Join investors, architects, planners, lenders and builders at The Terminal Theatre on September 15, 2026.";
const EVENT_KEYWORDS = [
  "Toronto missing middle",
  "Toronto multiplexes",
  "Toronto multiplex event",
  "missing middle housing Toronto",
  "multiplex development Toronto",
  "Toronto fourplex event",
  "Toronto multiplex conference",
  "Unpacking Multiplexes Toronto",
  "Toronto housing policy event",
  "Toronto real estate investor event",
].join(", ");

const VENUE = {
  name: "The Terminal Theatre",
  address: "Queens Quay Terminal, Third Floor, 207 Queens Quay West, Toronto, ON M5J 1A7",
  lat: 43.639526,
  lng: -79.379194,
};

const learnPoints = [
  {
    icon: Building2,
    title: "Toronto Zoning & Policy Updates",
    body: "Master Toronto's latest multiplex zoning bylaws, as-of-right permissions, and major street designations. Discover untapped development opportunities across the GTA.",
  },
  {
    icon: TrendingUp,
    title: "Finance & Funding Strategies",
    body: "Learn proven financing approaches for multiplex projects, including construction loans, CMHC MLI Select programs, and investor partnerships.",
  },
  {
    icon: Wrench,
    title: "Design & Construction Best Practices",
    body: "Hear from award-winning architects and builders on cost-effective design, permitting shortcuts, and construction management for 2–4 unit developments.",
  },
  {
    icon: HardHat,
    title: "Development Lifecycle Deep Dives",
    body: "From site acquisition to tenant placement — get expert guidance on every phase of multiplex development.",
  },
];

const audience = [
  "Real estate developers & investors",
  "Architects & designers",
  "Urban planners & policy experts",
  "Construction professionals",
  "Housing advocates",
  "Anyone exploring multiplex investment opportunities",
];

const highlights = [
  { icon: Mic, label: "Expert panel discussions with industry leaders" },
  { icon: Users, label: "High-value networking with 100+ housing professionals" },
  { icon: Utensils, label: "Complimentary food & refreshments" },
  { icon: Sparkles, label: "Actionable takeaways you can implement immediately" },
];

const MODERATORS: RealistEventSpeaker[] = [
  {
    name: "Sabrina Maddeaux",
    company: "Guest Moderator",
    title: "Journalist & Housing Commentator",
    bio: "National housing columnist and political commentator known for sharp analysis of Canada's housing crisis and policy landscape.",
    imageUrl: null,
  },
  {
    name: "Daniel Foch",
    company: "Realist.ca",
    title: "Host & Moderator",
    bio: "Real estate investor, analyst, and founder of Realist.ca. Host of The Canadian Real Estate Investor Podcast.",
    imageUrl: "https://thedividendguyblog.com/wp-content/themes/leia-en/imagenes/2025/06/5602983c-dea5-40c9-b88e-2635b6e9c33d.png",
  },
  {
    name: "Nick Hill",
    company: "BLD Financial",
    title: "Host & Moderator",
    bio: "Co-founder of BLD Financial and co-host of The Canadian Real Estate Investor Podcast. Specialist in development financing and investor partnerships.",
    imageUrl: "https://d68-invdn-com.investing.com/company_logo/9977ab06a1fa615ad329b5606b56ac3a.jpg?width=170&height=170",
  },
];

const SPEAKERS: RealistEventSpeaker[] = [
  {
    name: "Aled Ab Iorwerth",
    company: "CMHC",
    title: "Deputy Chief Economist",
    bio: "Leading housing economics research at Canada's national housing agency, focused on affordability, supply, and policy.",
    imageUrl: aledHeadshot,
    expertProfileSlug: "aled-ab-iorwerth",
  },
  {
    name: "Josh Findlay",
    company: "BLD Financial",
    title: "Principal",
    bio: "Specialist in construction financing and CMHC MLI Select programs for multiplex and purpose-built rental projects.",
    imageUrl: joshHeadshot,
    expertProfileSlug: "josh-findlay",
  },
  {
    name: "Noam Hazan",
    company: "Noam Hazan Design Studio",
    title: "Principal Architect",
    bio: "Award-winning architect with deep expertise in multiplex design, infill development, and cost-effective construction detailing.",
    imageUrl: noamHeadshot,
    expertProfileSlug: "noam-hazan",
  },
  {
    name: "Ryan Valente",
    company: "Reside Properties",
    title: "Founder",
    bio: "Active multiplex developer and investor building and operating multi-unit residential properties across the GTA.",
    imageUrl: ryanHeadshot,
    expertProfileSlug: "ryan-valente",
  },
  {
    name: "Hooman Tabesh",
    company: "Alliance REIT",
    title: "Founder & CEO",
    bio: "Over 20 years of experience developing and operating residential rental real estate, focusing on premium boutique multifamily residences across the Toronto core.",
    imageUrl: hoomanHeadshot,
    expertProfileSlug: "hooman-tabesh",
  },
  {
    name: "Ben Singer",
    company: "SR Law",
    title: "Lawyer",
    bio: "Commercial real estate lawyer with 8 years of experience in acquisitions, dispositions, financing, and a focus on condominium and subdivision development.",
    imageUrl: benHeadshot,
    expertProfileSlug: "ben-singer",
  },
  {
    name: "Brendan Farrow",
    company: "Platform Insurance",
    title: "Speaker",
    bio: "Insurance and risk management expert focused on real estate development, construction projects, and investor protection.",
    imageUrl: null,
  },
];

const SPONSORS = [
  { src: "/partners/cmhc.png", alt: "CMHC", url: "https://www.cmhc-schl.gc.ca/" },
  { src: "/partners/bld-financial.png", alt: "BLD Financial", url: "https://www.bldfinancial.ca/" },
  { src: "/partners/reside-properties.png", alt: "Reside Properties", url: "https://www.resideproperties.ca/" },
  { src: "/partners/noam-hazan-design-studio.png", alt: "Noam Hazan Design Studio", url: "https://www.noamhazan.com/" },
  { src: "/partners/alliance-reit.jpg", alt: "Alliance REIT", url: "https://www.alliancereit.com/" },
  { src: "/partners/sr-law.jpg", alt: "SR Law", url: "https://www.srlaw.ca/" },
  {
    src: "https://www.platforminsurance.com/wp-content/uploads/2024/02/Platform-Logo-RGB-Digital-Glacier.png",
    alt: "Platform Insurance",
    url: "https://www.platforminsurance.com/",
  },
];

const AGENDA = [
  { time: "5:00 PM", label: "Doors Open", description: "Arrive, connect, and grab a drink." },
  { time: "6:00 PM", label: "Opening Remarks", description: "Welcome from the organizers and a quick overview of the evening." },
  { time: "6:10 PM", label: "Finance Panel", description: "Construction loans, CMHC MLI Select, and capital strategies for multiplex builds." },
  { time: "6:50 PM", label: "Planning & Contemplation", description: "Zoning bylaws, as-of-right permissions, and navigating Toronto's planning landscape." },
  { time: "7:30 PM", label: "Execution", description: "From site acquisition to tenant placement — the full multiplex development lifecycle." },
  { time: "8:10 PM", label: "Networking Mixer", description: "Open networking with food, drinks, and Toronto's leading multiplex community." },
];

function ModeratorCard({ moderator }: { moderator: RealistEventSpeaker }) {
  const initials = moderator.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const isSabrina = moderator.name === "Sabrina Maddeaux";

  const card = (
    <div className="h-full rounded-lg border bg-card p-5 transition-colors hover:border-primary/50">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {initials}
        </div>
        <div>
          <h3 className="font-semibold">{moderator.name}</h3>
          {(moderator.title || moderator.company) && (
            <p className="text-sm text-muted-foreground">
              {[moderator.title, moderator.company].filter(Boolean).join(", ")}
            </p>
          )}
          {moderator.bio && <p className="mt-3 text-sm leading-6 text-muted-foreground">{moderator.bio}</p>}
          {isSabrina && (
            <a
              href="https://x.com/SabrinaMaddeaux"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Follow on X
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );

  return card;
}

const faqs = [
  {
    q: "Do I need to bring a printed ticket?",
    a: "No — a digital ticket on your phone is fine. You'll receive a confirmation email from OvationTix after purchase that you can show at the door.",
  },
  {
    q: "Will food and drinks be provided?",
    a: "Yes. Complimentary food and refreshments are included with every ticket.",
  },
  {
    q: "What's the best way to get to The Terminal Theatre?",
    a: "The Terminal Theatre is on the third floor of Queens Quay Terminal at 207 Queens Quay West, right on Toronto's waterfront. The closest TTC station is Union (Line 1), a short walk or one stop on the 509/510 streetcar. Paid parking is available in the building.",
  },
  {
    q: "Who should attend this event?",
    a: "Active and aspiring multiplex developers, real estate investors, architects, planners, lenders, and anyone navigating Toronto's housing landscape will get the most value.",
  },
  {
    q: "What is the refund policy?",
    a: "No refunds. Tickets are transferable — contact the organizer if you need to change the name on a ticket.",
  },
];

export default function UnpackingMultiplexesToronto() {
  const { toast } = useToast();
  const eventDate = new Date("2026-09-15T17:00:00-04:00");
  const eventSchema = [
    {
      "@context": "https://schema.org",
      "@type": "Event",
      "@id": `${EVENT_URL}#event`,
      name: EVENT_TITLE,
      description: EVENT_DESCRIPTION,
      url: EVENT_URL,
      image: `https://realist.ca${EVENT_OG_IMAGE}`,
      startDate: "2026-09-15T17:00:00-04:00",
      endDate: "2026-09-15T22:00:00-04:00",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      inLanguage: "en-CA",
      location: {
        "@type": "Place",
        name: VENUE.name,
        address: {
          "@type": "PostalAddress",
          streetAddress: "207 Queens Quay West, Third Floor",
          addressLocality: "Toronto",
          addressRegion: "ON",
          postalCode: "M5J 1A7",
          addressCountry: "CA",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: VENUE.lat,
          longitude: VENUE.lng,
        },
      },
      organizer: {
        "@type": "Organization",
        name: "Realist.ca",
        url: "https://realist.ca",
      },
      offers: {
        "@type": "Offer",
        url: TICKET_URL,
        availability: "https://schema.org/InStock",
        priceCurrency: "CAD",
        validFrom: "2026-07-01T00:00:00-04:00",
      },
      about: [
        "Toronto missing middle housing",
        "Toronto multiplexes",
        "Multiplex development",
        "Fourplex development",
        "Housing supply",
        "Real estate investing",
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://realist.ca/" },
        { "@type": "ListItem", position: 2, name: "Events", item: "https://realist.ca/community/events" },
        { "@type": "ListItem", position: 3, name: EVENT_TITLE, item: EVENT_URL },
      ],
    },
  ];

  // Load the Meta (Facebook) Pixel on this page only.
  // Uses document.head.appendChild — more reliable in lazy-loaded React SPAs
  // than the standard snippet's insertBefore(first-script) pattern, which can
  // fail if no synchronous script tag is in scope when the effect runs.
  // The stub (n.queue) captures fbq() calls made before fbevents.js finishes
  // loading, so init + PageView fire correctly even before the async load.
  //
  // Each event gets a UUID (event_id) that is shared with the Conversions API
  // endpoint (/api/capi/event) for server-side deduplication — Meta sees one
  // event per action, not two.
  useEffect(() => {
    const w = window as any;
    if (!w.fbq) {
      const n: any = (w.fbq = function (...args: any[]) {
        n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
      });
      if (!w._fbq) w._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }
    w.fbq("init", FB_PIXEL_ID);

    // Generate a unique ID for this PageView so CAPI and browser pixel
    // can be deduplicated by Meta.
    const pageViewId = crypto.randomUUID();
    w.fbq("track", "PageView", {}, { eventID: pageViewId });

    // Mirror to Conversions API (server-to-server)
    fetch("/api/capi/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "PageView",
        eventId: pageViewId,
        eventSourceUrl: EVENT_URL,
      }),
    }).catch(() => {/* best-effort — never fail page load */});
  }, []);

  // Fire on every "Buy Tickets" click. InitiateCheckout is Meta's standard
  // event for starting a purchase, so it can be optimized/reported in Ads
  // Manager. `location` distinguishes the hero / sidebar / footer buttons.
  // A shared event_id enables CAPI ↔ browser pixel deduplication.
  const trackBuyTickets = (location: string) => {
    trackTrafficEvent({
      eventName: "ticket_cta_clicked",
      path: window.location.pathname,
      page: `${window.location.pathname}${window.location.search}`,
      component: `buy_tickets_${location}`,
      targetUrl: TICKET_URL,
      metadata: {
        eventTitle: EVENT_TITLE,
        sourceButton: location,
      },
    });
    const checkoutId = crypto.randomUUID();
    const fbq = (window as any).fbq;
    if (typeof fbq === "function") {
      fbq(
        "track",
        "InitiateCheckout",
        {
          content_name: EVENT_TITLE,
          content_category: "Event Tickets",
          source_button: location,
        },
        { eventID: checkoutId },
      );
    }
    fetch("/api/capi/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName: "InitiateCheckout",
        eventId: checkoutId,
        eventSourceUrl: EVENT_URL,
        customData: {
          content_name: EVENT_TITLE,
          content_category: "Event Tickets",
          source_button: location,
        },
      }),
    }).catch(() => {/* best-effort */});
  };

  const handleTicketClick = (location: string) => {
    trackBuyTickets(location);
    // Keep checkout in the same tab. Some mobile/in-app browsers block or
    // swallow target=_blank external checkout links, which made the button
    // appear dead for a subset of users.
    window.location.assign(TICKET_URL);
  };

  const handleShare = async () => {
    const url = window.location.href;
    const shareData = {
      title: `${EVENT_TITLE} — Toronto`,
      text: "Join us for Toronto's premier multiplex development conference.",
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied", description: "Event link copied to clipboard." });
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Toronto Missing Middle & Multiplex Event | Realist"
        description={EVENT_DESCRIPTION}
        keywords={EVENT_KEYWORDS}
        canonicalUrl="/community/events/unpacking-multiplexes-toronto"
        ogImage={EVENT_OG_IMAGE}
        structuredData={eventSchema}
      />
      {/* Meta Pixel noscript fallback (JS-disabled visitors still register a view) */}
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
      <Navigation />

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={EVENT_HERO_IMAGE}
            alt={EVENT_TITLE}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/85 to-background/70 dark:from-background/95 dark:via-background/90 dark:to-background/80" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24">
          <Link
            href="/community/events"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
            data-testid="link-back-events"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Events
          </Link>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Badge className="bg-primary text-primary-foreground">Featured Event</Badge>
            <Badge variant="outline">In Person</Badge>
            <Badge variant="outline">5 hours</Badge>
            <Badge variant="outline">All ages</Badge>
          </div>

          <h1
            className="text-4xl md:text-6xl font-bold tracking-tight mb-3"
            data-testid="text-event-title"
          >
            {EVENT_TITLE}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl">
            {EVENT_TAGLINE}
          </p>
          <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-3xl leading-relaxed">
            A focused Toronto multiplex event for people trying to turn missing middle
            housing policy into real projects: site selection, zoning, architecture,
            financing, construction, exit strategy, and underwriting.
          </p>

          <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mb-8">
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur px-4 py-3">
              <Calendar className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">Date</div>
                <div className="font-semibold" data-testid="text-event-date">
                  Tuesday, September 15, 2026
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur px-4 py-3">
              <Clock className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">Time</div>
                <div className="font-semibold">5:00 PM – 10:00 PM EDT</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur px-4 py-3 sm:col-span-2">
              <MapPin className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">Venue</div>
                <div className="font-semibold">{VENUE.name}</div>
                <div className="text-sm text-muted-foreground">{VENUE.address}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              size="lg"
              className="gap-2"
              onClick={() => handleTicketClick("hero")}
              data-testid="button-buy-tickets-hero"
            >
              <Ticket className="h-5 w-5" />
              Buy Tickets
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="gap-2"
              onClick={handleShare}
              data-testid="button-share-event"
            >
              <Share2 className="h-5 w-5" />
              Share Event
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Hosted by The Canadian Real Estate Investor Podcast · Ticketing powered by OvationTix
          </p>

          {/* Sponsors strip */}
          <div className="mt-10 pt-8 border-t border-border/40">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-5">
              Event sponsors & partners
            </p>
            <div className="flex flex-wrap items-center gap-6 md:gap-10">
              {SPONSORS.map((sponsor) => (
                <a
                  key={sponsor.alt}
                  href={sponsor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group transition-opacity hover:opacity-100"
                  data-testid={`link-sponsor-${sponsor.alt.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <img
                    src={sponsor.src}
                    alt={sponsor.alt}
                    className="h-8 w-auto object-contain grayscale opacity-70 transition-all duration-300 group-hover:grayscale-0 group-hover:opacity-100"
                  />
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Overview */}
      <section className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Overview</h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-4">
                Toronto's missing middle moment is here. The harder question is
                whether the next wave of multiplexes can actually underwrite.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Whether you're developing your first fourplex, advising a client on a
                Toronto multiplex conversion, or trying to understand where upzoning is
                creating real land value, this conference is built around practical
                execution. Connect with developers, architects, planners, lenders,
                builders, and real estate investors for an evening on Toronto
                multiplexes, missing middle housing policy, financing, design,
                construction, and investment strategy.
              </p>
            </div>

            {/* Hosts & Moderators */}
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Hosts & Moderators</h2>
              <p className="text-muted-foreground mb-6">
                Guiding the conversation and keeping the panels sharp.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {MODERATORS.map((m) => (
                  <ModeratorCard key={m.name} moderator={m} />
                ))}
              </div>
            </div>

            {/* Speakers */}
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Speakers</h2>
              <p className="text-muted-foreground mb-6">
                Hear from practitioners working at the front lines of multiplex development, finance, design, and policy.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {SPEAKERS.map((s) => (
                  <SpeakerCard key={s.name} speaker={s} />
                ))}
              </div>
            </div>

            {/* Agenda */}
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Agenda</h2>
              <p className="text-muted-foreground mb-6">
                Tuesday, September 15, 2026 · The Terminal Theatre
              </p>
              <div className="relative">
                <div className="absolute left-[4.5rem] top-0 bottom-0 w-px bg-border/60" aria-hidden="true" />
                <ol className="space-y-0">
                  {AGENDA.map((item, idx) => (
                    <li
                      key={item.time}
                      className="relative flex gap-5 pb-6 last:pb-0"
                      data-testid={`agenda-item-${idx}`}
                    >
                      <div className="w-16 shrink-0 text-right">
                        <span className="text-xs font-semibold tabular-nums text-muted-foreground leading-none pt-1 inline-block">
                          {item.time}
                        </span>
                      </div>
                      <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background mt-0.5">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                      <div className="pb-1">
                        <div className="font-semibold text-base leading-tight">{item.label}</div>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">What You'll Learn</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {learnPoints.map((p) => {
                  const Icon = p.icon;
                  return (
                    <Card key={p.title} className="hover-elevate">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold mb-1">{p.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {p.body}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Who Should Attend</h2>
              <ul className="grid sm:grid-cols-2 gap-2">
                {audience.map((a) => (
                  <li key={a} className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Event Highlights</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {highlights.map((h) => {
                  const Icon = h.icon;
                  return (
                    <div
                      key={h.label}
                      className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-3"
                    >
                      <Icon className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-sm">{h.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">Frequently Asked Questions</h2>
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((f, i) => (
                  <AccordionItem key={f.q} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left" data-testid={`button-faq-${i}`}>
                      {f.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>

          {/* Sticky sidebar */}
          <aside className="lg:col-span-1">
            <div className="lg:sticky lg:top-24 space-y-4">
              <Card className="border-primary/30">
                <CardContent className="p-6 space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Reserve your seat
                    </div>
                    <div className="text-2xl font-bold">Buy Tickets</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Limited spots available. Secure your ticket through our ticketing
                      partner.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="w-full gap-2"
                    size="lg"
                    onClick={() => handleTicketClick("sidebar")}
                    data-testid="button-buy-tickets-sidebar"
                  >
                    <Ticket className="h-5 w-5" />
                    Buy Tickets
                  </Button>
                  <div className="text-xs text-muted-foreground text-center">
                    Ticketing handled by OvationTix
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 space-y-3">
                  <h3 className="font-semibold">Good to Know</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />5 hours
                    </li>
                    <li className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      All ages
                    </li>
                    <li className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      In person
                    </li>
                    <li className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-primary" />
                      Paid parking nearby
                    </li>
                    <li className="flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-primary" />
                      Food & refreshments included
                    </li>
                  </ul>
                  <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground">
                    Refund policy: No refunds. Tickets are transferable.
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-3">Location</h3>
                  <div className="text-sm">
                    <div className="font-medium">{VENUE.name}</div>
                    <div className="text-muted-foreground mb-3">{VENUE.address}</div>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-border/60 aspect-video bg-muted">
                    <iframe
                      title="Map of The Terminal Theatre"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${VENUE.lng - 0.005}%2C${VENUE.lat - 0.003}%2C${VENUE.lng + 0.005}%2C${VENUE.lat + 0.003}&layer=mapnik&marker=${VENUE.lat}%2C${VENUE.lng}`}
                      className="w-full h-full border-0"
                      loading="lazy"
                    />
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${VENUE.lat},${VENUE.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-3"
                    data-testid="link-directions"
                  >
                    <Button variant="outline" className="w-full gap-2" size="sm">
                      <MapPin className="h-4 w-4" />
                      Get Directions
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border/60 bg-card/40">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Ready to unpack multiplexes?
          </h2>
          <p className="text-muted-foreground mb-6">
            Seats are limited. Reserve yours today and join Toronto's most active
            community of multiplex developers and investors.
          </p>
          <Button
            type="button"
            size="lg"
            className="gap-2"
            onClick={() => handleTicketClick("footer")}
            data-testid="button-buy-tickets-footer"
          >
            <Ticket className="h-5 w-5" />
            Buy Tickets
          </Button>
        </div>
      </section>
    </div>
  );
}
