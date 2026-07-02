import { useState, useCallback, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Printer, RotateCcw, ChevronDown, ChevronUp, Map, Layers, BarChart2, Landmark, BookOpen, Save, CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

const LS_KEY = "realist_notebook_v1";

const DEFAULTS: Record<string, any> = {
  p4_name_0: "Daniel Foch",
  p4_name_1: "Nick Hill",
};

function loadData(): Record<string, any> {
  try {
    const stored = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    return { ...DEFAULTS, ...stored };
  } catch { return { ...DEFAULTS }; }
}
function saveData(d: Record<string, any>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {}
}

type NB = { data: Record<string, any>; set: (k: string, v: any) => void };

function useNB(isAuthenticated: boolean): NB & { saveStatus: "idle" | "saving" | "saved" } {
  const [data, setData] = useState<Record<string, any>>(loadData);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(false);

  // Load from server when authenticated
  const { data: serverData } = useQuery<{ data: Record<string, any> }>({
    queryKey: ["/api/notebook"],
    enabled: isAuthenticated,
    staleTime: Infinity,
  });

  // Override local state with server data on first load
  useEffect(() => {
    if (serverData && !initialLoadRef.current) {
      initialLoadRef.current = true;
      const merged = { ...loadData(), ...serverData.data };
      setData(merged);
      saveData(merged);
    }
  }, [serverData]);

  const saveMutation = useMutation({
    mutationFn: async (d: Record<string, any>) => {
      const res = await apiRequest("POST", "/api/notebook", { data: d });
      return res.json();
    },
    onMutate: () => setSaveStatus("saving"),
    onSuccess: () => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
    onError: () => setSaveStatus("idle"),
  });

  const set = useCallback((k: string, v: any) => {
    setData(prev => {
      const next = { ...prev, [k]: v };
      saveData(next);
      if (isAuthenticated) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => saveMutation.mutate(next), 1500);
      }
      return next;
    });
  }, [isAuthenticated, saveMutation]);

  return { data, set, saveStatus };
}

// ─── Auth Gate ───────────────────────────────────────────────────────────────

function AuthGate() {
  return (
    <>
      <SEO title="Field Notebook — Realist.ca" description="Your interactive multiplex investor field notebook. Sign up to get started." noIndex />
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-lg mx-auto px-4 py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-3" style={{ fontFamily: "var(--font-mono)" }}>Realist.ca</div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Field Notebook</h1>
          <p className="text-muted-foreground text-base mb-8 leading-relaxed">
            Your interactive multiplex investing workbook — notes, numbers, and next moves. Create a free account to access the notebook and save your progress to your profile.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/auth/signup"
              className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              Create free account →
            </Link>
            <Link
              href="/auth/login"
              className="px-6 py-3 border border-border bg-card text-foreground font-medium rounded-lg hover:bg-muted transition-colors text-sm"
            >
              Sign in
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-8">Free to use · No credit card required</p>
        </div>
      </div>
    </>
  );
}

