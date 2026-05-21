import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface LeadData {
  sessionToken: string;
}

interface Listing {
  id: string;
  address: string;
  price: number;
  units: number;
  potential: string;
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

const mockListings: Listing[] = [
  { id: "1", address: "145 Bloor St W, Toronto", price: 2800000, units: 4, potential: "High - Major Street" },
  { id: "2", address: "2200 Yonge St, Toronto", price: 3500000, units: 6, potential: "Very High - Major Street" },
  { id: "3", address: "85格林威治, East York", price: 1650000, units: 5, potential: "High - East York" },
];

export function SixixplexListingsPage() {
  const navigate = useNavigate();
  const [lead, setLead] = useState<LeadData | null>(null);
  const [listings] = useState<Listing[]>(mockListings);

  useEffect(() => {
    const storedLead = getLead();
    if (!storedLead) {
      navigate("/6ixplex");
      return;
    }
    setLead(storedLead);
  }, [navigate]);

  if (!lead) {
    return null;
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
            <a href="/6ixplex/listings" className="text-sm font-medium text-[#F59E0B]">Listings</a>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-[#0F172A] mb-6">Toronto Multiplex Listings</h2>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <div key={listing.id} className="bg-white rounded-lg shadow-md p-4">
              <div className="h-32 bg-gray-200 rounded mb-4 flex items-center justify-center">
                <span className="text-gray-400">Property Image</span>
              </div>
              <h3 className="font-semibold text-[#0F172A]">{listing.address}</h3>
              <p className="text-lg font-bold text-[#F59E0B] mt-1">
                ${listing.price.toLocaleString()}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-1 bg-[#0F172A] text-white text-xs rounded">
                  {listing.units} units
                </span>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded">
                  {listing.potential}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}