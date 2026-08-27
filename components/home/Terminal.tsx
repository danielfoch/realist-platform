"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { EpisodePlayer } from "@/components/podcast/EpisodePlayer";
import { fmtMoney } from "@/components/multiplex/format";

/* ── data shapes (wire) ─────────────────────────────────────────────── */

interface CityRent {
  city: string;
  province: string;
  lat: number;
  lng: number;
  oneBed: number;
  twoBed: number;
}

interface DealListing {
  listingKey: string;
  listPrice?: number;
  address?: {
    streetNumber?: string;
    streetName?: string;
    streetSuffix?: string;
    city?: string;
    state?: string;
  };
  map?: { latitude?: number; longitude?: number };
  daysOnMarket?: number;
  distress: {
    distressScore: number;
    confidence: string;
    categoriesTriggered: Record<string, boolean>;
  };
  rawRemarks: string;
}

interface DealsResponse {
  warming?: boolean;
  listings?: DealListing[];
  total?: number;
  totalScanned?: number;
  updatedAt?: string;
  error?: string;
}

export interface TerminalEpisode {
  slug: string;
  title: string;
  audioUrl: string;
  imageUrl: string;
}

const CATEGORIES = [
  { key: "foreclosure_pos", label: "Power of sale", color: "#ff3344" },
  { key: "vtb", label: "VTB", color: "#ff7033" },
  { key: "motivated", label: "Motivated", color: "#4cc9f0" },
] as const;

function dealAddress(deal: DealListing): string {
  const a = deal.address ?? {};
  const street = [a.streetNumber, a.streetName, a.streetSuffix].filter(Boolean).join(" ");
  return street || deal.listingKey;
}

function dealCategory(deal: DealListing): (typeof CATEGORIES)[number] {
  return (
    CATEGORIES.find((c) => deal.distress.categoriesTriggered?.[c.key]) ?? CATEGORIES[2]
  );
}

/* ── compact underwrite result ──────────────────────────────────────── */

interface MiniVerdict {
  headline: string;
  units: number;
  score: number | null;
  takeout: string | null;
  sixplex: boolean;
  fullHref: string;
}

/* ── the terminal ───────────────────────────────────────────────────── */

