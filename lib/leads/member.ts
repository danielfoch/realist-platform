import { after } from "next/server";
import type { User } from "@/lib/db/schema";
import { captureLead } from "./capture";
import { deliverDue } from "./outbox";

/**
 * A new member is a lead: they land in the CRM tagged `new-signup` the moment
 * the account exists. Never allowed to break sign-up — the account matters
 * more than the CRM row.
 */
export async function announceNewMember(user: User, via: "password" | "google" | "magic_link", request: Request): Promise<void> {
  try {
    const { lead, duplicate } = await captureLead({
      kind: "signup",
      email: user.email,
      name: user.name,
      phone: user.phone,
      city: user.city,
      province: user.province,
      userId: user.id,
      consentMarketing: user.consentMarketing,
      context: { via },
      pagePath: new URL(request.url).pathname,
    });
    if (!duplicate) after(() => deliverDue({ leadId: lead.id }).catch(() => {}));
  } catch (error) {
    console.error("[leads] new member not captured:", (error as Error).message);
  }
}
