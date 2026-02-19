import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Grid, Map, Star } from 'lucide-react'
import { SearchFilters, SearchFiltersState } from '@/components/SearchFilters'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ListingCard, ListingCardSkeleton } from '@/components/ListingCard'
import { ListingsMap } from '@/components/ListingsMap'
import { Pagination } from '@/components/Pagination'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Listing {
  id: number
  mls_number: string
  address_street: string
  address_city: string
  address_province: string
  list_price: number
  bedrooms: number
  bathrooms_full: number
  square_footage: number
  property_type: string
  structure_type: string
  latitude: number
  longitude: number
  cap_rate?: number
  gross_yield?: number
  cash_flow_monthly?: number
  estimated_monthly_rent?: number
  photos?: Array<{ url: string; isPrimary: boolean }>
  status: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

const FAVORITES_KEY = 'realist.favoriteListings'

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []
  } catch {
    return []
  }
}

export const ListingsPage: React.FC = () => {
  const [view, setView] = useState<'grid' | 'map'>('grid')
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  const [filters, setFilters] = useState<SearchFiltersState>({
    status: 'Active',
    sortBy: 'list_date',
    sortOrder: 'DESC',
  })

  useEffect(() => {
    setFavorites(readFavorites())
  }, [])

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])

  const toggleFavorite = (mlsNumber: string) => {
    setFavorites((prev) => {
      const exists = prev.includes(mlsNumber)
      const next = exists ? prev.filter((value) => value !== mlsNumber) : [...prev, mlsNumber]
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
      return next
    })
  }

  const fetchListings = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value))
        }
      })

      params.append('page', String(pagination.page))
      params.append('limit', String(pagination.limit))

      const response = await axios.get(`/api/listings?${params.toString()}`)
      if (response.data.success) {
        setListings(response.data.data as Listing[])
        setPagination(response.data.pagination as PaginationInfo)
      }
    } catch (error) {
      console.error('Failed to fetch listings:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchListings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pagination.page])

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  const handleListingClick = (listing: Listing) => {
    window.location.href = `/listings/${listing.mls_number}`
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <div className="border-b bg-white">
          <div className="container mx-auto px-4 py-6">
            <h1 className="mb-2 text-2xl font-bold text-gray-900 md:text-3xl">
              Investment Properties
            </h1>
            <p className="text-gray-600">Find your next investment property in Canada</p>
            <p className="mt-2 flex items-center gap-1 text-sm text-gray-500">
              <Star className="h-4 w-4" /> {favorites.length} saved listings
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-4">
          <SearchFilters filters={filters} onFiltersChange={setFilters} onSearch={handleSearch} />
        </div>

        <div className="container mx-auto px-4 py-4">
          <Tabs value={view} onValueChange={(value) => setView(value as 'grid' | 'map')}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="grid" className="flex-1 sm:flex-none">
                <Grid className="mr-2 h-4 w-4" />
                Grid View
              </TabsTrigger>
              <TabsTrigger value="map" className="flex-1 sm:flex-none">
                <Map className="mr-2 h-4 w-4" />
                Map View
              </TabsTrigger>
            </TabsList>

            <TabsContent value="grid" className="mt-6">
              {loading ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <ListingCardSkeleton key={idx} />
                  ))}
                </div>
              ) : listings.length === 0 ? (
                <div className="rounded-lg bg-white py-12 text-center">
                  <p className="text-lg text-gray-600">No properties found</p>
                  <p className="mt-2 text-sm text-gray-500">Try adjusting your search filters</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 text-sm text-gray-600">
                    Showing {(pagination.page - 1) * pagination.limit + 1} -{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} properties
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {listings.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        onClick={() => handleListingClick(listing)}
                        showInvestmentMetrics={filters.investmentFocus}
                        onToggleFavorite={toggleFavorite}
                        isFavorite={favoriteSet.has(listing.mls_number)}
                      />
                    ))}
                  </div>

                  <Pagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={(newPage) => {
                      setPagination((prev) => ({ ...prev, page: newPage }))
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                  />
                </>
              )}
            </TabsContent>

            <TabsContent value="map" className="mt-6">
              <div className="h-[60vh] overflow-hidden rounded-lg bg-white shadow-lg sm:h-[70vh]">
                {loading ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
                  </div>
                ) : (
                  <ListingsMap listings={listings} onListingClick={handleListingClick} />
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default ListingsPage
