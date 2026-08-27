import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import {
  executeMultiplexUnderwriter,
  underwriteRequestSchema,
} from "@/lib/multiplex/underwriter";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = underwriteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Anonymous attribution: a stable cookie id so shared reports and future
  // account claiming can link back to the session that ran them.
  const cookieStore = await cookies();
  let sessionId = cookieStore.get("realist_sid")?.value;
  if (!sessionId) {
    sessionId = crypto.randomBytes(16).toString("hex");
  }

  try {
    const result = await executeMultiplexUnderwriter(parsed.data, { sessionId });
    const response = NextResponse.json(result);
    response.cookies.set("realist_sid", sessionId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    return response;
  } catch (error) {
    const err = error as Error;
    if (err.name === "SiteResolutionError") {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("[api/multiplex/underwrite]", err);
    return NextResponse.json(
      { error: "Underwrite failed — please try again." },
      { status: 500 },
    );
  }
}
