import { SEO } from "@/components/SEO";

const BRAND_RED = "#E8253A";
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, monospace";
const SANS = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function Logo() {
  return (
    <div style={{ fontSize: "6.5pt", fontWeight: 700, letterSpacing: "0.14em", fontFamily: MONO, color: BRAND_RED, marginBottom: "0.06in" }}>
      REALIST.CA
    </div>
  );
}

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "0.16in", paddingBottom: "0.07in", borderBottom: `1.5px solid ${BRAND_RED}` }}>
      <span style={{ fontFamily: MONO, fontSize: "7pt", color: BRAND_RED, fontWeight: 700 }}>{num}</span>
      <span style={{ fontSize: "10.5pt", fontWeight: 800, color: "#111", letterSpacing: "-0.02em" }}>{title}</span>
    </div>
  );
}

function FieldLine({ label, lines = 1, half }: { label?: string; lines?: number; half?: boolean }) {
  return (
    <div style={{ marginBottom: "0.13in", width: half ? "48%" : "100%" }}>
      {label && (
        <div style={{ fontSize: "6.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#777", fontFamily: MONO, marginBottom: "0.04in" }}>
          {label}
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ borderBottom: "1px solid #c0c0c0", height: "0.27in", marginBottom: i < lines - 1 ? "0.06in" : 0 }} />
      ))}
    </div>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.18in" }}>
      {children}
    </div>
  );
}

function CheckBox({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "5px", marginBottom: "5px" }}>
      <div style={{ width: "10px", height: "10px", border: "1.5px solid #555", borderRadius: "1px", flexShrink: 0, marginTop: "1px" }} />
      <span style={{ fontSize: "8pt", color: "#222", lineHeight: 1.35 }}>{label}</span>
    </div>
  );
}

function MiniLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "6.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#888", fontFamily: MONO, margin: "0.13in 0 0.07in" }}>
      {children}
    </div>
  );
}

function TeamRow({ role, prefilledName }: { role: string; prefilledName?: string }) {
  return (
    <div style={{ marginBottom: "0.1in", paddingBottom: "0.08in", borderBottom: "1px dotted #ddd" }}>
      <div style={{ fontSize: "6.5pt", fontWeight: 700, color: BRAND_RED, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.04in" }}>
        {role}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 0.15in" }}>
        <div>
          <div style={{ fontSize: "6pt", color: "#999", marginBottom: "0.02in" }}>Name / Company</div>
          <div style={{ borderBottom: "1px solid #c0c0c0", height: "0.22in", display: "flex", alignItems: "flex-end", paddingBottom: "2px" }}>
            {prefilledName && (
              <span style={{ fontSize: "7.5pt", color: "#ccc", fontStyle: "italic", paddingLeft: "2px" }}>{prefilledName}</span>
            )}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "6pt", color: "#999", marginBottom: "0.02in" }}>Phone / Email</div>
          <div style={{ borderBottom: "1px solid #c0c0c0", height: "0.22in" }} />
        </div>
      </div>
    </div>
  );
}

