import { NextResponse } from "next/server";
import { CITY_COORDS } from "@/lib/geo/cityCoords";
import { getCmhcRent } from "@/lib/rents/cmhcRents";

export const revalidate = 86400;

/**
 * The homepage map's ambient layer: median-ish 1BR/2BR rents per city from
 * the in-repo CMHC table. Zero external dependencies — the map is never
 * empty, even before database or DDF credentials exist.
 */
export async function GET() {
  const cities = CITY_COORDS.map((point) => ({
    ...point,
    oneBed: getCmhcRent(1, point.city, point.province).rent,
    twoBed: getCmhcRent(2, point.city, point.province).rent,
  }));
  return NextResponse.json({ cities });
}
