"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

// Session/storage helpers
function generateSessionToken(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function saveLead(lead: LeadData): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("6ixplex_lead", JSON.stringify(lead));
    sessionStorage.setItem("6ixplex_session", lead.sessionToken);
  }
}

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

function getSessionToken(): string | null {
  if (typeof window !== "undefined") {
    return sessionStorage.getItem("6ixplex_session");
  }
  return null;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceParam = searchParams.get("source");

  const [address, setAddress] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if user already has a session
  useEffect(() => {
    const existingLead = getLead();
    if (existingLead) {
      // User already has a lead, redirect to report
      router.push("/report");
    }
  }, [router]);

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!address.trim()) {
      newErrors.address = "Address is required";
    }

    if (!fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }

    if (!phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else {
      // Basic phone validation - at least 10 digits
      const phoneDigits = phone.replace(/\D/g, "");
      if (phoneDigits.length < 10) {
        newErrors.phone = "Please enter a valid phone number";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    // Simulate brief processing time
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Create lead
    const lead: LeadData = {
      id: Date.now().toString(),
      address: address.trim(),
      fullName: fullName.trim(),
      phone: phone.trim(),
      source: sourceParam || undefined,
      createdAt: Date.now(),
      sessionToken: generateSessionToken(),
    };

    saveLead(lead);
    router.push("/report");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header className="py-6">
        <div className="container">
          <div className="flex items-center justify-between">
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: "var(--primary)",
                margin: 0,
              }}
            >
              6ixplex
            </h1>
            <nav className="flex gap-6">
              <a
                href="#"
                style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "14px" }}
              >
                How it works
              </a>
              <a
                href="#"
                style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "14px" }}
              >
                About
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <section className="py-16 md:py-24">
          <div className="container">
            <div className="max-w-2xl mx-auto text-center mb-12">
              <h2
                style={{
                  fontSize: "clamp(32px, 5vw, 48px)",
                  fontWeight: 700,
                  color: "var(--primary)",
                  marginBottom: "16px",
                  lineHeight: 1.1,
                }}
              >
                Toronto multiplex potential,{" "}
                <span style={{ color: "var(--accent)" }}>instantly</span>
              </h2>
              <p
                style={{
                  fontSize: "18px",
                  color: "var(--text-secondary)",
                  maxWidth: "500px",
                  margin: "0 auto",
                }}
              >
                Enter your property address to get a preliminary screening for multiplex development,
                garden suites, and severance opportunities.
              </p>
            </div>

            {/* Lead Capture Form */}
            <div className="max-w-lg mx-auto">
              <form onSubmit={handleSubmit} className="card">
                <div className="space-y-5">
                  {/* Address Input */}
                  <div>
                    <label
                      htmlFor="address"
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        marginBottom: "6px",
                      }}
                    >
                      Property Address *
                    </label>
                    <input
                      id="address"
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="123 Main St, Toronto, ON"
                      className="input-field"
                      style={errors.address ? { borderColor: "var(--error)" } : {}}
                    />
                    {errors.address && (
                      <p style={{ color: "var(--error)", fontSize: "13px", marginTop: "4px" }}>
                        {errors.address}
                      </p>
                    )}
                  </div>

                  {/* Full Name Input */}
                  <div>
                    <label
                      htmlFor="fullName"
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        marginBottom: "6px",
                      }}
                    >
                      Your Full Name *
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Smith"
                      className="input-field"
                      style={errors.fullName ? { borderColor: "var(--error)" } : {}}
                    />
                    {errors.fullName && (
                      <p style={{ color: "var(--error)", fontSize: "13px", marginTop: "4px" }}>
                        {errors.fullName}
                      </p>
                    )}
                  </div>

                  {/* Phone Input */}
                  <div>
                    <label
                      htmlFor="phone"
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        marginBottom: "6px",
                      }}
                    >
                      Phone Number *
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(416) 555-1234"
                      className="input-field"
                      style={errors.phone ? { borderColor: "var(--error)" } : {}}
                    />
                    {errors.phone && (
                      <p style={{ color: "var(--error)", fontSize: "13px", marginTop: "4px" }}>
                        {errors.phone}
                      </p>
                    )}
                  </div>

                  {/* Source hidden field */}
                  {sourceParam && (
                    <input type="hidden" name="source" value={sourceParam} />
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary"
                    style={{ width: "100%", marginTop: "8px" }}
                  >
                    {isLoading ? (
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                        <svg
                          style={{ animation: "spin 1s linear infinite" }}
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            style={{ opacity: 0.25 }}
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            style={{ opacity: 0.75 }}
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Analyzing...
                      </span>
                    ) : (
                      "Get My Property Report"
                    )}
                  </button>
                </div>

                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    textAlign: "center",
                    marginTop: "16px",
                  }}
                >
                  No spam. We only call about your property.
                </p>
              </form>
            </div>

            {/* Trust indicators */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "32px",
                marginTop: "48px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "var(--primary)",
                  }}
                >
                  500+
                </div>
                <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                  Properties screened
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "var(--primary)",
                  }}
                >
                  Free
                </div>
                <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                  Preliminary report
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: 700,
                    color: "var(--primary)",
                  }}
                >
                  Toronto
                </div>
                <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                  Focused expertise
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section style={{ background: "white", padding: "64px 0" }}>
          <div className="container">
            <h3
              style={{
                fontSize: "28px",
                fontWeight: 600,
                textAlign: "center",
                marginBottom: "48px",
                color: "var(--primary)",
              }}
            >
              How it works
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "32px",
                maxWidth: "900px",
                margin: "0 auto",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "var(--accent)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    fontWeight: 700,
                    margin: "0 auto 16px",
                  }}
                >
                  1
                </div>
                <h4 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>
                  Enter your address
                </h4>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                  We pull the latest zoning and property data from City of Toronto sources.
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "var(--accent)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    fontWeight: 700,
                    margin: "0 auto 16px",
                  }}
                >
                  2
                </div>
                <h4 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>
                  Get your report
                </h4>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                  See unit potential, garden suite eligibility, and severance opportunities.
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "var(--accent)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                    fontWeight: 700,
                    margin: "0 auto 16px",
                  }}
                >
                  3
                </div>
                <h4 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px" }}>
                  Unlock listings
                </h4>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                  Browse Toronto multiplex listings with built-in underwriting analysis.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ padding: "32px 0", borderTop: "1px solid var(--border)" }}>
        <div className="container">
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              textAlign: "center",
            }}
          >
            © 2026 6ixplex. Toronto multiplex screening tool. Not affiliated with the City of Toronto.
          </p>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
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

export default function Home() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomeContent />
    </Suspense>
  );
}