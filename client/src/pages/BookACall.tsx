/**
 * Book a Call — /book-a-call
 *
 * The generic booked-call funnel page: pick financing or coaching, leave
 * contact details, and the lead lands in the admin pipeline
 * (new → contacted → booked → flipped to BLD Financial for qualified
 * financing leads). Tool result views embed the same BookCallCta component
 * with deal context attached.
 */
import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { BookCallCta } from "@/components/BookCallCta";
import { Badge } from "@/components/ui/badge";
import { Building2, GraduationCap, PhoneCall, ClipboardList, CalendarCheck } from "lucide-react";

type Intent = "financing" | "coaching";

export default function BookACall() {
  const [intent, setIntent] = useState<Intent>("financing");

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Book a Call — Realist.ca"
        description="Talk to a financing specialist about your multiplex deal, or book a call about the Realist coaching program."
      />
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-3">
            <PhoneCall className="h-3 w-3 mr-1" /> Book a call
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Talk to a real person about your next deal</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Buying your first multiplex is a financing problem as much as a real estate problem.
            Tell us what you're working on and we'll set up the right call.
          </p>
        </div>

        {/* Intent picker */}
        <div className="grid sm:grid-cols-2 gap-3 mb-8">
          <button
            type="button"
            onClick={() => setIntent("financing")}
            className={`rounded-xl border p-4 text-left transition-colors ${
              intent === "financing" ? "border-violet-400 bg-violet-50/60 dark:bg-violet-900/10" : "border-border hover:bg-muted/50"
            }`}
            data-testid="button-intent-financing"
          >
            <div className="flex items-center gap-2 font-semibold mb-1">
              <Building2 className="h-4 w-4 text-violet-600" /> Financing a deal
            </div>
            <p className="text-sm text-muted-foreground">
              Walk through financing options for a specific property with a commercial financing specialist.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setIntent("coaching")}
            className={`rounded-xl border p-4 text-left transition-colors ${
              intent === "coaching" ? "border-violet-400 bg-violet-50/60 dark:bg-violet-900/10" : "border-border hover:bg-muted/50"
            }`}
            data-testid="button-intent-coaching"
          >
            <div className="flex items-center gap-2 font-semibold mb-1">
              <GraduationCap className="h-4 w-4 text-violet-600" /> Coaching
            </div>
            <p className="text-sm text-muted-foreground">
              Get help going from "interested" to owning your first multiplex with the Realist coaching program.
            </p>
          </button>
        </div>

        <BookCallCta key={intent} intent={intent} sourcePage="/book-a-call" />

        {/* What happens next */}
        <div className="grid sm:grid-cols-3 gap-4 mt-10 text-center">
          <div>
            <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">1. Tell us about you</p>
            <p className="text-xs text-muted-foreground">Contact details plus any deal context — 30 seconds.</p>
          </div>
          <div>
            <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-primary/10 flex items-center justify-center">
              <PhoneCall className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">2. We match you</p>
            <p className="text-xs text-muted-foreground">Financing questions go to a commercial financing specialist; coaching goes to the Realist team.</p>
          </div>
          <div>
            <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarCheck className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium">3. You book the call</p>
            <p className="text-xs text-muted-foreground">We reach out to schedule a time that works for you.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
