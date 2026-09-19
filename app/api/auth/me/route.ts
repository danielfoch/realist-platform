import { getCurrentUser, toViewer } from "@/lib/auth/current";
import { emailConfigured } from "@/lib/email";
import { googleConfigured } from "@/lib/auth/google";

export const dynamic = "force-dynamic";

/** Who is signed in, plus which sign-in methods this deployment offers. */
export async function GET() {
  const user = await getCurrentUser();
  return Response.json(
    {
      user: user ? toViewer(user) : null,
      methods: { google: googleConfigured(), emailLink: emailConfigured() },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
