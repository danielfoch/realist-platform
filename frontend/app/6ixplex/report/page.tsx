"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Types
interface LeadData {
  id: string;
  address: string;
  fullName: string;
  phone: string;
  source?: string;
  createdAt: number;
  sessionToken: string;
}

interface ReportSection {
  title: string;
  content: string;
  type: "positive" | "warning" | "info";
}

interface PropertyReport {
  address: string;
  score: number;
  sections: ReportSection[];
  disclaimer: string;
}

// Toronto underwriting logic
function analyzeTorontoProperty(address: string): PropertyReport {
  const addressLower = address.toLowerCase();
  
  // Default analysis (mock data for MVP)
  // In production, this would call zoning APIs
  
  const sections: ReportSection[] = [];
  
  // Main Building Potential
  const hasMajorStreet = addressLower.includes("yonge") || 
                         addressLower.includes("dundas") || 
                         addressLower.includes("king") ||
                         addressLower.includes("bloor") ||
                         addressLower.includes("queen");
  
  const isEastYork = addressLower.includes("east york") || addressLower.includes("toronto");
  const isScarboroughNorth = addressLower.includes("scarborough") && addressLower.includes("north");
  
  if (hasMajorStreet) {
    sections.push({
      title: "Main Building Potential",
      content: "Property appears to be on or near a major arterial road. Potential for 4+ units under current multiplex policies. Major streets typically have more flexibility for multi-unit residential development.",
      type: "positive",
    });
  } else if (isEastYork || isScarboroughNorth) {
    sections.push({
      title: "Main Building Potential",
      content: "In an eligible area for 5-6 unit multiplexes (Toronto & East York or Ward 23 Scarborough North). Could support up to 6 residential units depending on lot size and existing improvements.",
      type: "positive",
    });
  } else {
    sections.push({
      title: "Main Building Potential",
      content: "In a standard low-rise residential area. Eligible for up to 4 units under Toronto's multiplex policy. Final unit count depends on lot dimensions, existing structure, and parking requirements.",
      type: "info",
    });
  }

  // Accessory Unit Potential
  sections.push({
    title: "Accessory Unit Potential",
    content: "One accessory dwelling may be permitted (either a laneway suite OR a garden suite, not both). Garden suites require minimum 9m rear yard depth. Laneway suites require lane access. Check with Committee of Adjustment for lot-specific requirements.",
    type: "info",
  });

  // Severance/Upside
  sections.push({
    title: "Severance / Upside Potential",
    content: "Severance (creating a new lot) requires: minimum 12m frontage for single-family lots, 15m+ for townhouses. Corner lots have better severance potential. This is a preliminary heuristic screen only - formal application to Committee of Adjustment required.",
    type: "warning",
  });

  // Major Street Opportunity
  if (hasMajorStreet) {
    sections.push({
      title: "Major Street Opportunity",
      content: "Property is on or near a major street. Major streets have different (often more permissive) zoning rules. May be eligible for low-rise apartment buildings (up to 6 storeys in some areas). Recommend detailed zoning review.",
      type: "positive",
    });
  } else {
    sections.push({
      title: "Major Street Opportunity",
      content: "Property does not appear to be on a major street. If you believe this is incorrect, verify with the zoning by-law. Major streets are designated in Toronto's Official Plan.",
      type: "info",
    });
  }

  // Risk Flags
  sections.push({
    title: "Risk Flags",
    content: "• Heritage designation may restrict modifications\n• Environmental hazards (e.g., former industrial use) may require assessment\n• Flood-prone areas have additional building restrictions\n• Some zones have rental housing replacement requirements\n• Consult Committee of Adjustment for variance requirements",
    type: "warning",
  });

  // Disclaimer
  const disclaimer = "This is a preliminary screening only, not a formal zoning confirmation. Actual development potential depends on site-specific conditions, current zoning by-laws, Committee of Adjustment decisions, and other factors. Always verify with the City of Toronto and consult a qualified professional before making investment decisions.";

  // Calculate score (mock)
  let score = 65;
  if (hasMajorStreet) score += 15;
  if (isEastYork || isScarboroughNorth) score += 10;
  score = Math.min(score, 100);

  return {
    address,
    score,
    sections,
    disclaimer,
  };
}

