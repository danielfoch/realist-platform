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

interface Listing {
  id: string;
  address: string;
  price: number;
  units: number;
  type: string;
  sqft: number;
  description: string;
  underwriting: {
    mainBuilding: string;
    accessory: string;
    severance: string;
  };
}

// Mock listings data
const mockListings: Listing[] = [
  {
    id: "1",
    address: "245 Danforth Ave, Toronto, ON",
    price: 1850000,
    units: 4,
    type: "Multiplex",
    sqft: 2800,
    description: "Character fourplex in Danforth Village. Recently renovated units with separate entrances.",
    underwriting: {
      mainBuilding: "4 units confirmed under R2 zoning",
      accessory: "Garden suite eligible (12m rear yard)",
      severance: "Good potential - 14m frontage",
    },
  },
  {
    id: "2",
    address: "88 Monarch Park Ave, Toronto, ON",
    price: 2100000,
    units: 5,
    type: "Multiplex",
    sqft: 3200,
    description: "Five-unit building in East York. All units currently occupied with strong rental history.",
    underwriting: {
      mainBuilding: "5-6 unit eligible area (East York)",
      accessory: "Laneway suite eligible",
      severance: "Corner lot - excellent potential",
    },
  },
  {
    id: "3",
    address: "1567 Queen St W, Toronto, ON",
    price: 2450000,
    units: 4,
    type: "Multiplex",
    sqft: 2600,
    description: "Prime Queen West location. Mixed-use potential with commercial frontage.",
    underwriting: {
      mainBuilding: "Major street - up to 6 units possible",
      accessory: "Limited - verify rear yard depth",
      severance: "Narrow lot - challenging",
    },
  },
  {
    id: "4",
    address: "42 Birch Ave, Scarborough, ON",
    price: 1450000,
    units: 6,
    type: "Multiplex",
    sqft: 3500,
    description: "Six-plex in Ward 23 Scarborough North. Long-term tenanted building.",
    underwriting: {
      mainBuilding: "6 units confirmed (Ward 23 eligible)",
      accessory: "Garden suite possible",
      severance: "Good frontage for severance",
    },
  },
  {
    id: "5",
    address: "301 Montrose St, Toronto, ON",
    price: 1690000,
    units: 4,
    type: "Multiplex",
    sqft: 2400,
    description: "Fully detached fourplex in Little Portugal. New roof and windows 2024.",
    underwriting: {
      mainBuilding: "4 units standard R2",
      accessory: "Laneway suite potential",
      severance: "Average frontage",
    },
  },
];

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

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function ListingsPage() {
  const router = useRouter();
  const [lead, setLead] = useState<LeadData | null>(null);
  const [listings] = useState<Listing[]>(mockListings);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedLead = getLead();
    
    if (!storedLead) {
      // No lead, redirect to homepage
      router.push("/");
      return;
    }

    setLead(storedLead);
    setIsLoading(false);
  }, [router]);

  function handleNewSearch() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("6ixplex_lead");
      sessionStorage.removeItem("6ixplex_session");
    }
    router.push("/");
  }

  const filteredListings = filter === "all" 
    ? listings 
    : listings.filter(l => l.units.toString() === filter);

  if (isLoading) {
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
          <p style={{ color: "var(--text-secondary)" }}>Loading listings...</p>
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
              <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                Welcome, {lead?.fullName}
              </span>
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

      {/* Main Content */}
      <main className="py-8">
        <div className="container">
          {/* Page Header */}
          <div className="mb-8">
            <h2 style={{ fontSize: "32px", fontWeight: 600, color: "var(--primary)", marginBottom: "8px" }}>
              Toronto Multiplex Listings
            </h2>
            <p style={{ fontSize: "16px", color: "var(--text-secondary)" }}>
              {listings.length} properties available with underwriting analysis
            </p>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {["all", "4", "5", "6"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid",
                  borderColor: filter === f ? "var(--accent)" : "var(--border)",
                  background: filter === f ? "var(--accent)" : "white",
                  color: filter === f ? "white" : "var(--text-secondary)",
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 200ms ease-out",
                }}
              >
                {f === "all" ? "All Units" : `${f} Units`}
              </button>
            ))}
          </div>

          {/* Listings Grid */}
          <div 
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "24px",
            }}
          >
            {filteredListings.map((listing) => (
              <div 
                key={listing.id}
                onClick={() => setSelectedListing(listing)}
                className="card"
                style={{ cursor: "pointer", transition: "all 200ms ease-out" }}
              >
                {/* Placeholder Image */}
                <div 
                  style={{
                    height: "160px",
                    background: "linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)",
                    borderRadius: "6px",
                    marginBottom: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-secondary)",
                    fontSize: "14px",
                  }}
                >
                  Property Image
                </div>

                {/* Address */}
                <h3 style={{ fontSize: "18px", fontWeight: 600, color: "var(--primary)", marginBottom: "8px" }}>
                  {listing.address}
                </h3>

                {/* Price & Units */}
                <div className="flex items-center justify-between mb-4">
                  <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--primary)" }}>
                    {formatPrice(listing.price)}
                  </span>
                  <span 
                    style={{
                      padding: "4px 10px",
                      background: "var(--accent)",
                      color: "white",
                      borderRadius: "4px",
                      fontSize: "13px",
                      fontWeight: 500,
                    }}
                  >
                    {listing.units} Units
                  </span>
                </div>

                {/* Details */}
                <div className="flex gap-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <span>{listing.type}</span>
                  <span>•</span>
                  <span>{listing.sqft.toLocaleString()} sqft</span>
                </div>

                {/* Underwriting Summary */}
                <div 
                  style={{ 
                    marginTop: "16px", 
                    paddingTop: "16px", 
                    borderTop: "1px solid var(--border)" 
                  }}
                >
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                    Underwriting Summary
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span 
                      style={{
                        padding: "4px 8px",
                        background: "#D1FAE5",
                        color: "#065F46",
                        borderRadius: "4px",
                        fontSize: "12px",
                      }}
                    >
                      Main: {listing.underwriting.mainBuilding.split(" ")[0]} {listing.underwriting.mainBuilding.split(" ")[1]}
                    </span>
                    <span 
                      style={{
                        padding: "4px 8px",
                        background: "#DBEAFE",
                        color: "#1E40AF",
                        borderRadius: "4px",
                        fontSize: "12px",
                      }}
                    >
                      Accessory: {listing.underwriting.accessory.split(" ")[0]}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredListings.length === 0 && (
            <div className="text-center py-12">
              <p style={{ color: "var(--text-secondary)" }}>No listings match your filter.</p>
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedListing && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 100,
          }}
          onClick={() => setSelectedListing(null)}
        >
          <div 
            className="card"
            style={{ maxWidth: "600px", width: "100%", maxHeight: "90vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <h3 style={{ fontSize: "24px", fontWeight: 600, color: "var(--primary)", margin: 0 }}>
                {selectedListing.address}
              </h3>
              <button
                onClick={() => setSelectedListing(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  padding: "0",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <div className="flex items-center justify-between mb-4">
                <span style={{ fontSize: "28px", fontWeight: 700, color: "var(--primary)" }}>
                  {formatPrice(selectedListing.price)}
                </span>
                <span 
                  style={{
                    padding: "6px 14px",
                    background: "var(--accent)",
                    color: "white",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  {selectedListing.units} Units
                </span>
              </div>
              <p style={{ color: "var(--text-secondary)" }}>
                {selectedListing.description}
              </p>
            </div>

            {/* Underwriting Analysis */}
            <div style={{ marginBottom: "24px" }}>
              <h4 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>
                Underwriting Analysis
              </h4>
              
              <div className="space-y-4">
                <div style={{ padding: "12px", background: "#F0FDF4", borderRadius: "6px", border: "1px solid #BBF7D0" }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#166534", marginBottom: "4px" }}>
                    Main Building Potential
                  </p>
                  <p style={{ fontSize: "14px", color: "#15803D", margin: 0 }}>
                    {selectedListing.underwriting.mainBuilding}
                  </p>
                </div>
                
                <div style={{ padding: "12px", background: "#EFF6FF", borderRadius: "6px", border: "1px solid #BFDBFE" }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#1E40AF", marginBottom: "4px" }}>
                    Accessory Unit Potential
                  </p>
                  <p style={{ fontSize: "14px", color: "#1D4ED8", margin: 0 }}>
                    {selectedListing.underwriting.accessory}
                  </p>
                </div>
                
                <div style={{ padding: "12px", background: "#FFFBEB", borderRadius: "6px", border: "1px solid #FDE68A" }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#92400E", marginBottom: "4px" }}>
                    Severance Potential
                  </p>
                  <p style={{ fontSize: "14px", color: "#B45309", margin: 0 }}>
                    {selectedListing.underwriting.severance}
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <button
              className="btn-primary"
              style={{ width: "100%" }}
            >
              Contact About This Property
            </button>
          </div>
        </div>
      )}

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