function RiskRow({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px", paddingBottom: "5px", borderBottom: "1px dotted #eee" }}>
      <span style={{ fontSize: "8pt", color: "#222" }}>{label}</span>
      <div style={{ display: "flex", gap: "8px" }}>
        {["Low", "Med", "High"].map(r => (
          <div key={r} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            <div style={{ width: "9px", height: "9px", border: "1.5px solid #888", borderRadius: "1px" }} />
            <span style={{ fontSize: "6.5pt", fontFamily: MONO, color: "#666" }}>{r}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PAGE: React.CSSProperties = {
  fontFamily: SANS,
  color: "#111",
  background: "#fff",
};

export default function NotebookPrint() {
  return (
    <>
      <SEO
        title="Field Notebook — 5×8 Print Template | Realist.ca"
        description="Printable 5x8 field notebook template for real estate walkthroughs, client notes, and deal screening."
        noIndex
      />
      <style>{`
        @page { size: 5in 8in; margin: 0.38in 0.4in; }
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; padding: 0; background: white; font-size: 9pt; }

        @media screen {
          body { background: #e8e8e8; padding: 24px 0; }
          .nb-page {
            background: white;
            width: 5in;
            min-height: 8in;
            margin: 0 auto 24px;
            padding: 0.38in 0.4in;
            box-shadow: 0 2px 12px rgba(0,0,0,0.18);
            position: relative;
          }
          .print-toolbar {
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 999;
            display: flex;
            gap: 8px;
          }
        }

        @media print {
          body { background: white; padding: 0; }
          .nb-page {
            page-break-after: always;
            break-after: page;
          }
          .nb-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          .print-toolbar { display: none !important; }
        }
      `}</style>

      {/* Toolbar — screen only */}
      <div className="print-toolbar">
        <button
          onClick={() => window.print()}
          style={{ background: BRAND_RED, color: "#fff", border: "none", padding: "9px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: 700, fontSize: "13px", fontFamily: SANS }}
        >
          Print / Save PDF
        </button>
        <a
          href="/notebook"
          style={{ background: "#f0f0f0", color: "#333", border: "none", padding: "9px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: 500, fontSize: "13px", textDecoration: "none", display: "inline-flex", alignItems: "center", fontFamily: SANS }}
        >
          ← Back to Notebook
        </a>
      </div>

      {/* ── COVER ─────────────────────────────────────────── */}
      <div className="nb-page" style={{ ...PAGE, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "8in" }}>
        <div>
          <Logo />
          <div style={{ width: "36px", height: "3px", background: BRAND_RED, margin: "0.08in 0 0.28in" }} />
          <h1 style={{ fontSize: "30pt", fontWeight: 900, lineHeight: 1.0, letterSpacing: "-0.03em", color: "#111", marginBottom: "0.08in" }}>
            Field<br />Notebook
          </h1>
          <p style={{ fontSize: "11pt", fontWeight: 300, color: "#666", marginBottom: "0.4in" }}>
            Multiplex Investing Workbook
          </p>
          <p style={{ fontSize: "9pt", color: "#888", fontStyle: "italic", lineHeight: 1.7 }}>
            "Notes. Numbers. Next moves."
          </p>
        </div>
        <div>
          <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: "0.15in" }}>
            <FieldLine label="Name" />
            <TwoCol>
              <FieldLine label="Date" />
              <FieldLine label="Event" />
            </TwoCol>
          </div>
          <p style={{ fontSize: "6.5pt", color: "#bbb", fontFamily: MONO, marginTop: "0.12in" }}>
            realist.ca/notebook · Educational purposes only
          </p>
        </div>
      </div>

      {/* ── §01 BELONGS TO ────────────────────────────────── */}
      <div className="nb-page" style={PAGE}>
        <Logo />
        <SectionHeader num="01" title="This Notebook Belongs To" />
        <TwoCol>
          <FieldLine label="Name" />
          <FieldLine label="Email" />
          <FieldLine label="Phone" />
          <FieldLine label="City / Market" />
          <FieldLine label="Event" />
          <FieldLine label="Date" />
        </TwoCol>
        <MiniLabel>My Investing Focus</MiniLabel>
        <TwoCol>
          {["Duplex / Triplex / Fourplex", "Garden suite / Laneway", "Small multifamily", "BRRRR / Value-add", "Development / Infill", "Other"].map(l => (
            <CheckBox key={l} label={l} />
          ))}
        </TwoCol>
        <MiniLabel>Anything important coming into this event?</MiniLabel>
        <FieldLine lines={3} />
        <MiniLabel>I'm hoping to leave with…</MiniLabel>
        <FieldLine lines={2} />
      </div>

      {/* ── §03 MY WHY ────────────────────────────────────── */}
      <div className="nb-page" style={PAGE}>
        <Logo />
        <SectionHeader num="03" title="My Why — Goals & Mindset" />
        <FieldLine label="Why am I building a multiplex portfolio?" lines={2} />
        <FieldLine label="5-year target (units / cash flow / net worth)" lines={2} />
        <FieldLine label="Resources I bring (capital, time, skills, network)" lines={2} />
        <MiniLabel>My Primary Strategy</MiniLabel>
        <TwoCol>
          {["Buy & hold", "BRRRR", "Flip", "Airbnb / STR", "Development / build", "Hybrid"].map(l => (
            <CheckBox key={l} label={l} />
          ))}
        </TwoCol>
        <MiniLabel>Deal criteria (price range, markets, asset type)</MiniLabel>
        <FieldLine lines={2} />
        <MiniLabel>My biggest blocker right now</MiniLabel>
        <FieldLine lines={2} />
      </div>

      {/* ── §04 POWER TEAM (1) ────────────────────────────── */}
      <div className="nb-page" style={PAGE}>
        <Logo />
        <SectionHeader num="04" title="Power Team Builder" />
        <p style={{ fontSize: "7.5pt", color: "#777", marginBottom: "0.14in" }}>
          Capture people who can help you find, fund, design, build, approve, manage, or exit better projects.
        </p>
        <TeamRow role="Realtor" prefilledName="Daniel Foch" />
        <TeamRow role="Mortgage Broker / Lender" prefilledName="Nick Hill" />
        <TeamRow role="Lawyer" />
        <TeamRow role="Accountant" />
        <TeamRow role="Planner" />
        <TeamRow role="Architect / Designer" />
      </div>

      {/* ── §04 POWER TEAM (2) ────────────────────────────── */}
      <div className="nb-page" style={PAGE}>
        <Logo />
        <SectionHeader num="04" title="Power Team (continued)" />
        <TeamRow role="Builder / GC" />
        <TeamRow role="Engineer" />
        <TeamRow role="Appraiser" />
        <TeamRow role="Insurance Broker" />
        <TeamRow role="Property Manager" />
        <TeamRow role="Mentor / Investor" />
        <MiniLabel>Follow-up within 48 hours</MiniLabel>
        <TwoCol>
          {["Send intro email / text", "Book a call", "Share a property", "Ask for a quote", "Add to CRM"].map(l => (
            <CheckBox key={l} label={l} />
          ))}
        </TwoCol>
      </div>

      {/* ── §05 SITE SELECTION ────────────────────────────── */}
      <div className="nb-page" style={PAGE}>
        <Logo />
        <SectionHeader num="05" title="Site Selection Checklist" />
        <p style={{ fontSize: "7.5pt", color: "#777", marginBottom: "0.12in" }}>
          Can I plex it as-of-right — or am I walking into approvals risk?
        </p>
        <TwoCol>
          <FieldLine label="Address" />
          <FieldLine label="Municipality" />
          <FieldLine label="Lot Frontage" />
          <FieldLine label="Lot Depth" />
          <FieldLine label="Lot Area" />
          <FieldLine label="Current Zoning" />
          <FieldLine label="Est. Allowed Units" />
          <FieldLine label="Est. Buildable GFA" />
        </TwoCol>
        <MiniLabel>Zoning Status</MiniLabel>
        <TwoCol>
          {["Permitted as-of-right", "Minor variance needed", "Full rezoning needed", "Heritage / overlay constraints"].map(l => (
            <CheckBox key={l} label={l} />
          ))}
        </TwoCol>
        <MiniLabel>Infrastructure Notes</MiniLabel>
        <FieldLine lines={2} />
        <MiniLabel>Competitive Benchmark</MiniLabel>
        <TwoCol>
          <FieldLine label="Market Cap Rate" />
          <FieldLine label="Est. ARV (per unit)" />
          <FieldLine label="Est. Rent (per unit/mo)" />
          <FieldLine label="Comparable Sale ($/unit)" />
        </TwoCol>
      </div>

      {/* ── §06 APPROVALS & RISK ──────────────────────────── */}
      <div className="nb-page" style={PAGE}>
        <Logo />
        <SectionHeader num="06" title="Approvals & Risk Matrix" />
        <MiniLabel>Pre-Submission Checklist</MiniLabel>
        <TwoCol>
          {[
            "Confirm zoning / by-law", "Check official plan",
            "Identify heritage overlay", "Confirm lot coverage max",
            "Check setback requirements", "Verify servicing capacity",
            "Talk to planner", "Engage architect",
            "Pre-app meeting booked", "Community consultation",
          ].map(l => <CheckBox key={l} label={l} />)}
        </TwoCol>
        <MiniLabel>Risk Assessment</MiniLabel>
        {["Zoning / approval risk", "Financing risk", "Construction cost risk", "Market / rent risk", "Timeline risk"].map(l => (
          <RiskRow key={l} label={l} />
        ))}
        <MiniLabel>Mitigation Notes</MiniLabel>
        <FieldLine lines={2} />
      </div>

      {/* ── §07 PROJECT CHECKLIST ─────────────────────────── */}
      <div className="nb-page" style={PAGE}>
        <Logo />
        <SectionHeader num="07" title="Project Checklist" />
        {[
          { phase: "Due Diligence", items: ["Title search", "Survey ordered", "Phase 1 ESA", "Home inspection", "Tenants identified", "Income / expense verified"] },
          { phase: "Design & Permits", items: ["Architect engaged", "Drawings issued", "Permit submitted", "Permit approved", "Trades quoted"] },
          { phase: "Financing", items: ["Lender identified", "Appraisal ordered", "Draw schedule agreed", "Commitment letter signed"] },
          { phase: "Construction", items: ["Site safety plan", "Milestones set", "Budget tracker live", "Inspections booked"] },
          { phase: "Stabilization", items: ["Occupancy permit", "Tenants in place", "Final draw submitted", "Refinance / exit executed"] },
        ].map(({ phase, items }) => (
          <div key={phase} style={{ marginBottom: "0.1in" }}>
            <div style={{ fontSize: "6.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: BRAND_RED, fontFamily: MONO, marginBottom: "0.05in" }}>
              {phase}
            </div>
            <TwoCol>
              {items.map(l => <CheckBox key={l} label={l} />)}
            </TwoCol>
          </div>
        ))}
      </div>

      {/* ── §08 QUICK FORMULAS ────────────────────────────── */}
      <div className="nb-page" style={PAGE}>
        <Logo />
        <SectionHeader num="08" title="Quick Formulas" />
        <p style={{ fontSize: "7.5pt", color: "#777", marginBottom: "0.14in" }}>
          Rough math for screening. Full underwriting at realist.ca/tools/analyzer
        </p>
        {[
          { title: "Total Project Cost (TPC)", formula: "Purchase + Closing + Hard Costs + Soft Costs + Financing" },
          { title: "Net Operating Income (NOI)", formula: "Gross Rent − Vacancy − Operating Expenses" },
          { title: "Cap Rate", formula: "NOI ÷ Purchase Price × 100" },
          { title: "Yield on Cost (YoC)", formula: "Stabilized NOI ÷ Total Project Cost × 100" },
          { title: "Cash-on-Cash Return", formula: "Annual Pre-Tax Cash Flow ÷ Cash Invested × 100" },
          { title: "DSCR", formula: "NOI ÷ Annual Debt Service (target ≥ 1.10)" },
          { title: "Project Profit", formula: "Projected ARV − Total Project Cost" },
          { title: "Rough GFA", formula: "Lot Area × Permitted FSI = Est. Gross Floor Area" },
        ].map(({ title, formula }) => (
          <div key={title} style={{ marginBottom: "0.11in", paddingLeft: "0.1in", borderLeft: `2px solid ${BRAND_RED}` }}>
            <div style={{ fontSize: "6.5pt", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#777", fontFamily: MONO, marginBottom: "0.02in" }}>{title}</div>
            <div style={{ fontSize: "8pt", fontFamily: MONO, color: "#222", lineHeight: 1.3 }}>{formula}</div>
          </div>
        ))}
        <div style={{ borderTop: "1px solid #eee", marginTop: "0.15in", paddingTop: "0.1in" }}>
          <p style={{ fontSize: "6.5pt", color: "#aaa", fontFamily: MONO }}>
            Cap Rates Explorer → realist.ca/tools/cap-rates<br />
            Multiplex Feasibility → realist.ca/tools/multiplex-feasibility
          </p>
        </div>
      </div>

      {/* ── §09 DEAL SNAPSHOT ─────────────────────────────── */}
      <div className="nb-page" style={PAGE}>
        <Logo />
        <SectionHeader num="09" title="Deal Snapshot" />
        <p style={{ fontSize: "7.5pt", color: "#777", marginBottom: "0.12in" }}>
          Back-of-envelope on one deal. Full underwriting at realist.ca/tools/analyzer
        </p>
        <MiniLabel>Acquisition</MiniLabel>
        <TwoCol>
          <FieldLine label="Purchase Price ($)" />
          <FieldLine label="Closing Costs ($)" />
          <FieldLine label="Hard Costs / Reno ($)" />
          <FieldLine label="Soft Costs ($)" />
          <FieldLine label="Financing Costs ($)" />
          <FieldLine label="Total Project Cost ($)" />
        </TwoCol>
        <MiniLabel>Income &amp; Returns</MiniLabel>
        <TwoCol>
          <FieldLine label="Monthly Rent — all units ($)" />
          <FieldLine label="Vacancy Rate (%)" />
          <FieldLine label="Annual Operating Expenses ($)" />
          <FieldLine label="NOI ($)" />
          <FieldLine label="Cap Rate (%)" />
          <FieldLine label="Yield on Cost (%)" />
        </TwoCol>
        <MiniLabel>Exit / ARV</MiniLabel>
        <TwoCol>
          <FieldLine label="Projected ARV ($)" />
          <FieldLine label="Project Profit ($)" />
        </TwoCol>
      </div>

      {/* ── §10 NEXT MOVES ────────────────────────────────── */}
      <div className="nb-page" style={PAGE}>
        <Logo />
        <SectionHeader num="10" title="Next Moves" />
        <p style={{ fontSize: "7.5pt", color: "#777", marginBottom: "0.14in" }}>
          Leave with a plan, not just notes. What are the 3 things you'll do in the next 7 days?
        </p>
        <MiniLabel>Top 3 Actions This Week</MiniLabel>
        {[1, 2, 3].map(n => (
          <div key={n} style={{ marginBottom: "0.15in" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <div style={{ width: "17px", height: "17px", borderRadius: "50%", border: `1.5px solid ${BRAND_RED}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                <span style={{ fontSize: "7.5pt", fontWeight: 700, color: BRAND_RED }}>{n}</span>
              </div>
              <div style={{ flex: 1, borderBottom: "1px solid #c0c0c0", height: "0.24in" }} />
            </div>
            <div style={{ paddingLeft: "25px", marginTop: "0.05in" }}>
              <TwoCol>
                <FieldLine label="Deadline" />
                <FieldLine label="Who can help?" />
              </TwoCol>
            </div>
          </div>
        ))}
        <MiniLabel>30-Day Goals</MiniLabel>
        <FieldLine lines={2} />
        <MiniLabel>1 Property I'm Underwriting</MiniLabel>
        <FieldLine label="Address / MLS#" />
        <FieldLine label="Notes" lines={2} />
      </div>

      {/* ── BACK COVER ────────────────────────────────────── */}
      <div className="nb-page" style={{ ...PAGE, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "8in" }}>
        <div>
          <Logo />
          <div style={{ width: "36px", height: "3px", background: BRAND_RED, margin: "0.08in 0 0.3in" }} />
          <p style={{ fontSize: "13.5pt", fontWeight: 700, lineHeight: 1.35, color: "#111", marginBottom: "0.2in" }}>
            "The best deal is the one you actually close."
          </p>
          <p style={{ fontSize: "9pt", color: "#666", lineHeight: 1.7, marginBottom: "0.3in" }}>
            Run full underwriting at<br />
            <strong style={{ color: BRAND_RED }}>realist.ca/tools/analyzer</strong>
          </p>
          <p style={{ fontSize: "9pt", color: "#666", lineHeight: 1.7 }}>
            Explore cap rates at<br />
            <strong style={{ color: BRAND_RED }}>realist.ca/tools/cap-rates</strong>
          </p>
        </div>
        <div>
          <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: "0.14in" }}>
            <p style={{ fontSize: "6.5pt", color: "#bbb", lineHeight: 1.7, fontFamily: MONO }}>
              realist.ca · The Canadian Real Estate Investor Podcast<br />
              Hosted by Daniel Foch &amp; Nick Hill<br />
              For educational purposes only. Not financial or legal advice.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