// Storage helpers
function getLead(): LeadData | null {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("6ixplex_lead");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function clearLead(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("6ixplex_lead");
    sessionStorage.removeItem("6ixplex_session");
  }
}

export default function ReportPage() {
  const router = useRouter();
  const [lead, setLead] = useState<LeadData | null>(null);
  const [report, setReport] = useState<PropertyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedLead = getLead();
    
    if (!storedLead) {
      // No lead, redirect to homepage
      router.push("/");
      return;
    }

    setLead(storedLead);
    
    // Generate report
    const generatedReport = analyzeTorontoProperty(storedLead.address);
    setReport(generatedReport);
    setIsLoading(false);
  }, [router]);

  function handleNewSearch() {
    clearLead();
    router.push("/");
  }

  if (isLoading || !lead || !report) {
    return (
      <div 
        className="min-h-screen" 
        style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          background: "var(--background)" 
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div 
            style={{ 
              width: "40px", 
              height: "40px", 
              border: "3px solid var(--border)",
              borderTopColor: "var(--accent)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px"
            }} 
          />
          <p style={{ color: "var(--text-secondary)" }}>Generating your report...</p>
        </div>
        <style jsx global>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header className="py-4" style={{ borderBottom: "1px solid var(--border)", background: "white" }}>
        <div className="container">
          <div className="flex items-center justify-between">
            <h1 
              onClick={handleNewSearch}
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "var(--primary)",
                margin: 0,
                cursor: "pointer",
              }}
            >
              6ixplex
            </h1>
            <div className="flex items-center gap-4">
              <a 
                href="/listings"
                style={{ 
                  color: "var(--accent)", 
                  textDecoration: "none", 
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                Browse Listings →
              </a>
              <button
                onClick={handleNewSearch}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "14px",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                }}
              >
                New Search
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Report Content */}
      <main className="py-8">
        <div className="container">
          {/* Report Header */}
          <div className="card mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                  Property Report
                </p>
                <h2 style={{ fontSize: "24px", fontWeight: 600, color: "var(--primary)", margin: 0 }}>
                  {report.address}
                </h2>
                {lead.source && (
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Source: {lead.source}
                  </p>
                )}
              </div>
              <div style={{ textAlign: "center" }}>
                <div 
                  style={{
                    width: "80px",
                    height: "80px",
                    borderRadius: "50%",
                    background: report.score >= 70 ? "var(--success)" : report.score >= 50 ? "var(--warning)" : "var(--error)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto",
                  }}
                >
                  <span style={{ fontSize: "28px", fontWeight: 700, color: "white" }}>
                    {report.score}
                  </span>
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "8px" }}>
                  Potential Score
                </p>
              </div>
            </div>
          </div>

          {/* Report Sections */}
          <div className="space-y-4 mb-8">
            {report.sections.map((section, index) => (
              <div key={index} className="card">
                <div className="flex items-start gap-3">
                  <div 
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      marginTop: "8px",
                      background: section.type === "positive" 
                        ? "var(--success)" 
                        : section.type === "warning" 
                          ? "var(--warning)" 
                          : "var(--secondary)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--primary)", marginBottom: "8px" }}>
                      {section.title}
                    </h3>
                    <p style={{ fontSize: "15px", color: "var(--text-secondary)", whiteSpace: "pre-line", margin: 0 }}>
                      {section.content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div 
            className="card" 
            style={{ 
              background: "#FEF3C7", 
              borderColor: "#F59E0B",
            }}
          >
            <div className="flex items-start gap-3">
              <span style={{ fontSize: "20px" }}>⚠️</span>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--primary)", marginBottom: "8px" }}>
                  Important Disclaimer
                </h3>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)", margin: 0 }}>
                  {report.disclaimer}
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-8">
            <a 
              href="/listings"
              className="btn-primary"
              style={{ 
                display: "inline-block",
                textDecoration: "none",
                padding: "16px 32px",
                fontSize: "16px",
              }}
            >
              Browse Toronto Multiplex Listings →
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ padding: "32px 0", borderTop: "1px solid var(--border)", marginTop: "48px" }}>
        <div className="container">
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", textAlign: "center" }}>
            © 2026 6ixplex. Toronto multiplex screening tool. Not affiliated with the City of Toronto.
          </p>
        </div>
      </footer>
    </div>
  );
}