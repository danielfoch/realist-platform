import { useState } from "react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ExternalLink,
  MapPin,
  Users,
  Calendar,
  ArrowRight,
  ChevronDown,
  Building2,
  Share2,
  Mail,
  Ticket,
  Sparkles,
  Heart,
  Linkedin,
  User,
} from "lucide-react";
import { Link } from "wouter";

function trackClick(type: string, label: string) {
  try {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", type, { event_label: label });
    }
  } catch {}
}

function appendUtm(url: string): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
    const utmParams = utmKeys.filter((k) => params.has(k)).map((k) => `${k}=${params.get(k)}`);
    if (utmParams.length === 0) return url;
    const sep = url.includes("?") ? "&" : "?";
    return url + sep + utmParams.join("&");
  } catch {
    return url;
  }
}

const sponsors = [
  {
    name: "CMHC / SCHL",
    contacts: ["Joel Allaert", "Charles Sauriol"],
    description: "National housing finance and policy leadership",
    url: "https://www.cmhc-schl.gc.ca",
    logo: null,
  },
  {
    name: "Vancity",
    contacts: ["Ryan McKinley"],
    description: "Multiplex construction financing and lending solutions",
    url: "https://www.vancity.com",
    logo: null,
  },
  {
    name: "Forefront Multiplex Project Marketing",
    contacts: ["Aman Khurana"],
    description: "Multiplex-focused project marketing expertise",
    url: "#",
    logo: null,
  },
  {
    name: "Theorem Developments",
    contacts: ["Suraj Jhuty, P.Eng."],
    description: "Real-world development execution and construction insight",
    url: "#",
    logo: null,
  },
  {
    name: "Greater Vancouver Tenant & Property Management Ltd.",
    contacts: ["Keaton Bessey"],
    description: "Property management and operational expertise",
    url: "#",
    logo: null,
  },
  {
    name: "Burke By Burke",
    contacts: ["Jamie Burke"],
    description: "Brand / development / project support",
    url: "#",
    logo: null,
  },
  {
    name: "BLD Financial",
    contacts: ["Ehren Laycock", "Josh Findlay"],
    description: "Financing strategy and real estate capital advisory",
    url: "#",
    logo: null,
  },
  {
    name: "Siegrist Architecture Inc.",
    contacts: ["Duane Siegrist"],
    description: "Architectural design and planning expertise",
    url: "#",
    logo: null,
  },
];

const panelists = [
  { name: "Joel Allaert", title: "Representative", company: "CMHC", bio: "National housing finance and policy leadership.", url: "#", linkedin: null, headshot: null },
  { name: "Charles Sauriol", title: "Representative", company: "CMHC", bio: "National housing finance and policy leadership.", url: "#", linkedin: null, headshot: null },
  { name: "Ryan McKinley", title: "Lending Specialist", company: "Vancity", bio: "Multiplex construction financing and lending solutions.", url: "https://www.vancity.com", linkedin: null, headshot: null },
  { name: "Aman Khurana", title: "Project Marketing", company: "Forefront / Oakwyn Realty", bio: "Multiplex-focused project marketing expertise.", url: "#", linkedin: null, headshot: null },
  { name: "Suraj Jhuty, P.Eng.", title: "Developer", company: "Theorem Developments", bio: "Real-world development execution and construction insight.", url: "#", linkedin: null, headshot: null },
  { name: "Keaton Bessey", title: "Property Manager", company: "Greater Vancouver TPM", bio: "Property management and operational expertise.", url: "#", linkedin: null, headshot: null },
  { name: "Jamie Burke", title: "Principal", company: "Burke By Burke", bio: "Brand, development, and project support.", url: "#", linkedin: null, headshot: null },
  { name: "Ehren Laycock", title: "Capital Advisor", company: "BLD Financial", bio: "Financing strategy and real estate capital advisory.", url: "#", linkedin: null, headshot: null },
  { name: "Josh Findlay", title: "Capital Advisor", company: "BLD Financial", bio: "Financing strategy and real estate capital advisory.", url: "#", linkedin: null, headshot: null },
  { name: "Duane Siegrist", title: "Architect", company: "Siegrist Architecture Inc.", bio: "Architectural design and planning expertise.", url: "#", linkedin: null, headshot: null },
  { name: "Nick Hill", title: "Co-Host", company: "The Canadian Real Estate Investor Podcast", bio: "Co-host of Canada's #1 real estate podcast.", url: "https://realist.ca", linkedin: null, headshot: null },
  { name: "Daniel Foch", title: "Co-Host", company: "The Canadian Real Estate Investor Podcast", bio: "Co-host of Canada's #1 real estate podcast.", url: "https://realist.ca", linkedin: null, headshot: null },
  { name: "Jonathan Woo", title: "Co-Host", company: "The Canadian Real Estate Investor Podcast", bio: "Event co-host and community builder.", url: "https://realist.ca", linkedin: null, headshot: null },
];

