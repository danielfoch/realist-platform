"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ListingSearchResult } from "./listingDisplay";

/**
 * The map half of the listings page. One pin per listing in the list beside it
 * — the same set, never a different one — labelled with its price. Hovering a
 * card lights its pin; clicking a pin picks the card. Moving the map (by hand,
 * not when we fit it to new results) reports the new area so the page can
 * search it.
 */

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Vancouver → St. John's: the band where the listings actually are.
const CANADA: [[number, number], [number, number]] = [
  [-128.5, 42.0],
  [-56.5, 54.5],
];

function compactPrice(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(price >= 10_000_000 ? 0 : 2).replace(/\.?0+$/, "")}M`;
  if (price >= 1000) return `$${Math.round(price / 1000)}K`;
  return `$${Math.round(price)}`;
}

const located = (listing: ListingSearchResult) =>
  listing.map && Number.isFinite(listing.map.latitude) && Number.isFinite(listing.map.longitude) && listing.map.latitude !== 0 && listing.map.longitude !== 0;

export function ListingsMap({
  listings,
  activeMls,
  fitKey,
  onActive,
  onSelect,
  onMoved,
}: {
  listings: ListingSearchResult[];
  /** The listing under the pointer, in the list or on the map. */
  activeMls: string | null;
  /** Changes when the results are a NEW search (not a map-area refresh): the map then frames them. */
  fitKey: string;
  onActive: (mlsNumber: string | null) => void;
  onSelect: (mlsNumber: string) => void;
  onMoved: (bounds: MapBounds) => void;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<string, { marker: maplibregl.Marker; element: HTMLButtonElement }>());
  // Moves we make ourselves (framing results) must not be mistaken for the person exploring.
  const programmatic = useRef(false);
  // The map's listeners are attached once; they reach the latest callbacks through this.
  const handlers = useRef({ onActive, onSelect, onMoved });
  useEffect(() => {
    handlers.current = { onActive, onSelect, onMoved };
  });

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      // Keyless, production-permitted vector basemap (openfreemap.org).
      style: "https://tiles.openfreemap.org/styles/positron",
      bounds: CANADA,
      fitBoundsOptions: { padding: 24 },
      minZoom: 2.5,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("moveend", (event) => {
      // `originalEvent` exists only when a person dragged, scrolled or pinched.
      if (programmatic.current || !(event as { originalEvent?: unknown }).originalEvent) {
        programmatic.current = false;
        return;
      }
      const bounds = map.getBounds();
      handlers.current.onMoved({ north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() });
    });
    mapRef.current = map;
    // The container can measure 0×0 at construction (streamed layout, or hidden behind the list on a phone).
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current);
    const pins = markers.current;
    return () => {
      observer.disconnect();
      pins.forEach(({ marker }) => marker.remove());
      pins.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Pins follow the list exactly.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const wanted = new Map(listings.filter(located).map((listing) => [listing.mlsNumber, listing]));
    for (const [mlsNumber, entry] of markers.current) {
      if (!wanted.has(mlsNumber)) {
        entry.marker.remove();
        markers.current.delete(mlsNumber);
      }
    }
    for (const [mlsNumber, listing] of wanted) {
      if (markers.current.has(mlsNumber)) continue;
      const element = document.createElement("button");
      element.type = "button";
      element.className = "listing-pin";
      element.textContent = compactPrice(listing.listPrice);
      element.setAttribute("aria-label", `${compactPrice(listing.listPrice)} — show this listing`);
      element.addEventListener("mouseenter", () => handlers.current.onActive(mlsNumber));
      element.addEventListener("mouseleave", () => handlers.current.onActive(null));
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        handlers.current.onSelect(mlsNumber);
      });
      const marker = new maplibregl.Marker({ element, anchor: "bottom" }).setLngLat([listing.map!.longitude, listing.map!.latitude]).addTo(map);
      markers.current.set(mlsNumber, { marker, element });
    }
  }, [listings]);

  // Frame a new search's results. A map-area refresh keeps the frame the person chose.
  useEffect(() => {
    const map = mapRef.current;
    const points = listings.filter(located);
    if (!map || !fitKey || points.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const listing of points) bounds.extend([listing.map!.longitude, listing.map!.latitude]);
    programmatic.current = true;
    map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  useEffect(() => {
    for (const [mlsNumber, { element }] of markers.current) {
      element.classList.toggle("listing-pin-active", mlsNumber === activeMls);
    }
  }, [activeMls, listings]);

  return <div ref={container} className="h-full w-full" style={{ position: "absolute", inset: 0 }} aria-label="Map of the listings in this list" role="region" />;
}
