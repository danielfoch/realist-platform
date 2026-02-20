/**
 * Listings Map Component
 * Interactive map view with listing markers
 */

import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';

interface MapListing {
  id: number;
  mls_number: string;
  latitude: number;
  longitude: number;
  list_price: number;
  bedrooms: number;
  bathrooms_full: number;
  address_street: string;
  address_city: string;
  property_type?: string;
  structure_type?: string;
  cap_rate?: number;
  photo?: string;
}

interface ListingsMapProps {
  listings: MapListing[];
  onListingClick?: (listing: MapListing) => void;
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
}

// Set your Mapbox token here or in environment variables
const viteEnv = import.meta.env as { VITE_MAPBOX_TOKEN?: string };
mapboxgl.accessToken = viteEnv.VITE_MAPBOX_TOKEN || '';

export const ListingsMap: React.FC<ListingsMapProps> = ({
  listings,
  onListingClick,
  initialCenter = [-79.3832, 43.6532], // Toronto
  initialZoom = 10,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: initialCenter,
      zoom: initialZoom,
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add fullscreen control
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    return () => {
      map.current?.remove();
    };
  }, []);

  // Update markers when listings change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add markers for each listing
    listings.forEach((listing) => {
      // Create marker element
      const el = document.createElement('div');
      el.className = 'listing-marker';
      el.style.cssText = `
        width: 40px;
        height: 40px;
        background-color: ${listing.cap_rate ? '#16a34a' : '#2563eb'};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        color: white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        transition: transform 0.2s;
      `;
      el.innerHTML = `$${Math.round(listing.list_price / 1000)}K`;

      // Add hover effect
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)';
        el.style.zIndex = '1000';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.zIndex = '1';
      });

      // Create popup
      const popupContent = `
        <div class="p-2 min-w-[200px]">
          ${
            listing.photo
              ? `<img src="${listing.photo}" alt="Property" class="w-full h-32 object-cover rounded mb-2" />`
              : ''
          }
          <div class="font-bold text-lg">$${listing.list_price.toLocaleString()}</div>
          <div class="text-sm text-gray-600">${listing.address_street}</div>
          <div class="text-sm text-gray-600">${listing.address_city}</div>
          <div class="flex gap-2 mt-2 text-sm">
            <span>${listing.bedrooms} bed</span>
            <span>•</span>
            <span>${listing.bathrooms_full} bath</span>
          </div>
          ${
            listing.cap_rate
              ? `<div class="mt-2 px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-semibold">
                   ${listing.cap_rate.toFixed(1)}% Cap Rate
                 </div>`
              : ''
          }
          <div class="text-xs text-gray-500 mt-2">MLS® #${listing.mls_number}</div>
        </div>
      `;

      const popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        maxWidth: '300px',
      }).setHTML(popupContent);

      // Create marker
      const marker = new mapboxgl.Marker(el)
        .setLngLat([listing.longitude, listing.latitude])
        .setPopup(popup)
        .addTo(map.current!);
      markersRef.current.push(marker);

      // Click handler
      el.addEventListener('click', () => {
        if (onListingClick) {
          onListingClick(listing);
        }
      });
    });

    // Fit bounds to show all markers
    if (listings.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      listings.forEach((listing) => {
        bounds.extend([listing.longitude, listing.latitude]);
      });
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15,
      });
    }
  }, [listings]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full rounded-lg overflow-hidden" />

      {/* Listing count overlay */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg px-4 py-2">
        <div className="text-sm text-gray-600">
          Showing <span className="font-bold text-gray-900">{listings.length}</span> properties
        </div>
      </div>

      {/* Legend */}
      <Card className="absolute bottom-4 left-4 p-3">
        <div className="text-xs font-semibold mb-2">Map Legend</div>
        <div className="flex items-center gap-2 text-xs mb-1">
          <div className="w-4 h-4 rounded-full bg-green-600 border-2 border-white"></div>
          <span>Investment Property (has cap rate)</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white"></div>
          <span>Regular Listing</span>
        </div>
      </Card>
    </div>
  );
};

export default ListingsMap;
