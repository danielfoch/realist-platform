import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

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

function analyzeTorontoProperty(address: string): PropertyReport {
  const addressLower = address.toLowerCase();
  const sections: ReportSection[] = [];
  
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
      content: "Property appears to be on or near a major arterial road. Potential for 4+ units under current multiplex policies.",
      type: "positive",
    });
  } else if (isEastYork || isScarboroughNorth) {
    sections.push({
      title: "Main Building Potential",
      content: "In an eligible area for 5-6 unit multiplexes (Toronto & East York or Ward 23 Scarborough North).",
      type: "positive",
    });
  } else {
    sections.push({
      title: "Main Building Potential",
      content: "In a standard low-rise residential area. Eligible for up to 4 units under Toronto's multiplex policy.",
      type: "info",
    });
  }

  sections.push({
    title: "Accessory Unit Potential",
    content: "One accessory dwelling may be permitted (either a laneway suite OR a garden suite, not both). Garden suites require minimum 9m rear yard depth.",
    type: "info",
  });

  sections.push({
    title: "Severance / Upside Potential",
    content: "Severance requires minimum 12m frontage for single-family lots. Corner lots have better severance potential.",
    type: "warning",
  });

  if (hasMajorStreet) {
    sections.push({
      title: "Major Street Opportunity",
      content: "Property is on a major street. May be eligible for low-rise apartment buildings (up to 6 storeys in some areas).",
      type: "positive",
    });
  } else {
    sections.push({
      title: "Major Street Opportunity",
      content: "Property does not appear to be on a major street. Check zoning by-law for verification.",
      type: "info",
    });
  }

  sections.push({
    title: "Risk Flags",
    content: "• Heritage designation may restrict modifications\n• Environmental hazards may require assessment\n• Flood-prone areas have additional restrictions\n• Consult Committee of Adjustment for variance requirements",
    type: "warning",
  });

  const disclaimer = "This is a preliminary screening only, not a formal zoning confirmation. Always verify with the City of Toronto.";
  let score = 65;
  if (hasMajorStreet) score += 15;
  if (isEastYork || isScarboroughNorth) score += 10;
  score = Math.min(score, 100);

  return { address, score, sections, disclaimer };
}

function getLead(): LeadData | null {
  const stored = localStorage.getItem("6ixplex_lead");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

function clearLead(): void {
  localStorage.removeItem("6ixplex_lead");
  sessionStorage.removeItem("6ixplex_session");
}

export function SixixplexReportPage() {
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadData | null>(null);
  const [report, setReport] = useState<PropertyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedLead = getLead();
    if (!storedLead) {
      navigate("/6ixplex");
      return;
    }
    setLead(storedLead);
    const generatedReport = analyzeTorontoProperty(storedLead.address);
    setReport(generatedReport);
    setIsLoading(false);
  }, [navigate]);

  function handleNewSearch() {
    clearLead();
    navigate("/6ixplex");
  }

  if (isLoading || !lead || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#E2E8F0] border-t-[#F59E0B] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#64748B]">Generating your report...</p>
        </div>
      </div>
    );
  }

  const typeStyles = {
    positive: "bg-emerald-50 border-emerald-200 text-emerald-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#0F172A] cursor-pointer" onClick={handleNewSearch}>
            6ixplex
          </h1>
          <div className="flex items-center gap-4">
            <a href="/6ixplex/listings" className="text-[#F59E0B] text-sm font-medium">
              Browse Listings →
            </a>
            <button
              onClick={handleNewSearch}
              className="px-4 py-2 border border-[#E2E8F0] rounded-md text-sm text-[#64748B]"
            >
              New Search
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-[#64748B]">Property Report</p>
              <h2 className="text-xl font-bold text-[#0F172A]">{lead?.address}</h2>
            </div>
            <div className="text-right">
              <p className="text-sm text-[#64748B]">Potential Score</p>
              <p className="text-3xl font-bold text-[#F59E0B]">{report.score}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {report.sections.map((section, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border ${typeStyles[section.type as keyof typeof typeStyles]}`}
            >
              <h3 className="font-semibold mb-2">{section.title}</h3>
              <p className="text-sm whitespace-pre-line">{section.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-[#64748B]">{report.disclaimer}</p>
        </div>
      </main>
    </div>
  );
}