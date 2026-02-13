/**
 * Search Filters Component
 * Advanced property search filters
 */

import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';

export interface SearchFiltersState {
  city?: string;
  province?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  propertyType?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  investmentFocus?: boolean;
}

interface SearchFiltersProps {
  filters: SearchFiltersState;
  onFiltersChange: (filters: SearchFiltersState) => void;
  onSearch: () => void;
}

const provinces = [
  { value: 'AB', label: 'Alberta' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland and Labrador' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'ON', label: 'Ontario' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'QC', label: 'Quebec' },
  { value: 'SK', label: 'Saskatchewan' },
];

const propertyTypes = [
  { value: 'Residential', label: 'Residential' },
  { value: 'Commercial', label: 'Commercial' },
  { value: 'Land', label: 'Land' },
  { value: 'Multi-Family', label: 'Multi-Family' },
];

const sortOptions = [
  { value: 'list_date', label: 'Newest' },
  { value: 'list_price', label: 'Price' },
  { value: 'cap_rate', label: 'Cap Rate' },
  { value: 'gross_yield', label: 'Gross Yield' },
  { value: 'cash_flow_monthly', label: 'Cash Flow' },
  { value: 'bedrooms', label: 'Bedrooms' },
];

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  filters,
  onFiltersChange,
  onSearch,
}) => {
  const [priceRange, setPriceRange] = React.useState<number[]>([
    filters.minPrice || 0,
    filters.maxPrice || 5000000,
  ]);

  const updateFilter = (key: keyof SearchFiltersState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handlePriceRangeChange = (values: number[]) => {
    setPriceRange(values);
    onFiltersChange({
      ...filters,
      minPrice: values[0] === 0 ? undefined : values[0],
      maxPrice: values[1] === 5000000 ? undefined : values[1],
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      status: 'Active',
      sortBy: 'list_date',
      sortOrder: 'DESC',
    });
    setPriceRange([0, 5000000]);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* Main search bar */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row">
        <div className="flex-1">
          <Input
            placeholder="Enter city or address..."
            value={filters.city || ''}
            onChange={(e) => updateFilter('city', e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && onSearch()}
          />
        </div>
        
        <Select
          value={filters.province}
          onValueChange={(value) => updateFilter('province', value)}
        >
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Province" />
          </SelectTrigger>
          <SelectContent>
            {provinces.map((prov) => (
              <SelectItem key={prov.value} value={prov.value}>
                {prov.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={onSearch} size="lg">
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Bedrooms */}
        <Select
          value={filters.minBedrooms?.toString()}
          onValueChange={(value) => updateFilter('minBedrooms', parseInt(value))}
        >
          <SelectTrigger className="w-full md:w-32">
            <SelectValue placeholder="Beds" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((num) => (
              <SelectItem key={num} value={num.toString()}>
                {num}+ beds
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Property type */}
        <Select
          value={filters.propertyType}
          onValueChange={(value) => updateFilter('propertyType', value)}
        >
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Property Type" />
          </SelectTrigger>
          <SelectContent>
            {propertyTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={filters.sortBy}
          onValueChange={(value) => updateFilter('sortBy', value)}
        >
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Investment focus toggle */}
        <div className="ml-auto flex items-center gap-2">
          <Switch
            checked={filters.investmentFocus}
            onCheckedChange={(checked) => updateFilter('investmentFocus', checked)}
          />
          <Label>Investment Focus</Label>
        </div>

        {/* Advanced filters */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              More Filters
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Advanced Filters</SheetTitle>
              <SheetDescription>
                Refine your property search
              </SheetDescription>
            </SheetHeader>

            <div className="py-6 space-y-6">
              {/* Price range */}
              <div>
                <Label>Price Range</Label>
                <div className="pt-4 pb-2">
                  <Slider
                    min={0}
                    max={5000000}
                    step={50000}
                    value={priceRange}
                    onValueChange={handlePriceRangeChange}
                  />
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>${(priceRange[0] / 1000).toFixed(0)}K</span>
                  <span>
                    {priceRange[1] >= 5000000
                      ? '$5M+'
                      : `$${(priceRange[1] / 1000).toFixed(0)}K`}
                  </span>
                </div>
              </div>

              {/* Bedroom range */}
              <div>
                <Label>Bedrooms</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <Label className="text-xs text-gray-500">Min</Label>
                    <Input
                      type="number"
                      min={0}
                      value={filters.minBedrooms || ''}
                      onChange={(e) =>
                        updateFilter('minBedrooms', e.target.value ? parseInt(e.target.value) : undefined)
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Max</Label>
                    <Input
                      type="number"
                      min={0}
                      value={filters.maxBedrooms || ''}
                      onChange={(e) =>
                        updateFilter('maxBedrooms', e.target.value ? parseInt(e.target.value) : undefined)
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <Label>Listing Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => updateFilter('status', value)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={clearFilters}
              >
                <X className="h-4 w-4 mr-2" />
                Clear All Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default SearchFilters;
