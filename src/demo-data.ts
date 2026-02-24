/**
 * Demo/Mock data for development without a database
 * Use DEMO_MODE=true in .env to enable
 */

export interface DemoListing {
  id: number;
  mls_number: string;
  status: string;
  list_date: string;
  property_type: string;
  structure_type: string;
  address_street: string;
  address_unit: string;
  address_city: string;
  address_province: string;
  address_postal_code: string;
  latitude: number;
  longitude: number;
  list_price: number;
  bedrooms: number;
  bathrooms_full: number;
  bathrooms_half: number;
  square_footage: number;
  year_built: number;
  estimated_monthly_rent: number;
  cap_rate: number;
  gross_yield: number;
  cash_flow_monthly: number;
  rent_data_source: string;
  photos: Array<{ id: number; url: string; isPrimary: boolean }>;
}

const demoListings: DemoListing[] = [
  {
    id: 1,
    mls_number: 'DEMO1234567',
    status: 'Active',
    list_date: '2026-02-15',
    property_type: 'Residential',
    structure_type: 'House',
    address_street: '123 Investment Ave',
    address_unit: '',
    address_city: 'Toronto',
    address_province: 'ON',
    address_postal_code: 'M5V 1J2',
    latitude: 43.6532,
    longitude: -79.3832,
    list_price: 850000,
    bedrooms: 4,
    bathrooms_full: 2,
    bathrooms_half: 1,
    square_footage: 1800,
    year_built: 2015,
    estimated_monthly_rent: 3800,
    cap_rate: 5.36,
    gross_yield: 5.36,
    cash_flow_monthly: 1450,
    rent_data_source: 'demo',
    photos: [
      { id: 1, url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800', isPrimary: true }
    ]
  },
  {
    id: 2,
    mls_number: 'DEMO2345678',
    status: 'Active',
    list_date: '2026-02-18',
    property_type: 'Residential',
    structure_type: 'House',
    address_street: '456 Cash Flow Blvd',
    address_unit: '',
    address_city: 'Hamilton',
    address_province: 'ON',
    address_postal_code: 'L8P 1A1',
    latitude: 43.2557,
    longitude: -79.8711,
    list_price: 620000,
    bedrooms: 3,
    bathrooms_full: 2,
    bathrooms_half: 0,
    square_footage: 1400,
    year_built: 2010,
    estimated_monthly_rent: 3200,
    cap_rate: 6.19,
    gross_yield: 6.19,
    cash_flow_monthly: 1720,
    rent_data_source: 'demo',
    photos: [
      { id: 2, url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800', isPrimary: true }
    ]
  },
  {
    id: 3,
    mls_number: 'DEMO3456789',
    status: 'Active',
    list_date: '2026-02-10',
    property_type: 'Residential',
    structure_type: 'Townhouse',
    address_street: '789 Rental Row',
    address_unit: 'A',
    address_city: 'Kitchener',
    address_province: 'ON',
    address_postal_code: 'N2H 1A1',
    latitude: 43.4516,
    longitude: -80.4925,
    list_price: 495000,
    bedrooms: 3,
    bathrooms_full: 1,
    bathrooms_half: 1,
    square_footage: 1100,
    year_built: 2018,
    estimated_monthly_rent: 2400,
    cap_rate: 5.82,
    gross_yield: 5.82,
    cash_flow_monthly: 1020,
    rent_data_source: 'demo',
    photos: [
      { id: 3, url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', isPrimary: true }
    ]
  },
  {
    id: 4,
    mls_number: 'DEMO4567890',
    status: 'Active',
    list_date: '2026-02-20',
    property_type: 'Residential',
    structure_type: 'House',
    address_street: '321 Multi-Unit Lane',
    address_unit: '',
    address_city: 'Ottawa',
    address_province: 'ON',
    address_postal_code: 'K1P 1J1',
    latitude: 45.4215,
    longitude: -75.6972,
    list_price: 720000,
    bedrooms: 5,
    bathrooms_full: 3,
    bathrooms_half: 0,
    square_footage: 2200,
    year_built: 2008,
    estimated_monthly_rent: 4200,
    cap_rate: 7.00,
    gross_yield: 7.00,
    cash_flow_monthly: 2280,
    rent_data_source: 'demo',
    photos: [
      { id: 4, url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800', isPrimary: true }
    ]
  },
  {
    id: 5,
    mls_number: 'DEMO5678901',
    status: 'Active',
    list_date: '2026-02-12',
    property_type: 'Residential',
    structure_type: 'Condo',
    address_street: '555 Downtown Tower',
    address_unit: '1201',
    address_city: 'Toronto',
    address_province: 'ON',
    address_postal_code: 'M5E 1J2',
    latitude: 43.6408,
    longitude: -79.3817,
    list_price: 580000,
    bedrooms: 2,
    bathrooms_full: 2,
    bathrooms_half: 0,
    square_footage: 850,
    year_built: 2020,
    estimated_monthly_rent: 2800,
    cap_rate: 5.79,
    gross_yield: 5.79,
    cash_flow_monthly: 1200,
    rent_data_source: 'demo',
    photos: [
      { id: 5, url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', isPrimary: true }
    ]
  },
  {
    id: 6,
    mls_number: 'DEMO6789012',
    status: 'Active',
    list_date: '2026-02-08',
    property_type: 'Residential',
    structure_type: 'House',
    address_street: '888 Suburb Street',
    address_unit: '',
    address_city: 'London',
    address_province: 'ON',
    address_postal_code: 'N6A 1J1',
    latitude: 42.9849,
    longitude: -81.2453,
    list_price: 445000,
    bedrooms: 3,
    bathrooms_full: 2,
    bathrooms_half: 0,
    square_footage: 1300,
    year_built: 2012,
    estimated_monthly_rent: 2200,
    cap_rate: 5.93,
    gross_yield: 5.93,
    cash_flow_monthly: 980,
    rent_data_source: 'demo',
    photos: [
      { id: 6, url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800', isPrimary: true }
    ]
  },
  {
    id: 7,
    mls_number: 'DEMO7890123',
    status: 'Active',
    list_date: '2026-02-22',
    property_type: 'Residential',
    structure_type: 'Duplex',
    address_street: '222 Income Property Way',
    address_unit: '',
    address_city: 'Windsor',
    address_province: 'ON',
    address_postal_code: 'N9A 1J1',
    latitude: 42.3149,
    longitude: -83.0364,
    list_price: 385000,
    bedrooms: 4,
    bathrooms_full: 2,
    bathrooms_half: 0,
    square_footage: 1600,
    year_built: 2005,
    estimated_monthly_rent: 2600,
    cap_rate: 8.12,
    gross_yield: 8.12,
    cash_flow_monthly: 1580,
    rent_data_source: 'demo',
    photos: [
      { id: 7, url: 'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800', isPrimary: true }
    ]
  },
  {
    id: 8,
    mls_number: 'DEMO8901234',
    status: 'Active',
    list_date: '2026-02-05',
    property_type: 'Residential',
    structure_type: 'House',
    address_street: '999 Cap Rate Court',
    address_unit: '',
    address_city: 'Mississauga',
    address_province: 'ON',
    address_postal_code: 'L5M 1J1',
    latitude: 43.5890,
    longitude: -79.6441,
    list_price: 695000,
    bedrooms: 3,
    bathrooms_full: 2,
    bathrooms_half: 1,
    square_footage: 1650,
    year_built: 2016,
    estimated_monthly_rent: 3200,
    cap_rate: 5.53,
    gross_yield: 5.53,
    cash_flow_monthly: 1320,
    rent_data_source: 'demo',
    photos: [
      { id: 8, url: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800', isPrimary: true }
    ]
  }
];

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}

export function getDemoListings(): DemoListing[] {
  return demoListings;
}

export function getDemoListingByMls(mlsNumber: string): DemoListing | undefined {
  return demoListings.find(l => l.mls_number === mlsNumber);
}

export function filterDemoListings(filters: {
  city?: string;
  province?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  propertyType?: string;
  status?: string;
  investmentFocus?: boolean;
  minCapRate?: number;
  maxCapRate?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}): { data: DemoListing[]; total: number; page: number; limit: number; totalPages: number } {
  let filtered = [...demoListings];

  if (filters.status) {
    filtered = filtered.filter(l => l.status === filters.status);
  }
  if (filters.city) {
    filtered = filtered.filter(l => l.address_city.toLowerCase().includes(filters.city!.toLowerCase()));
  }
  if (filters.province) {
    filtered = filtered.filter(l => l.address_province === filters.province);
  }
  if (filters.minPrice) {
    filtered = filtered.filter(l => l.list_price >= filters.minPrice!);
  }
  if (filters.maxPrice) {
    filtered = filtered.filter(l => l.list_price <= filters.maxPrice!);
  }
  if (filters.minBedrooms) {
    filtered = filtered.filter(l => l.bedrooms >= filters.minBedrooms!);
  }
  if (filters.maxBedrooms) {
    filtered = filtered.filter(l => l.bedrooms <= filters.maxBedrooms!);
  }
  if (filters.propertyType) {
    filtered = filtered.filter(l => l.property_type === filters.propertyType);
  }
  if (filters.investmentFocus) {
    filtered = filtered.filter(l => l.cap_rate !== null && l.cap_rate !== undefined);
  }
  if (filters.minCapRate) {
    filtered = filtered.filter(l => l.cap_rate >= filters.minCapRate!);
  }
  if (filters.maxCapRate) {
    filtered = filtered.filter(l => l.cap_rate <= filters.maxCapRate!);
  }

  // Sort
  const sortBy = filters.sortBy || 'list_date';
  const sortOrder = filters.sortOrder || 'DESC';
  filtered.sort((a, b) => {
    const aVal = a[sortBy as keyof DemoListing];
    const bVal = b[sortBy as keyof DemoListing];
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortOrder === 'ASC' ? aVal - bVal : bVal - aVal;
    }
    return sortOrder === 'ASC' 
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  // Paginate
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const data = filtered.slice(offset, offset + limit);

  return { data, total, page, limit, totalPages };
}