function Field({ label, id, nb, mono, placeholder }: { label?: string; id: string; nb: NB; mono?: boolean; placeholder?: string }) {
  return (
    <div>
      {label && <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">{label}</label>}
      <input
        value={nb.data[id] || ""}
        onChange={e => nb.set(id, e.target.value)}
        placeholder={placeholder || " "}
        className="w-full bg-muted/50 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/40 border border-transparent focus:border-primary/20"
        style={{ fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)" }}
      />
    </div>
  );
}

function TextArea({ label, id, nb, rows = 3, placeholder }: { label?: string; id: string; nb: NB; rows?: number; placeholder?: string }) {
  return (
    <div>
      {label && <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">{label}</label>}
      <textarea
        value={nb.data[id] || ""}
        onChange={e => nb.set(id, e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-muted/50 rounded-md text-sm text-foreground px-3 py-2.5 outline-none focus:ring-1 focus:ring-primary/40 resize-none transition-all placeholder:text-muted-foreground/40 border border-transparent focus:border-primary/20"
        style={{ fontFamily: "var(--font-sans)", lineHeight: 1.65 }}
      />
    </div>
  );
}

function Check({ label, id, nb }: { label: string; id: string; nb: NB }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer text-sm text-foreground select-none">
      <input
        type="checkbox"
        checked={!!nb.data[id]}
        onChange={e => nb.set(id, e.target.checked)}
        className="mt-0.5 rounded accent-primary w-4 h-4 shrink-0"
      />
      <span className="leading-snug">{label}</span>
    </label>
  );
}

function RiskRow({ label, id, nb }: { label: string; id: string; nb: NB }) {
  const val = nb.data[id] || "low";
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0">
      <span className="flex-1 text-sm text-foreground">{label}</span>
      <div className="flex gap-1">
        {(["low", "medium", "high"] as const).map(r => (
          <button key={r} onClick={() => nb.set(id, r)}
            className="px-2 py-0.5 text-[10px] rounded border transition-all"
            style={{
              fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em",
              background: val === r ? (r === "high" ? "#C0392B" : r === "medium" ? "#E67E22" : "hsl(var(--primary))") : "transparent",
              color: val === r ? "#fff" : "hsl(var(--muted-foreground))",
              borderColor: val === r ? "transparent" : "hsl(var(--border))",
            }}>{r}</button>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-5 first:mt-0">
      {children}
    </p>
  );
}

function FormulaCard({ title, formula, note, href, label }: { title: string; formula: string; note?: string; href?: string; label?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-1.5" style={{ borderLeft: "3px solid hsl(var(--primary))" }}>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{title}</div>
      <div className="text-sm text-foreground leading-relaxed flex-1" style={{ fontFamily: "var(--font-mono)" }}>{formula}</div>
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline mt-0.5 nb-no-print" style={{ fontFamily: "var(--font-mono)" }}>
          {label ?? "Use tool"} →
        </Link>
      )}
    </div>
  );
}

function CalcRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center px-3 py-2 rounded-md text-sm ${highlight ? "bg-primary/10 border border-primary/20" : "bg-muted/60"}`}>
      <span className="text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{label}</span>
      <span className={`font-bold ${highlight ? "text-primary" : "text-foreground"}`} style={{ fontFamily: "var(--font-mono)" }}>{value}</span>
    </div>
  );
}

function QR({ url, size = 52, label }: { url: string; size?: number; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="border border-border rounded p-1 bg-white">
        <QRCodeSVG value={url} size={size} level="M" />
      </div>
      {label && <span className="text-[9px] text-muted-foreground text-center" style={{ fontFamily: "var(--font-mono)", maxWidth: size + 8 }}>{label}</span>}
    </div>
  );
}

function SectionCard({ num, title, children, printBreak = true }: { num: number; title: string; children: React.ReactNode; printBreak?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`nb-section rounded-xl border border-border bg-card overflow-hidden shadow-sm${printBreak ? " nb-print-break" : ""}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors nb-no-print"
      >
        <span className="text-xs text-muted-foreground shrink-0 w-5 text-right" style={{ fontFamily: "var(--font-mono)" }}>{String(num).padStart(2, "0")}</span>
        <span className="h-4 w-px bg-border shrink-0" />
        <span className="font-semibold text-foreground text-sm flex-1">{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {/* always-visible header for print */}
      <div className="nb-print-only hidden px-5 pt-5 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{String(num).padStart(2, "0")}</span>
          <span className="font-bold text-foreground">{title}</span>
        </div>
      </div>
      {open && <div className="px-5 pb-6 pt-4 border-t border-border">{children}</div>}
    </div>
  );
}

// ─── Pages ─────────────────────────────────────────────────────────────────

function S1_BelongsTo({ nb }: { nb: NB }) {
  return (
    <SectionCard num={1} title="This notebook belongs to">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mb-6">
        <Field label="Name" id="p1_name" nb={nb} />
        <Field label="Email" id="p1_email" nb={nb} />
        <Field label="Phone" id="p1_phone" nb={nb} />
        <Field label="City / Market" id="p1_city" nb={nb} />
        <Field label="Event" id="p1_event" nb={nb} />
        <Field label="Date" id="p1_date" nb={nb} />
      </div>
      <SectionLabel>My investing focus</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 mb-6">
        <Check label="Duplex / Triplex / Fourplex" id="p1_focus_plex" nb={nb} />
        <Check label="Garden suite / laneway" id="p1_focus_garden" nb={nb} />
        <Check label="Small multifamily" id="p1_focus_smf" nb={nb} />
        <Check label="BRRRR / value-add" id="p1_focus_brrrr" nb={nb} />
        <Check label="Development / infill" id="p1_focus_dev" nb={nb} />
        <Check label="Other" id="p1_focus_other" nb={nb} />
      </div>
      <div className="flex items-start gap-4 p-4 bg-muted/40 rounded-lg border border-border">
        <div className="flex-1">
          <p className="text-sm text-foreground leading-relaxed mb-1">
            Access the interactive online version of this notebook at{" "}
            <a href="https://realist.ca/notebook" target="_blank" rel="noreferrer" className="text-primary font-semibold hover:underline">realist.ca/notebook</a>
          </p>
          <p className="text-xs text-muted-foreground">All your entries save automatically to this device.</p>
        </div>
        <QR url="https://realist.ca/notebook" size={56} label="realist.ca/notebook" />
      </div>
    </SectionCard>
  );
}

const FEATURES = [
  {
    icon: Map,
    label: "Browse listings",
    desc: "Search Canadian MLS listings by yield, cap rate, city, and asset type. Filter for the exact deal that fits your mandate.",
    url: "realist.ca/find-deals",
    href: "https://realist.ca/find-deals",
  },
  {
    icon: Layers,
    label: "Assess site feasibility",
    desc: "Check zoning, as-of-right density, GFA limits, and approvals risk before you make an offer.",
    url: "realist.ca/tools/analyzer",
    href: "https://realist.ca/tools/analyzer",
  },
  {
    icon: BarChart2,
    label: "Analyze deals",
    desc: "Run full pro forma analysis across Buy & Hold, BRRRR, Multiplex, and Flip strategies with stress-test scenarios.",
    url: "realist.ca/tools/analyzer",
    href: "https://realist.ca/tools/analyzer",
  },
  {
    icon: Landmark,
    label: "Underwrite financing",
    desc: "Model DSCR, LTV, CMHC MLI Select points, and mortgage stress tests — live Canadian rates included.",
    url: "realist.ca/tools/mortgage",
    href: "https://realist.ca/tools/mortgage",
  },
];

function S2_About() {
  const waveHeights = [4, 9, 6, 12, 7, 10, 5, 8, 11, 6, 9, 4, 12, 7, 10, 5, 8, 11, 6, 9, 4, 7, 10, 5];
  return (
    <SectionCard num={2} title="About Realist.ca">
      {/* Hero tagline */}
      <div className="mb-6">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-2" style={{ fontFamily: "var(--font-mono)" }}>realist.ca</div>
        <h2 className="text-xl font-bold text-foreground leading-tight mb-2">All-in-one AI realtor<br className="hidden sm:block" /> for investors</h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
          Realist.ca gives Canadian real estate investors institutional-grade tools in one place — from finding the deal to closing the financing. No spreadsheets required.
        </p>
      </div>

      {/* Feature infographic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {FEATURES.map((f, i) => (
          <a key={i} href={f.href} target="_blank" rel="noreferrer"
            className="group flex gap-3 rounded-xl border border-border bg-muted/30 p-4 hover:border-primary/40 hover:bg-primary/5 transition-all no-underline">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <f.icon className="w-4.5 h-4.5 text-primary" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-semibold text-foreground">{f.label}</span>
                <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block" style={{ fontFamily: "var(--font-mono)" }}>↗</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              <span className="text-[10px] text-primary/70 mt-1.5 block" style={{ fontFamily: "var(--font-mono)" }}>{f.url}</span>
            </div>
          </a>
        ))}
      </div>

      {/* Podcast */}
      <div className="rounded-xl border border-border bg-foreground p-4 mb-5">
        <div className="text-[10px] uppercase tracking-widest mb-2" style={{ fontFamily: "var(--font-mono)", color: "#888" }}>Podcast</div>
        <div className="font-bold text-white text-base mb-3 leading-snug">The Canadian Real Estate Investor Podcast</div>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none"><path d="M1 1l8 5-8 5V1z" fill="white" /></svg>
          </div>
          <div className="flex items-end gap-0.5">
            {waveHeights.map((h, i) => <div key={i} style={{ width: 3, height: h, background: "#ffffff33", borderRadius: 2 }} />)}
          </div>
        </div>
        <p className="text-sm italic text-white/60">Listen, learn, underwrite, repeat.</p>
      </div>

      {/* Hosts */}
      <SectionLabel>Podcast hosts</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { name: "Daniel Foch", title: "Real estate broker, economist, investor educator", url: "realist.ca/danielfoch", href: "https://realist.ca/danielfoch" },
          { name: "Nick Hill", title: "Investor, operator, mortgage & brokerage expertise", url: "realist.ca/nickhill", href: "https://realist.ca/nickhill" },
        ].map(h => (
          <a key={h.name} href={h.href} target="_blank" rel="noreferrer"
            className="group rounded-lg border border-border bg-muted/30 p-4 hover:border-primary/30 hover:bg-primary/5 transition-all no-underline block"
            style={{ borderTop: "2px solid hsl(var(--primary))" }}>
            <div className="font-semibold text-foreground mb-0.5 group-hover:text-primary transition-colors">{h.name}</div>
            <div className="text-xs text-muted-foreground mb-3 leading-relaxed">{h.title}</div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <svg width="5" height="6" viewBox="0 0 5 6" fill="none"><path d="M0.5 0.5l4 2.5-4 2.5V0.5z" fill="hsl(var(--primary))" /></svg>
              </div>
              <span className="text-[11px] text-primary/80" style={{ fontFamily: "var(--font-mono)" }}>{h.url}</span>
            </div>
          </a>
        ))}
      </div>
    </SectionCard>
  );
}

function S3_MyWhy({ nb }: { nb: NB }) {
  return (
    <SectionCard num={3} title="My Why">
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        Before the numbers, write down the reason. The strongest investors know what they are building, why they are building it, and what they are unwilling to risk.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
        <TextArea label="Why am I investing in real estate?" id="p3_why" nb={nb} rows={3} placeholder="..." />
        <TextArea label="What does success look like in 5 years?" id="p3_five_year" nb={nb} rows={3} placeholder="..." />
        <TextArea label="What kind of housing do I want to create?" id="p3_housing" nb={nb} rows={3} placeholder="..." />
        <TextArea label="What risks am I not willing to take?" id="p3_risks" nb={nb} rows={3} placeholder="..." />
      </div>
      <SectionLabel>My investor operating system</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
        <Field label="Target market" id="p3_target_market" nb={nb} />
        <Field label="Target asset type" id="p3_asset_type" nb={nb} />
        <Field label="Min cash-on-cash" id="p3_coc" nb={nb} mono placeholder="e.g. 8%" />
        <Field label="Min DSCR" id="p3_dscr" nb={nb} mono placeholder="e.g. 1.2x" />
        <Field label="Min yield on cost" id="p3_yoc" nb={nb} mono placeholder="e.g. 5%" />
        <Field label="Max project complexity" id="p3_complexity" nb={nb} placeholder="e.g. minor variance" />
      </div>
    </SectionCard>
  );
}

function S4_PowerTeam({ nb }: { nb: NB }) {
  const roles = [
    "Realtor", "Mortgage Broker / Lender", "Lawyer", "Accountant",
    "Planner", "Architect / Designer", "Builder / GC", "Engineer",
    "Appraiser", "Insurance Broker", "Property Manager", "Mentor / Investor",
  ];
  return (
    <SectionCard num={4} title="Power Team Builder">
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        Capture the people you meet who can help you find, fund, design, build, approve, manage, or exit better projects.
      </p>
      <div className="space-y-3">
        {roles.map((r, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 pb-3 border-b border-border/50 last:border-0">
            <div className="text-xs font-medium text-primary pt-1" style={{ fontFamily: "var(--font-mono)" }}>{r}</div>
            <Field id={`p4_name_${i}`} nb={nb} placeholder="Name / Company" />
            <Field id={`p4_contact_${i}`} nb={nb} placeholder="Phone / Email" mono />
          </div>
        ))}
      </div>
      <SectionLabel>Follow-up within 48 hours</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
        <Check label="Send intro email / text" id="p4_fu_intro" nb={nb} />
        <Check label="Book a call" id="p4_fu_call" nb={nb} />
        <Check label="Share a property" id="p4_fu_prop" nb={nb} />
        <Check label="Ask for a quote" id="p4_fu_quote" nb={nb} />
        <Check label="Add to CRM" id="p4_fu_crm" nb={nb} />
      </div>
    </SectionCard>
  );
}

function S5_SiteSelection({ nb }: { nb: NB }) {
  return (
    <SectionCard num={5} title="Site Selection Checklist">
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        Can I plex it as-of-right — or am I walking into approvals risk?
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4 mb-6">
        <Field label="Address" id="p5_address" nb={nb} />
        <Field label="Municipality" id="p5_muni" nb={nb} />
        <Field label="Lot frontage" id="p5_front" nb={nb} mono />
        <Field label="Lot depth" id="p5_depth" nb={nb} mono />
        <Field label="Lot area" id="p5_area" nb={nb} mono />
        <Field label="Current zoning" id="p5_zone" nb={nb} />
        <Field label="Est. allowed units" id="p5_units" nb={nb} mono />
        <Field label="Est. buildable GFA" id="p5_gfa" nb={nb} mono />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div>
          <SectionLabel>Zoning + permissions</SectionLabel>
          <div className="space-y-2.5">
            {["Multiplex permitted as-of-right", "ARU rules reviewed", "Height limit checked", "Lot coverage checked", "FSI / GFA rules checked", "Parking requirement checked", "Heritage status checked"].map((l, i) => (
              <Check key={i} label={l} id={`p5_z_${i}`} nb={nb} />
            ))}
          </div>
        </div>
        <div>
          <SectionLabel>Physical constraints</SectionLabel>
          <div className="space-y-2.5">
            {["Mature trees / forestry risk", "Floodplain / CA risk", "Hydro / overhead clearance", "Setbacks reviewed", "Fire / side yard access", "Servicing capacity", "Construction access"].map((l, i) => (
              <Check key={i} label={l} id={`p5_p_${i}`} nb={nb} />
            ))}
          </div>
        </div>
      </div>
      <SectionLabel>Initial verdict</SectionLabel>
      <div className="flex flex-wrap gap-4 mb-4">
        <Check label="Worth pursuing" id="p5_v_yes" nb={nb} />
        <Check label="More diligence needed" id="p5_v_maybe" nb={nb} />
        <Check label="Pass" id="p5_v_no" nb={nb} />
      </div>
      <TextArea label="Red flag notes" id="p5_flags" nb={nb} rows={2} placeholder="Any concerns, constraints, or blockers..." />
    </SectionCard>
  );
}

function S6_ApprovalsRisk({ nb }: { nb: NB }) {
  const risks = ["Lot frontage", "Lot depth", "Lot coverage", "Building height", "Floor space / GFA", "Side yard setbacks", "Rear yard setbacks", "Parking", "Tree protection", "Hydro wire clearance", "Conservation / floodplain", "Heritage", "Servicing", "Fire access", "Neighbour objection", "Construction staging"];
  const flags = risks.filter(r => { const v = nb.data[`p6_r_${r}`]; return v === "medium" || v === "high"; }).length;
  const verdict = flags <= 3 ? { label: "Lower risk", cls: "bg-green-50 border-green-200 text-green-800" } : flags <= 7 ? { label: "More diligence required", cls: "bg-orange-50 border-orange-200 text-orange-800" } : { label: "High approvals risk", cls: "bg-red-50 border-red-200 text-red-800" };
  return (
    <SectionCard num={6} title="Approvals Risk Screener">
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        A deal can look great in a spreadsheet and die in approvals. Rate each factor Low / Medium / High before falling in love.
      </p>
      <div className="rounded-lg border border-border bg-muted/30 p-4 mb-5 divide-y divide-border/50">
        {risks.map(r => <RiskRow key={r} label={r} id={`p6_r_${r}`} nb={nb} />)}
      </div>
      <div className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm font-semibold mb-5 ${verdict.cls}`}>
        <span>{flags} medium / high flag{flags !== 1 ? "s" : ""}</span>
        <span>{verdict.label}</span>
      </div>
      <SectionLabel>Early calls that save months</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {["Planner", "Architect / designer", "Urban forestry", "Conservation authority", "Hydro company", "Building dept", "Fire dept", "Lender / broker"].map(c => (
          <div key={c} className="flex items-center gap-2 text-sm text-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            {c}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function S7_ProjectChecklist({ nb }: { nb: NB }) {
  const stages = [
    { title: "Deal intake", items: ["Address reviewed", "Comp sales reviewed", "Rent assumptions reviewed", "Exit strategy selected", "Financing path identified"] },
    { title: "Site + zoning", items: ["Zoning reviewed", "GFA estimated", "Setbacks reviewed", "Trees reviewed", "Servicing reviewed", "Parking reviewed", "Approvals risk reviewed"] },
    { title: "Team", items: ["Realtor", "Mortgage broker / lender", "Lawyer", "Planner", "Architect / designer", "Builder", "Property manager"] },
    { title: "Numbers", items: ["Total project cost est.", "Hard costs est.", "Soft costs est.", "Financing costs est.", "ARV estimated", "NOI estimated", "DSCR tested", "Cash-on-cash tested", "Yield on cost tested"] },
    { title: "Execution", items: ["Offer strategy", "Due diligence condition", "Financing condition", "Permitting path", "Construction budget", "Timeline", "Contingency", "Next 3 actions"] },
  ];
  return (
    <SectionCard num={7} title="Multiplex Project Checklist">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {stages.map(s => (
          <div key={s.title}>
            <div className="text-xs font-bold uppercase tracking-widest text-foreground mb-3 pb-2 border-b-2 border-primary" style={{ fontFamily: "var(--font-mono)" }}>{s.title}</div>
            <div className="space-y-2.5">
              {s.items.map((item, i) => <Check key={i} label={item} id={`p7_${s.title}_${i}`} nb={nb} />)}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function S8_DealMap() {
  return (
    <SectionCard num={8} title="Quick Formulas — Deal Map">
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        Rough math for screening, not final underwriting. Confirm all assumptions with qualified professionals.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormulaCard title="Total Project Cost" formula="Purchase + Closing + Hard + Soft + Financing = TPC" href="/tools/analyzer" label="Deal Analyzer" />
        <FormulaCard title="Net Operating Income (NOI)" formula="Gross Rent − Vacancy − Operating Expenses = NOI" href="/tools/analyzer" label="Deal Analyzer" />
        <FormulaCard title="Cap Rate" formula="NOI ÷ Purchase Price = Cap Rate" note="Measures income yield against current value" href="/tools/cap-rates" label="Cap Rates Explorer" />
        <FormulaCard title="Yield on Cost" formula="Stabilized NOI ÷ Total Project Cost = YoC" note="More useful for development and heavy value-add" href="/tools/analyzer" label="Deal Analyzer" />
        <FormulaCard title="Cash-on-Cash Return" formula="Annual Pre-Tax Cash Flow ÷ Cash Invested = CoC" href="/tools/analyzer" label="Deal Analyzer" />
        <FormulaCard title="DSCR" formula="NOI ÷ Annual Debt Service = DSCR" href="/tools/analyzer" label="Deal Analyzer" />
        <FormulaCard title="Project Profit" formula="Projected ARV − Total Project Cost = Profit" href="/tools/analyzer" label="Deal Analyzer" />
        <FormulaCard title="Rough GFA" formula="Lot Area × Permitted FSI = Est. Gross Floor Area" href="/tools/multiplex-feasibility" label="Multiplex Feasibility" />
      </div>
      <div className="flex justify-end mt-5">
        <QR url="https://realist.ca/tools/analyzer" size={52} label="deal analyzer" />
      </div>
    </SectionCard>
  );
}

function S9_DealAnalyzer({ nb }: { nb: NB }) {
  const g = (k: string) => parseFloat(nb.data[`p9_${k}`] || "0") || 0;
  const tpc = g("purchase") + g("closing") + g("hard") + g("soft") + g("financing");
  const grossRent = g("rent") * 12 * (1 - g("vacancy") / 100);
  const noi = grossRent - g("opex") * 12;
  const capRate = g("purchase") > 0 ? noi / g("purchase") * 100 : 0;
  const yoc = tpc > 0 ? noi / tpc * 100 : 0;
  const cashFlow = noi - g("debt");
  const totalCash = g("cash_invested") || tpc;
  const coc = totalCash > 0 ? cashFlow / totalCash * 100 : 0;
  const dscr = g("debt") > 0 ? noi / g("debt") : 0;
  const profit = g("arv") - tpc;
  const margin = g("arv") > 0 ? profit / g("arv") * 100 : 0;
  const signal = coc >= 8 && dscr >= 1.2 && yoc >= 5 ? "strong" : coc >= 5 && dscr >= 1.0 ? "diligence" : tpc > 0 ? "needs-work" : null;
  const signalProps = signal === "strong" ? { label: "Strong candidate", cls: "bg-green-50 text-green-800 border border-green-200" } : signal === "diligence" ? { label: "Worth deeper diligence", cls: "bg-orange-50 text-orange-800 border border-orange-200" } : signal === "needs-work" ? { label: "Needs more work", cls: "bg-red-50 text-red-800 border border-red-200" } : null;
  const fmt = (n: number, dec = 1) => isFinite(n) && n !== 0 ? n.toFixed(dec) : "—";
  const fmtD = (n: number) => n ? "$" + Math.round(n).toLocaleString() : "—";

  return (
    <SectionCard num={9} title="Deal Analyzer">
      {signalProps && (
        <div className={`flex items-center justify-center px-4 py-2 rounded-lg text-sm font-bold mb-5 ${signalProps.cls}`}>
          {signalProps.label}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4 mb-6">
        <Field label="Address" id="p9_address" nb={nb} />
        <Field label="Exit strategy" id="p9_exit" nb={nb} />
        <Field label="Purchase price ($)" id="p9_purchase" nb={nb} mono placeholder="e.g. 900000" />
        <Field label="ARV / stabilized value ($)" id="p9_arv" nb={nb} mono placeholder="e.g. 1200000" />
        <Field label="Closing costs ($)" id="p9_closing" nb={nb} mono placeholder="e.g. 25000" />
        <Field label="Hard costs ($)" id="p9_hard" nb={nb} mono placeholder="e.g. 200000" />
        <Field label="Soft costs ($)" id="p9_soft" nb={nb} mono placeholder="e.g. 40000" />
        <Field label="Financing costs ($)" id="p9_financing" nb={nb} mono placeholder="e.g. 15000" />
        <Field label="Monthly rent ($)" id="p9_rent" nb={nb} mono placeholder="e.g. 5500" />
        <Field label="Vacancy allowance (%)" id="p9_vacancy" nb={nb} mono placeholder="e.g. 5" />
        <Field label="Monthly operating expenses ($)" id="p9_opex" nb={nb} mono placeholder="e.g. 1200" />
        <Field label="Annual debt service ($)" id="p9_debt" nb={nb} mono placeholder="e.g. 48000" />
        <Field label="Total cash invested ($)" id="p9_cash_invested" nb={nb} mono placeholder="auto-calculated if blank" />
      </div>
      <SectionLabel>Results</SectionLabel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <CalcRow label="Total Project Cost" value={fmtD(tpc)} highlight />
        <CalcRow label="Annual NOI" value={fmtD(noi)} highlight />
        <CalcRow label="Cap Rate" value={fmt(capRate) + "%"} />
        <CalcRow label="Yield on Cost" value={fmt(yoc) + "%"} />
        <CalcRow label="Cash-on-Cash" value={fmt(coc) + "%"} />
        <CalcRow label="DSCR" value={fmt(dscr, 2) + "x"} />
        <CalcRow label="Project Profit" value={fmtD(profit)} />
        <CalcRow label="Profit Margin" value={fmt(margin) + "%"} />
      </div>
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Educational screening tool only. Verify all assumptions with qualified professionals before making investment decisions.
        </p>
        <div className="flex gap-3 shrink-0">
          <QR url="https://realist.ca/tools/analyzer" size={44} label="analyzer" />
          <QR url="https://realist.ca/tools/rents" size={44} label="rents" />
        </div>
      </div>
    </SectionCard>
  );
}

function S10_NextMoves({ nb }: { nb: NB }) {
  return (
    <SectionCard num={10} title="Next Moves" printBreak={false}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        <div className="space-y-5">
          <div>
            <SectionLabel>Top 3 insights from today</SectionLabel>
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">{i}</div>
                  <input value={nb.data[`p10_insight_${i}`] || ""} onChange={e => nb.set(`p10_insight_${i}`, e.target.value)} placeholder={`Insight ${i}...`}
                    className="flex-1 bg-muted/50 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/40 border border-transparent focus:border-primary/20 placeholder:text-muted-foreground/40" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>People to follow up with</SectionLabel>
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md border border-border flex items-center justify-center text-muted-foreground text-xs shrink-0">{i}</div>
                  <input value={nb.data[`p10_followup_${i}`] || ""} onChange={e => nb.set(`p10_followup_${i}`, e.target.value)} placeholder="Name + action..."
                    className="flex-1 bg-muted/50 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/40 border border-transparent focus:border-primary/20 placeholder:text-muted-foreground/40" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Properties / markets to research</SectionLabel>
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <input key={i} value={nb.data[`p10_prop_${i}`] || ""} onChange={e => nb.set(`p10_prop_${i}`, e.target.value)} placeholder={`Property or market ${i}...`}
                  className="w-full bg-muted/50 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/40 border border-transparent focus:border-primary/20 placeholder:text-muted-foreground/40 block" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <SectionLabel>My next 72 hours</SectionLabel>
            <div className="space-y-2.5">
              <Check label="Run one deal through Realist.ca" id="p10_a1" nb={nb} />
              <Check label="Follow up with one team contact" id="p10_a2" nb={nb} />
              <Check label="Review zoning on target property" id="p10_a3" nb={nb} />
              <Check label="Listen to a podcast episode" id="p10_a4" nb={nb} />
              <Check label="Book a call / site review" id="p10_a5" nb={nb} />
              <Check label="Add notes to CRM / tracker" id="p10_a6" nb={nb} />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3" style={{ fontFamily: "var(--font-mono)" }}>Commitment statement</div>
            <div className="text-sm text-foreground space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground">By</span>
                <input value={nb.data.p10_commitment_date || ""} onChange={e => nb.set("p10_commitment_date", e.target.value)} placeholder="date"
                  className="bg-muted/50 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40 border border-transparent focus:border-primary/20 w-32" style={{ fontFamily: "var(--font-mono)" }} />
                <span className="text-muted-foreground">I will:</span>
              </div>
              <input value={nb.data.p10_commitment_action || ""} onChange={e => nb.set("p10_commitment_action", e.target.value)} placeholder="describe your commitment..."
                className="w-full bg-muted/50 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/40 border border-transparent focus:border-primary/20 placeholder:text-muted-foreground/40" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <QR url="https://realist.ca/community/events" size={48} label="events" />
            <QR url="https://realist.ca/newsletter" size={48} label="newsletter" />
            <QR url="https://realist.ca/tools/analyzer" size={48} label="analyzer" />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function Notebook() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const nb = useNB(isAuthenticated);

  const handlePrint = () => window.print();
  const handleReset = () => {
    if (confirm("Reset the workbook? All entered data will be erased.")) {
      localStorage.removeItem(LS_KEY);
      window.location.reload();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) return <AuthGate />;

  return (
    <>
      <style>{`
        @media print {
          @page { size: letter; margin: 0.65in; }
          nav, .nb-no-print { display: none !important; }
          .nb-print-only { display: flex !important; }
          .nb-print-break { page-break-after: always; break-after: page; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .nb-section { box-shadow: none !important; border: 1px solid #ddd !important; }
        }
        .nb-print-only { display: none; }
      `}</style>
      <SEO title="Field Notebook — Realist.ca" description="Your interactive multiplex investor field notebook. Notes, numbers, and next moves." noIndex />
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

          {/* Hero */}
          <div className="mb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-2" style={{ fontFamily: "var(--font-mono)" }}>Realist.ca</div>
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-2">Field Notebook</h1>
                <p className="text-muted-foreground text-base leading-relaxed max-w-xl">
                  Notes. Numbers. Next moves. Your interactive multiplex investing workbook — fills in as you go, saves automatically, prints as a PDF.
                </p>
              </div>
              <div className="flex gap-2 shrink-0 nb-no-print">
                <button onClick={handleReset}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  style={{ fontFamily: "var(--font-mono)" }}>
                  <RotateCcw className="w-3.5 h-3.5" /> Reset
                </button>
                <Link
                  href="/notebook/print"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  style={{ fontFamily: "var(--font-mono)" }}>
                  <Printer className="w-3.5 h-3.5" /> 5×8 Booklet
                </Link>
                <button onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-colors"
                  style={{ fontFamily: "var(--font-mono)" }}>
                  <Printer className="w-3.5 h-3.5" /> Print / PDF
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground nb-no-print" style={{ fontFamily: "var(--font-mono)" }}>
              {nb.saveStatus === "saving" ? (
                <><Loader2 className="w-3 h-3 animate-spin text-primary" /><span className="text-primary">Saving to your account…</span></>
              ) : nb.saveStatus === "saved" ? (
                <><CheckCircle className="w-3.5 h-3.5 text-green-500" /><span className="text-green-600 dark:text-green-400">Saved to your account</span></>
              ) : (
                <><div className="w-1.5 h-1.5 rounded-full bg-green-500" /><span>Saving to your account automatically</span></>
              )}
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            <S1_BelongsTo nb={nb} />
            <S2_About />
            <S3_MyWhy nb={nb} />
            <S4_PowerTeam nb={nb} />
            <S5_SiteSelection nb={nb} />
            <S6_ApprovalsRisk nb={nb} />
            <S7_ProjectChecklist nb={nb} />
            <S8_DealMap />
            <S9_DealAnalyzer nb={nb} />
            <S10_NextMoves nb={nb} />
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-border nb-no-print">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
                All content is for educational purposes only. Always verify assumptions with qualified real estate, legal, and financial professionals.
              </p>
              <div className="flex gap-2 shrink-0">
                <button onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  style={{ fontFamily: "var(--font-mono)" }}>
                  <RotateCcw className="w-3.5 h-3.5" /> Reset workbook
                </button>
                <button onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-colors"
                  style={{ fontFamily: "var(--font-mono)" }}>
                  <Printer className="w-3.5 h-3.5" /> Print / Export PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
