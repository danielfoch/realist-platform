"use client";

import { useSearchParams } from "next/navigation";
import { LeadForm } from "@/components/leads/LeadForm";
import { POWER_TEAM_ROLES } from "@/lib/team/roles";

/** The intro request. Roles can arrive preselected (?roles=realtor,lawyer) from the account checklist or a deal. */
export function TeamRequestForm() {
  const params = useSearchParams();
  const known = new Set(POWER_TEAM_ROLES.map((role) => role.key));
  const roles = (params.get("roles") ?? "").split(",").filter((key) => known.has(key));
  return (
    <LeadForm
      kind="power_team"
      ask={["name", "phone", "city", "province", "roles", "timeline", "message"]}
      defaultRoles={roles}
      defaultCity={params.get("city")}
      defaultProvince={params.get("province")}
      messagePlaceholder="The deal or the plan — a triplex in Hamilton, a garden suite, a first rental…"
      submitLabel="Introduce me"
      successMessage="Got it. We'll make the introductions — usually within a business day."
    />
  );
}
