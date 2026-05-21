/**
 * Saved Listings Page — persistent bookmarks for authenticated investors
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useToast } from '../hooks/use-toast';
import { BookmarkIcon, Trash2, MapPin, Bed, Bath, Square } from 'lucide-react';
import { Pagination } from '../components/Pagination';

interface SavedListing {
  id: number;
  listing_id: number | null;
  address: string;
  city: string;
  province: string;
  price: number | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  saved_at: string;
  notes: string | null;
  // Joined from listings table
  mls_number: string | null;
  status: string | null;
  structure_type: string | null;
  latitude: number | null;
  longitude: number | null;
  estimated_monthly_rent: number | null;
  cap_rate: number | null;
  gross_yield: number | null;
  cash_flow_monthly: number | null;
  primary_photo: string | null;
}

interface SavedListingsResponse {
  success: boolean;
  data: {
    saved_listings: SavedListing[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

function formatPrice(price: number | null): string {
  if (price === null) return 'Price not available';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(price);
}

export function SavedListingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [listings, setListings] = useState<SavedListing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchSavedListings = async (pageNum: number) => {
    const token = localStorage.getItem('investor_token');
    if (!token) {
      navigate('/investor/login');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/saved-listings?page=${pageNum}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        navigate('/investor/login');
        return;
      }
      const data: SavedListingsResponse = await res.json();
      if (data.success) {
        setListings(data.data.saved_listings);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch saved listings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedListings(page);
  }, [page]);

  const handleRemove = async (listingId: number) => {
    const token = localStorage.getItem('investor_token');
    if (!token) return;

    try {
      const res = await fetch(`/api/saved-listings/${listingId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setListings((prev) => prev.filter((l) => l.listing_id !== listingId));
        setTotal((prev) => prev - 1);
        toast({ title: 'Removed from saved listings' });
      }
    } catch (err) {
      console.error('Failed to remove listing:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Saved Listings</h1>
          <p className="text-gray-600">{total} saved propert{total === 1 ? 'y' : 'ies'}</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {listings.length === 0 ? (
          <div className="text-center py-16">
            <BookmarkIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700">No saved listings yet</h2>
            <p className="text-gray-500 mt-2">Browse listings and tap the star to save them here.</p>
            <Link to="/">
              <Button className="mt-4">Browse Listings</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <Card
                  key={listing.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => {
                    if (listing.mls_number) {
                      navigate(`/listings/${listing.mls_number}`);
                    }
                  }}
                >
                  {listing.primary_photo && (
                    <div className="h-40 bg-gray-200 overflow-hidden">
                      <img
                        src={listing.primary_photo}
                        alt={listing.address}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{listing.address}</p>
                        <p className="text-sm text-gray-500">
                          {[listing.city, listing.province].filter(Boolean).join(', ')}
                        </p>
                        <p className="text-lg font-bold text-primary mt-1">
                          {formatPrice(listing.price)}
                        </p>
                        {(listing.bedrooms || listing.bathrooms || listing.sqft) && (
                          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                            {listing.bedrooms !== null && (
                              <span className="flex items-center gap-1">
                                <Bed className="h-3.5 w-3.5" /> {listing.bedrooms} bd
                              </span>
                            )}
                            {listing.bathrooms !== null && (
                              <span className="flex items-center gap-1">
                                <Bath className="h-3.5 w-3.5" /> {listing.bathrooms} ba
                              </span>
                            )}
                            {listing.sqft !== null && (
                              <span className="flex items-center gap-1">
                                <Square className="h-3.5 w-3.5" /> {listing.sqft?.toLocaleString()} sqft
                              </span>
                            )}
                          </div>
                        )}
                        {listing.cap_rate !== null && (
                          <p className="text-xs text-green-600 mt-1 font-medium">
                            {listing.cap_rate}% Cap Rate
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (listing.listing_id) handleRemove(listing.listing_id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={(newPage) => {
                    setPage(newPage);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SavedListingsPage;