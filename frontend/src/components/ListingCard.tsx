import React from 'react';
import { MapPin, Bed, Bath, Square, Heart, Building2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InvestorLeadForm } from '@/components/monetization/InvestorLeadForm';

export interface Listing {
  id: number;
  mls_number: string;
  address_street: string;
  address_city: string;
  address_province: string;
  list_price: number;
  bedrooms: number;
  bathrooms_full: number;
  square_footage: number;
  property_type: string;
  structure_type: string;
  cap_rate?: number;
  gross_yield?: number;
  cash_flow_monthly?: number;
  estimated_monthly_rent?: number;
  photos?: { url: string; isPrimary: boolean }[];
  status: string;
}

interface ListingCardProps {
  listing: Listing;
  onClick?: () => void;
  onToggleFavorite?: (mlsNumber: string) => void;
  isFavorite?: boolean;
  showInvestmentMetrics?: boolean;
}

export const ListingCardSkeleton: React.FC = () => (
  <Card className="overflow-hidden">
    <div className="h-48 animate-pulse bg-gray-200" />
    <CardHeader className="space-y-2">
      <div className="h-7 w-32 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
    </CardHeader>
    <CardContent>
      <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
    </CardContent>
  </Card>
);

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  onClick,
  onToggleFavorite,
  isFavorite = false,
  showInvestmentMetrics = true,
}) => {
  const primaryPhoto = listing.photos?.find((p) => p.isPrimary)?.url || '/placeholder-house.jpg';

  const formatPrice = (price: number) => `$${price.toLocaleString()}`;

  const formatCurrency = (amount: number) => {
    const sign = amount >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(amount).toLocaleString()}`;
  };

  return (
    <Card className="cursor-pointer overflow-hidden transition-shadow hover:shadow-lg" onClick={onClick}>
      <div className="relative h-48 overflow-hidden bg-gray-200">
        <img
          src={primaryPhoto}
          alt={listing.address_street}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
        />

        <Badge className="absolute left-2 top-2" variant={listing.status === 'Active' ? 'default' : 'secondary'}>
          {listing.status}
        </Badge>

        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute right-2 top-2 z-10"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite?.(listing.mls_number);
          }}
          aria-label={isFavorite ? 'Remove from favorites' : 'Save listing'}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
        </Button>

        {showInvestmentMetrics && listing.cap_rate && (
          <Badge className="absolute bottom-2 right-2 bg-green-600 text-white">{listing.cap_rate.toFixed(1)}% Cap Rate</Badge>
        )}
      </div>

      <CardHeader className="pb-3">
        <div className="text-2xl font-bold text-primary">{formatPrice(listing.list_price)}</div>
        <div className="mt-1 flex items-start gap-2 text-gray-600">
          <MapPin className="mt-1 h-4 w-4 flex-shrink-0" />
          <div className="text-sm">
            <div>{listing.address_street}</div>
            <div>
              {listing.address_city}, {listing.address_province}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="flex flex-wrap gap-4 text-sm text-gray-700">
          <div className="flex items-center gap-1">
            <Bed className="h-4 w-4" />
            <span>{listing.bedrooms} bed</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="h-4 w-4" />
            <span>{listing.bathrooms_full} bath</span>
          </div>
          {!!listing.square_footage && (
            <div className="flex items-center gap-1">
              <Square className="h-4 w-4" />
              <span>{listing.square_footage.toLocaleString()} sqft</span>
            </div>
          )}
        </div>

        <div className="mt-2 text-xs text-gray-500">{listing.structure_type || listing.property_type}</div>

        {showInvestmentMetrics && listing.cap_rate && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-500">Monthly Rent</div>
                <div className="font-semibold text-green-600">
                  {listing.estimated_monthly_rent ? formatPrice(listing.estimated_monthly_rent) : 'N/A'}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Gross Yield</div>
                <div className="font-semibold">{listing.gross_yield ? `${listing.gross_yield.toFixed(1)}%` : 'N/A'}</div>
              </div>

              {listing.cash_flow_monthly !== undefined && (
                <div className="col-span-2">
                  <div className="text-xs text-gray-500">Est. Cash Flow</div>
                  <div className={`font-semibold ${listing.cash_flow_monthly >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(listing.cash_flow_monthly)}/mo
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Get Matched with Investor Realtor Button */}
      <CardFooter 
        className="pt-2 pb-4" 
        onClick={(e) => e.stopPropagation()}
      >
        <InvestorLeadForm
          listingId={listing.id}
          listingAddress={`${listing.address_street}, ${listing.address_city}`}
          targetCities={[listing.address_city]}
          targetProvinces={[listing.address_province]}
          trigger={
            <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary hover:text-white">
              <Building2 className="mr-2 h-4 w-4" />
              Get Matched with Investor Realtor
            </Button>
          }
        />
      </CardFooter>

      <div className="px-6 pb-4 text-xs text-gray-500">MLS® #{listing.mls_number}</div>
    </Card>
  );
};

export default ListingCard;