export function Terminal({ episode }: { episode: TerminalEpisode | null }) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [deals, setDeals] = useState<DealsResponse | null>(null);
  const [activeCats, setActiveCats] = useState<string[]>(CATEGORIES.map((c) => c.key));
  const [tab, setTab] = useState<"deals" | "underwrite">("deals");

  // Underwrite form
  const [address, setAddress] = useState("");
  const [frontage, setFrontage] = useState("");
  const [depth, setDepth] = useState("");
  const [running, setRunning] = useState(false);
  const [uwError, setUwError] = useState<string | null>(null);
  const [needsDims, setNeedsDims] = useState(false);
  const [verdict, setVerdict] = useState<MiniVerdict | null>(null);

  /* map boot */
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      // Keyless, production-permitted vector basemap (openfreemap.org).
      style: "https://tiles.openfreemap.org/styles/dark",
      // Vancouver → St. John's: the band where the listings actually are.
      bounds: [
        [-128.5, 42.0],
        [-56.5, 54.5],
      ],
      fitBoundsOptions: { padding: 24 },
      minZoom: 2.5,
      attributionControl: { compact: true },
      // Keeps the frame readable for screenshots/social captures.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    // "load" waits on a render frame, which background/occluded tabs never
    // get — style readiness is enough to attach sources/layers, so data is
    // already on the map the moment the tab becomes visible. Style completion
    // has no reliable terminal event without a frame, hence the short poll.
    map.on("load", () => setMapReady(true));
    const readyPoll = setInterval(() => {
      if (map.isStyleLoaded()) {
        setMapReady(true);
        clearInterval(readyPoll);
      }
    }, 250);
    // Hidden/occluded tabs get no animation frames, which stalls the initial
    // load until the user looks at the tab. redraw() renders synchronously —
    // pump it until the first complete frame so tab-switchers land on a map
    // that is already there.
    const hiddenPump = setInterval(() => {
      if (map.loaded()) {
        clearInterval(hiddenPump);
        return;
      }
      if (document.visibilityState === "hidden") {
        try {
          map.redraw();
        } catch {
          /* mid-teardown */
        }
      }
    }, 400);
    // Debug handle for dev tooling; harmless in production.
    (window as unknown as { __realistMap?: maplibregl.Map }).__realistMap = map;
    mapRef.current = map;

    // The container can measure 0×0 at construction (streamed layout), and
    // maplibre's own observer has proven unreliable in embedded contexts —
    // re-measure on the next frame and on every container resize ourselves.
    const raf = requestAnimationFrame(() => map.resize());
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(mapContainer.current);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(readyPoll);
      clearInterval(hiddenPump);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* ambient rent layer */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    let cancelled = false;
    void fetch("/api/map/rents")
      .then((r) => r.json())
      .then((payload: { cities: CityRent[] }) => {
        if (cancelled || !map.getStyle()) return;
        const geojson = {
          type: "FeatureCollection" as const,
          features: payload.cities.map((c) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
            properties: { ...c },
          })),
        };
        map.addSource("rents", { type: "geojson", data: geojson });
        map.addLayer({
          id: "rent-circles",
          type: "circle",
          source: "rents",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["get", "twoBed"], 1200, 4, 3400, 11],
            "circle-color": "#66718a",
            "circle-opacity": 0.35,
            "circle-stroke-color": "#a9b3c6",
            "circle-stroke-opacity": 0.5,
            "circle-stroke-width": 1,
          },
        });
        map.addLayer({
          id: "rent-labels",
          type: "symbol",
          source: "rents",
          minzoom: 4.4,
          layout: {
            "text-field": ["concat", "$", ["to-string", ["get", "twoBed"]]],
            "text-size": 10.5,
            "text-offset": [0, 1.3],
            "text-font": ["Noto Sans Regular"],
          },
          paint: {
            "text-color": "#a9b3c6",
            "text-halo-color": "#070b14",
            "text-halo-width": 1,
          },
        });
        map.on("click", "rent-circles", (e: maplibregl.MapLayerMouseEvent) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as unknown as CityRent;
          new maplibregl.Popup({ closeButton: true })
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="font-size:13px"><b>${p.city}, ${p.province}</b><br/>` +
                `<span style="color:#a9b3c6">CMHC avg rent</span><br/>` +
                `1BR <b>$${Number(p.oneBed).toLocaleString()}</b> · 2BR <b>$${Number(p.twoBed).toLocaleString()}</b><br/>` +
                `<a href="/listings?city=${encodeURIComponent(p.city)}" style="color:#ff3344">Browse ${p.city} listings →</a></div>`,
            )
            .addTo(map);
        });
        map.on("mouseenter", "rent-circles", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "rent-circles", () => (map.getCanvas().style.cursor = ""));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mapReady]);

  /* deals fetch */
  const loadDeals = useCallback(async () => {
    try {
      const response = await fetch("/api/deals");
      const payload = (await response.json()) as DealsResponse;
      setDeals(payload);
      if (payload.warming) setTimeout(() => void loadDeals(), 20000);
    } catch {
      setDeals({ error: "Deal feed unreachable" });
    }
  }, []);
  useEffect(() => {
    void loadDeals();
  }, [loadDeals]);

  /* deal pins */
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const listings = (deals?.listings ?? []).filter(
      (d) =>
        d.map?.latitude != null &&
        d.map?.longitude != null &&
        activeCats.includes(dealCategory(d).key),
    );
    const geojson = {
      type: "FeatureCollection" as const,
      features: listings.map((d) => {
        const cat = dealCategory(d);
        return {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [d.map!.longitude!, d.map!.latitude!],
          },
          properties: {
            key: d.listingKey,
            color: cat.color,
            label: cat.label,
            address: dealAddress(d),
            city: d.address?.city ?? "",
            price: d.listPrice ?? 0,
            score: d.distress.distressScore,
          },
        };
      }),
    };
    const existing = map.getSource("deals") as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geojson);
      return;
    }
    if (listings.length === 0) return;
    map.addSource("deals", { type: "geojson", data: geojson });
    map.addLayer({
      id: "deal-pins",
      type: "circle",
      source: "deals",
      paint: {
        "circle-radius": 6,
        "circle-color": ["get", "color"],
        "circle-opacity": 0.9,
        "circle-stroke-color": "#070b14",
        "circle-stroke-width": 1.5,
      },
    });
    map.on("click", "deal-pins", (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as Record<string, string | number>;
      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-size:13px"><span style="color:${p.color};font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.05em">${p.label} · ${p.score}/100</span><br/>` +
            `<b>${p.address}</b><br/><span style="color:#a9b3c6">${p.city}</span> · <b>${p.price ? "$" + Number(p.price).toLocaleString() : "—"}</b><br/>` +
            `<a href="/listings/${p.key}" style="color:#ff3344">Open listing →</a></div>`,
        )
        .addTo(map);
    });
    map.on("mouseenter", "deal-pins", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "deal-pins", () => (map.getCanvas().style.cursor = ""));
  }, [mapReady, deals, activeCats]);

  const flyToDeal = (deal: DealListing) => {
    if (deal.map?.latitude == null || deal.map?.longitude == null || !mapRef.current) return;
    mapRef.current.flyTo({ center: [deal.map.longitude, deal.map.latitude], zoom: 13 });
  };

  /* inline underwrite */
  const runUnderwrite = async () => {
    if (address.trim().length < 5) {
      setUwError("Enter a Toronto address, e.g. 82 Oakcrest Ave");
      return;
    }
    setRunning(true);
    setUwError(null);
    setVerdict(null);
    try {
      const body: Record<string, unknown> = { address: address.trim() };
      if (frontage) body.lotFrontageFt = Number(frontage);
      if (depth) body.lotDepthFt = Number(depth);
      const response = await fetch("/api/multiplex/underwrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Underwrite failed");
      if (payload.status === "needs_lot_dimensions") {
        setNeedsDims(true);
        setRunning(false);
        return;
      }
      setNeedsDims(false);
      const u = payload.underwrite;
      const params = new URLSearchParams({ address: address.trim() });
      if (frontage) params.set("frontage", frontage);
      if (depth) params.set("depth", depth);
      params.set("run", "1");
      const fullHref = payload.shareToken
        ? `/multiplex/r/${payload.shareToken}`
        : `/multiplex?${params.toString()}`;
      setVerdict({
        headline: u.feasibility?.quickRead?.headline ?? "Screen complete",
        units: u.maxUnitsAsOfRight,
        score: u.recommendedTakeout?.score ?? null,
        takeout:
          u.recommendedTakeout?.takeout === "hold"
            ? "MLI Select hold"
            : u.recommendedTakeout?.takeout === "condo"
              ? "Condo exit"
              : null,
        sixplex: !!u.sixplex?.eligible,
        fullHref,
      });
      if (payload.site?.lat && payload.site?.lng && mapRef.current) {
        mapRef.current.flyTo({ center: [payload.site.lng, payload.site.lat], zoom: 15 });
        new maplibregl.Marker({ color: "#ff3344" })
          .setLngLat([payload.site.lng, payload.site.lat])
          .addTo(mapRef.current);
      }
    } catch (error) {
      setUwError((error as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const visibleDeals = (deals?.listings ?? [])
    .filter((d) => activeCats.includes(dealCategory(d).key))
    .slice(0, 60);

  /* ── render ────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col lg:h-[calc(100vh-3.25rem)] lg:flex-row">
      {/* Map */}
      <div className="relative h-[52vh] flex-1 lg:h-auto">
        {/* Inline position: maplibre-gl.css sets .maplibregl-map to relative
            and would beat the utility class on source order. */}
        <div ref={mapContainer} style={{ position: "absolute", inset: 0 }} />

        {/* Floating category chips */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => {
            const active = activeCats.includes(cat.key);
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() =>
                  setActiveCats((current) =>
                    current.includes(cat.key)
                      ? current.filter((k) => k !== cat.key)
                      : [...current, cat.key],
                  )
                }
                className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[11px] font-semibold backdrop-blur transition-colors ${
                  active
                    ? "border-hairline-strong bg-paper/85 text-ink"
                    : "border-hairline bg-paper/60 text-ink-faint"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: cat.color, opacity: active ? 1 : 0.35 }}
                />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Status line */}
        <div className="absolute bottom-6 left-3 rounded border border-hairline bg-paper/85 px-2.5 py-1.5 text-[11px] text-ink-faint backdrop-blur">
          {deals?.listings ? (
            <span>
              <span className="tnum text-ink">{deals.total}</span> motivated deals ·{" "}
              <span className="tnum">{deals.totalScanned?.toLocaleString("en-CA")}</span> listings
              scanned · grey circles = CMHC 2BR rent
            </span>
          ) : deals?.warming ? (
            <span>Scanning the MLS® for motivated deals — pins land shortly…</span>
          ) : (
            <span>Grey circles = CMHC average 2BR rent · deal pins arrive when the scanner connects</span>
          )}
        </div>
      </div>

      {/* Rail */}
      <aside className="flex w-full flex-col border-t border-hairline bg-surface lg:w-[400px] lg:border-l lg:border-t-0">
        {/* Tabs */}
        <div className="flex border-b border-hairline">
          {(
            [
              ["deals", "Deal feed"],
              ["underwrite", "Underwrite a site"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 px-3 py-2.5 text-[12px] font-bold uppercase tracking-wider transition-colors ${
                tab === key
                  ? "border-b-2 border-brand text-ink"
                  : "text-ink-faint hover:text-ink-soft"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "underwrite" ? (
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              Toronto address in, development screen out: zoning permissions,
              buildable envelope, and a CMHC proforma in ~20 seconds.
            </p>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runUnderwrite()}
              placeholder="82 Oakcrest Ave, Toronto"
              className="mt-3 w-full rounded border border-hairline-strong bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="number"
                value={frontage}
                onChange={(e) => setFrontage(e.target.value)}
                placeholder="Frontage ft"
                className="tnum w-full rounded border border-hairline-strong bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand"
              />
              <input
                type="number"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                placeholder="Depth ft"
                className="tnum w-full rounded border border-hairline-strong bg-paper px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand"
              />
            </div>
            <button
              type="button"
              onClick={runUnderwrite}
              disabled={running}
              className="mt-2.5 w-full rounded bg-brand px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
            >
              {running ? "Running the screen…" : "Underwrite"}
            </button>
            {uwError && <p className="mt-2 text-[13px] text-bad">{uwError}</p>}
            {needsDims && (
              <p className="mt-2 rounded border border-hairline bg-paper px-3 py-2 text-[13px] text-ink-soft">
                Site resolved. Add frontage + depth (from the listing or GeoWarehouse)
                and run again.
              </p>
            )}
            {verdict && (
              <div className="mt-3 rounded border border-brand/40 bg-brand-wash p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand">
                  Verdict
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug text-ink">
                  {verdict.headline}
                </p>
                <div className="tnum mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft">
                  <span>
                    <b className="text-ink">{verdict.units}</b> units as-of-right
                  </span>
                  {verdict.sixplex && <span className="text-good">sixplex eligible</span>}
                  {verdict.score != null && verdict.takeout && (
                    <span>
                      {verdict.takeout}: <b className="text-ink">{fmtMoney(verdict.score, true)}</b>
                    </span>
                  )}
                </div>
                <Link
                  href={verdict.fullHref}
                  className="mt-2.5 block rounded bg-brand px-3 py-2 text-center text-[13px] font-bold text-white hover:bg-brand-deep"
                >
                  Open the full report →
                </Link>
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              Screening estimate, not advice. Full methodology, concepts, and the
              proforma live on the{" "}
              <Link href="/multiplex" className="text-ink-soft underline">
                multiplex underwriter
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {deals?.warming && (
              <div className="p-4 text-[13px] leading-relaxed text-ink-soft">
                <p className="font-semibold text-ink">Scanning the MLS® right now…</p>
                <p className="mt-1">
                  Reading remarks on thousands of listings for power-of-sale, VTB, and
                  motivated-seller language. First pass takes a few minutes.
                </p>
              </div>
            )}
            {deals?.error && (
              <div className="p-4 text-[13px] text-ink-soft">
                <p className="font-semibold text-ink">Deal feed connecting…</p>
                <p className="mt-1">
                  The scanner isn&rsquo;t wired to the MLS® feed in this environment yet.
                  The map still shows live CMHC rents — and the{" "}
                  <Link href="/multiplex" className="text-brand">
                    underwriter
                  </Link>{" "}
                  is fully live.
                </p>
              </div>
            )}
            {visibleDeals.map((deal) => {
              const cat = dealCategory(deal);
              return (
                <button
                  key={deal.listingKey}
                  type="button"
                  onClick={() => flyToDeal(deal)}
                  className="block w-full border-b border-hairline px-4 py-3 text-left transition-colors hover:bg-raised"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-ink">
                      {dealAddress(deal)}
                    </span>
                    <span className="tnum shrink-0 text-[13px] text-ink">
                      {fmtMoney(deal.listPrice ?? null, true)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-faint">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: cat.color }}
                    />
                    <span className="font-semibold uppercase tracking-wide" style={{ color: cat.color }}>
                      {cat.label}
                    </span>
                    <span className="tnum">{deal.distress.distressScore}/100</span>
                    <span className="truncate">
                      {[deal.address?.city, deal.address?.state].filter(Boolean).join(", ")}
                    </span>
                    <Link
                      href={`/listings/${deal.listingKey}`}
                      className="ml-auto shrink-0 text-brand hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open →
                    </Link>
                  </div>
                </button>
              );
            })}
            {deals?.listings && visibleDeals.length === 0 && !deals.warming && (
              <p className="p-4 text-[13px] text-ink-soft">
                No qualified deals in those categories right now — the scan refreshes
                twice a day.
              </p>
            )}
          </div>
        )}

        {/* Podcast dock */}
        <div className="border-t border-hairline bg-paper/60 p-3.5">
          <div className="flex items-center gap-3">
            {episode?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={episode.imageUrl}
                alt="The Canadian Real Estate Investor"
                className="h-12 w-12 shrink-0 rounded border border-hairline object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-brand">
                Canada&rsquo;s #1 real estate podcast
              </p>
              {episode ? (
                <Link
                  href={`/podcast/${episode.slug}`}
                  className="mt-0.5 block truncate text-[13px] font-semibold text-ink hover:text-brand"
                >
                  {episode.title}
                </Link>
              ) : (
                <p className="mt-0.5 text-[13px] text-ink-soft">New episodes Tue &amp; Fri</p>
              )}
            </div>
            <Link
              href="/podcast"
              className="shrink-0 text-[12px] font-semibold text-ink-faint hover:text-ink"
            >
              All →
            </Link>
          </div>
          {episode && (
            <div className="mt-2.5">
              <EpisodePlayer audioUrl={episode.audioUrl} title={episode.title} compact />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
