import { NextResponse } from "next/server";
import { getAssumptions } from "@/lib/multiplex/underwriter";

export async function GET() {
  try {
    const assumptions = await getAssumptions();
    return NextResponse.json({ assumptions });
  } catch (error) {
    console.error("[api/multiplex/assumptions]", error);
    return NextResponse.json({ assumptions: [] });
  }
}