const upcomingEvents = [
  { city: "Alberta", month: "June 2026", teaser: "Western Canada's next frontier for multiplex housing.", cta: "Join Waitlist" },
  { city: "Toronto", month: "September 2026", teaser: "Back where it all started. Bigger and better.", cta: "Join Waitlist" },
  { city: "Montreal", month: "November 2026", teaser: "Quebec's unique approach to multiplex development.", cta: "Join Waitlist" },
];

const stats = [
  { label: "Sold Out Event", icon: Ticket },
  { label: "Vancouver, BC", icon: MapPin },
  { label: "200+ Attendees", icon: Users },
  { label: "3 More Cities in 2026", icon: Calendar },
];

export default function ThankYouVancouver() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"tickets" | "sponsor">("tickets");
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const openModal = (type: "tickets" | "sponsor") => {
    setModalType(type);
    setModalOpen(true);
    setSubmitted(false);
    setFormData({ firstName: "", lastName: "", email: "", phone: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.email) return;

    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/leads/engage", {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        phone: formData.phone || "",
        consent: true,
        formType: modalType === "sponsor" ? "2027 Vancouver Sponsor Interest" : "2027 Vancouver Ticket Reserve",
        formTag: modalType === "sponsor" ? "2027vancouversponsorlead" : "2027vancouverticket",
        tags: modalType === "sponsor" ? ["2027vancouversponsorlead"] : ["2027vancouverticket"],
      });
      setSubmitted(true);
      trackClick("form_submit", `2027_vancouver_${modalType}`);
      toast({ title: "You're on the list!", description: "We'll be in touch with details for 2027." });
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Thank You Vancouver | Unpacking Multiplexes Vancouver | Realist"
        description="Thank you to everyone who joined us for Unpacking Multiplexes Vancouver. Connect with sponsors, panelists, and speakers, and stay involved as we bring the event series to Alberta, Toronto, and Montreal."
        canonicalUrl="/thank-you/vancouver-multiplex-2026"
      />

      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden" data-testid="hero-section">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(239,68,68,0.15),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 py-20 md:py-32 text-center">
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 mb-6" data-testid="badge-sold-out">
            Sold Out Event — April 8, 2026
          </Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight mb-4" data-testid="text-hero-headline">
            THANK YOU VANCOUVER.
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 font-light mb-8" data-testid="text-hero-sub">
            From the bottom of our hearts.
          </p>
          <div className="max-w-2xl mx-auto space-y-4 text-gray-300 text-base md:text-lg leading-relaxed mb-10">
            <p>
              Nick Hill, Jonathan Woo and I are so grateful to have been so warmly welcomed in launching this event in a new city.
            </p>
            <p>
              It was an absolute honour and privilege to have a sold out room for our first Multiplex Vancouver event.
            </p>
            <p>
              It was a pleasure meeting so many people who are as passionate about this housing typology as we are. There is real energy in the multiplex scene in BC. It feels materially different from Toronto, where we started these events.
            </p>
            <p className="text-gray-400 text-sm">
              Part of that is because Vancouver's multiplex ecosystem is more tied to homebuilding for ownership, not just rental. Strata title has existed for a long time, and it is a simple, familiar product for buyers to understand.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="gap-2" onClick={() => scrollTo("sponsors")} data-testid="button-explore-sponsors">
              <Building2 className="h-4 w-4" /> Explore Sponsors
            </Button>
            <Button size="lg" variant="secondary" className="gap-2" onClick={() => scrollTo("panelists")} data-testid="button-meet-panelists">
              <Users className="h-4 w-4" /> Meet the Panelists
            </Button>
            <Button size="lg" variant="outline" className="gap-2 border-gray-600 text-gray-300 hover:bg-gray-800" onClick={() => scrollTo("upcoming")} data-testid="button-see-upcoming">
              <Calendar className="h-4 w-4" /> See Upcoming Events
            </Button>
          </div>
          <div className="mt-10">
            <ChevronDown className="h-6 w-6 mx-auto text-gray-500 animate-bounce" />
          </div>
        </div>
      </section>

      <section className="border-b border-border/50 bg-muted/30" data-testid="stats-section">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((stat, i) => (
              <div key={i} className="flex flex-col items-center gap-2" data-testid={`stat-${i}`}>
                <stat.icon className="h-5 w-5 text-red-500" />
                <span className="text-sm font-semibold">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-gradient-to-br from-red-500/5 to-orange-500/5 border-b border-border/50" data-testid="reserve-2027-section">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 mb-4">
            Coming 2027
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Vancouver 2027 is happening.</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Reserve your spot early or get involved as a sponsor. Be part of the next chapter.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="gap-2 px-8" onClick={() => openModal("tickets")} data-testid="button-reserve-tickets-2027">
              <Ticket className="h-5 w-5" /> Reserve Tickets for 2027
            </Button>
            <Button size="lg" variant="outline" className="gap-2 px-8" onClick={() => openModal("sponsor")} data-testid="button-reserve-sponsorship-2027">
              <Sparkles className="h-5 w-5" /> Reserve Sponsorship for 2027
            </Button>
          </div>
        </div>
      </section>

      <section id="upcoming" className="py-16 md:py-24 border-b border-border/50" data-testid="upcoming-section">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">We're just getting started.</h2>
            <p className="text-lg text-muted-foreground">
              We are doing 3 more of these events in 2026: Alberta in June, Toronto in September, Montreal in November.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {upcomingEvents.map((event, i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow" data-testid={`event-card-${i}`}>
                <CardContent className="p-6 text-center space-y-3">
                  <MapPin className="h-8 w-8 mx-auto text-red-500" />
                  <h3 className="text-xl font-bold">{event.city}</h3>
                  <Badge variant="secondary">{event.month}</Badge>
                  <p className="text-sm text-muted-foreground">{event.teaser}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      trackClick("upcoming_event_click", event.city);
                      openModal("tickets");
                    }}
                    data-testid={`button-waitlist-${i}`}
                  >
                    {event.cta} <ArrowRight className="h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="sponsors" className="py-16 md:py-24 bg-muted/30 border-b border-border/50" data-testid="sponsors-section">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Thank you to our sponsors who made this possible.</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              These organizations helped make Multiplex Vancouver happen. Please support the people helping move housing and real estate development forward.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sponsors.map((sponsor, i) => (
              <a
                key={i}
                href={appendUtm(sponsor.url)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClick("sponsor_click", sponsor.name)}
                className="block group"
                data-testid={`sponsor-card-${i}`}
              >
                <Card className="h-full hover:shadow-lg hover:border-red-500/30 transition-all">
                  <CardContent className="p-6 space-y-3">
                    <div className="h-16 flex items-center justify-center bg-muted rounded-lg">
                      {sponsor.logo ? (
                        <img src={sponsor.logo} alt={sponsor.name} className="h-10 max-w-full object-contain" />
                      ) : (
                        <Building2 className="h-8 w-8 text-muted-foreground/50" />
                      )}
                    </div>
                    <h3 className="font-semibold text-sm leading-tight">{sponsor.name}</h3>
                    <p className="text-xs text-muted-foreground">{sponsor.description}</p>
                    <div className="text-xs text-muted-foreground/80">
                      {sponsor.contacts.map((c, j) => (
                        <span key={j}>{j > 0 ? ", " : ""}{c}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-red-500 group-hover:text-red-600 transition-colors">
                      Visit Website <ExternalLink className="h-3 w-3" />
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="panelists" className="py-16 md:py-24 border-b border-border/50" data-testid="panelists-section">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Meet the panelists and speakers.</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              These are the people who shared real-world financing, zoning, construction, design, and marketing insight at the event.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {panelists.map((p, i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow" data-testid={`panelist-card-${i}`}>
                <CardContent className="p-6 space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {p.headshot ? (
                      <img src={p.headshot} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-8 w-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-sm">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">{p.title}</p>
                    <p className="text-xs font-medium text-red-500">{p.company}</p>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{p.bio}</p>
                  <div className="flex items-center justify-center gap-2">
                    {p.url && p.url !== "#" && (
                      <a
                        href={appendUtm(p.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => trackClick("panelist_click", p.name)}
                      >
                        <Button variant="outline" size="sm" className="gap-1 text-xs h-7" data-testid={`button-panelist-${i}`}>
                          Website <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    )}
                    {p.linkedin && (
                      <a href={p.linkedin} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Linkedin className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-muted/30 border-b border-border/50" data-testid="momentum-section">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Heart className="h-8 w-8 mx-auto text-red-500 mb-4" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Let's keep the momentum going.</h2>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed mb-8">
            This conversation is just getting started. Multiplex housing is becoming one of the most important forms of housing delivery in Canada, and Vancouver made it clear there is real demand for practical, operator-level conversations around financing, approvals, design, construction, and sales.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="https://www.skool.com/realistgroup" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2" data-testid="button-follow-realist">
                <Users className="h-4 w-4" /> Follow Realist
              </Button>
            </a>
            <Button className="gap-2" onClick={() => scrollTo("upcoming")} data-testid="button-join-next">
              <Calendar className="h-4 w-4" /> Join the Next Event
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => openModal("sponsor")} data-testid="button-sponsor-future">
              <Sparkles className="h-4 w-4" /> Sponsor a Future City
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white" data-testid="footer-cta-section">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Know someone who should be part of the next one?</h2>
          <p className="text-gray-400 mb-8">Tag someone we should involve in Alberta.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              size="lg"
              className="gap-2"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: "Thank You Vancouver — Unpacking Multiplexes", url: window.location.href });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  toast({ title: "Link copied!", description: "Share it with someone who should be at the next one." });
                }
              }}
              data-testid="button-share-page"
            >
              <Share2 className="h-4 w-4" /> Share This Page
            </Button>
            <Link href="/about/contact">
              <Button size="lg" variant="secondary" className="gap-2" data-testid="button-contact-us">
                <Mail className="h-4 w-4" /> Contact Us
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="gap-2 border-gray-600 text-gray-300 hover:bg-gray-800" onClick={() => openModal("sponsor")} data-testid="button-sponsor-event">
              <Sparkles className="h-4 w-4" /> Sponsor a Future Event
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md" data-testid="modal-2027-capture">
          <DialogHeader>
            <DialogTitle data-testid="text-modal-title">
              {modalType === "sponsor" ? "Reserve Sponsorship — Vancouver 2027" : "Reserve Tickets — Vancouver 2027"}
            </DialogTitle>
            <DialogDescription>
              {modalType === "sponsor"
                ? "Let us know you're interested in sponsoring. We'll reach out with a deck and details."
                : "Be the first to know when tickets go live. No commitment yet."}
            </DialogDescription>
          </DialogHeader>
          {submitted ? (
            <div className="text-center py-6 space-y-2">
              <Sparkles className="h-8 w-8 mx-auto text-red-500" />
              <p className="font-semibold text-lg" data-testid="text-success">You're on the list!</p>
              <p className="text-sm text-muted-foreground">We'll be in touch with details for 2027.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    data-testid="input-first-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    data-testid="input-last-name"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  data-testid="input-phone"
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={submitting} data-testid="button-submit-reserve">
                {submitting ? "Submitting..." : modalType === "sponsor" ? "Reserve Sponsorship" : "Reserve My Spot"}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </Button>
              <p className="text-xs text-muted-foreground text-center">No payment required. We'll notify you when details are available.</p>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}