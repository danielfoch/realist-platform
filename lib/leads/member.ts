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

/** Someone turned Realist email off: the CRM must stop mailing them too. Never blocks the unsubscribe itself. */
export async function announceUnsubscribe(user: Pick<User, "id" | "email" | "name">, schedule: boolean = true): Promise<void> {
  try {
    const { lead, duplicate } = await captureLead({ kind: "unsubscribe", email: user.email, name: user.name, userId: user.id });
    if (duplicate) return;
    if (schedule) after(() => deliverDue({ leadId: lead.id }).catch(() => {}));
    else await deliverDue({ leadId: lead.id }).catch(() => {});
  } catch (error) {
    console.error("[leads] unsubscribe not passed to the CRM:", (error as Error).message);
  }
}

/** The people a member says they still need — a tag per role in the CRM, no email, no form. */
export async function announceTeamGap(user: User, roles: string[]): Promise<void> {
  if (roles.length === 0) return;
  try {
    const { lead, duplicate } = await captureLead({
      kind: "team_gap",
      email: user.email,
      name: user.name,
      phone: user.phone,
      city: user.city,
      province: user.province,
      userId: user.id,
      consentMarketing: user.consentMarketing,
      context: { roles },
    });
    if (!duplicate) after(() => deliverDue({ leadId: lead.id }).catch(() => {}));
  } catch (error) {
    console.error("[leads] team gap not captured:", (error as Error).message);
  }
}
