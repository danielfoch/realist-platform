/**
 * Ontario MTM Zone 10 → WGS84 lat/lng.
 *
 * City of Toronto CKAN datasets ship X/Y as MTM Zone 10 easting/northing in
 * metres (central meridian −79.5°, scale 0.9999, false easting 304800, Clarke
 * 1866 / NAD27). They are NOT UTM 17N — a Toronto easting is ~314k in MTM10 but
 * would be ~630k in UTM17N, so mislabelling the projection lands points ~350km
 * west. Verified 2026-07: reprojecting the live Development Applications X/Y put
 * 80/80 sampled records inside Toronto's bounding box (1001 Sheppard Ave →
 * 43.771, −79.375). NAD27→WGS84 datum drift is ~1–2 m — ignorable for a
 * proximity signal.
 *
 * Pure module: inverse transverse Mercator, no dependencies.
 */

const A = 6378206.4; // Clarke 1866 semi-major axis (m)
const F = 1 / 294.9786982; // Clarke 1866 flattening
const K0 = 0.9999; // MTM scale factor
const LON0 = (-79.5 * Math.PI) / 180; // MTM Zone 10 central meridian
const FALSE_EASTING = 304800; // metres (= 1,000,000 ft, legacy)

const E2 = 2 * F - F * F;
const EP2 = E2 / (1 - E2);
const E1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));

export interface LatLng {
  lat: number;
  lng: number;
}

/** Reproject an MTM Zone 10 easting/northing (metres) to WGS84 degrees. */
export function mtm10ToLatLng(easting: number, northing: number): LatLng {
  const x = easting - FALSE_EASTING;
  const M = northing / K0;
  const mu = M / (A * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256));
  const phi1 =
    mu +
    ((3 * E1) / 2 - (27 * E1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * E1 ** 2) / 16 - (55 * E1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * E1 ** 3) / 96) * Math.sin(6 * mu);
  const sp = Math.sin(phi1);
  const cp = Math.cos(phi1);
  const tp = Math.tan(phi1);
  const N1 = A / Math.sqrt(1 - E2 * sp * sp);
  const T1 = tp * tp;
  const C1 = EP2 * cp * cp;
  const R1 = (A * (1 - E2)) / (1 - E2 * sp * sp) ** 1.5;
  const D = x / (N1 * K0);
  const lat =
    phi1 -
    ((N1 * tp) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6) / 720);
  const lng =
    LON0 +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5) / 120) /
      cp;
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

/** Rough Toronto envelope used to reject bad/blank coordinates after reprojection. */
export function isWithinToronto({ lat, lng }: LatLng): boolean {
  return lat >= 43.55 && lat <= 43.9 && lng >= -79.7 && lng <= -79.1;
}
