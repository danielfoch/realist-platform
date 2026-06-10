import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { track } from "../lib/event-tracking";

interface LeadData {
  id: string;
  address: string;
  fullName: string;
  phone: string;
  source?: string;
  createdAt: number;
  sessionToken: string;
}

function generateSessionToken(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function SixixplexPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sourceParam = searchParams.get("source");

  const [address, setAddress] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = localStorage.getItem("6ixplex_lead");
    if (stored) {
      navigate("/6ixplex/report");
    }
  }, [navigate]);

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};
    if (!address.trim()) newErrors.address = "Address is required";
    if (!fullName.trim()) newErrors.fullName = "Full name is required";
    if (!phone.trim()) newErrors.phone = "Phone number is required";
    else if (!/^\(?[\d]{3}\)?[-.\s]?[\d]{3}[-.\s]?[\d]{4}$/.test(phone.replace(/\s/g, ""))) {
      newErrors.phone = "Please enter a valid phone number";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    track('deal_analyzer_start', { address: address.trim(), source: sourceParam || undefined });

    setIsLoading(true);
    setTimeout(() => {
      const lead: LeadData = {
        id: Date.now().toString(),
        address: address.trim(),
        fullName: fullName.trim(),
        phone: phone.trim(),
        source: sourceParam || undefined,
        createdAt: Date.now(),
        sessionToken: generateSessionToken(),
      };
      localStorage.setItem("6ixplex_lead", JSON.stringify(lead));
      sessionStorage.setItem("6ixplex_session", lead.sessionToken);
      setIsLoading(false);
      navigate("/6ixplex/report");
    }, 1000);
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#0F172A]">
            <a href="/6ixplex">6ixplex</a>
          </h1>
          <nav className="flex gap-4">
            <a href="/6ixplex" className="text-sm font-medium hover:text-[#0F172A]">Home</a>
            <a href="/6ixplex/listings" className="text-sm font-medium hover:text-[#0F172A]">Listings</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-xl">
            <div className="text-center mb-10">
              <h2 className="text-4xl font-bold text-[#0F172A] mb-4">
                Toronto Multiplex Report
              </h2>
              <p className="text-[#64748B]">
                Enter any Toronto address to get a free preliminary underwriting report
              </p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1">
                    Property Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St, Toronto"
                    className="w-full px-4 py-2 border border-[#E2E8F0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                  />
                  {errors.address && (
                    <p className="text-red-500 text-sm mt-1">{errors.address}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Smith"
                    className="w-full px-4 py-2 border border-[#E2E8F0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                  />
                  {errors.fullName && (
                    <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#0F172A] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(416) 555-1234"
                    className="w-full px-4 py-2 border border-[#E2E8F0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#F59E0B] text-white font-medium py-3 rounded-md hover:bg-[#D97706] transition-colors disabled:opacity-50"
                >
                  {isLoading ? "Generating Report..." : "Get Free Report"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}