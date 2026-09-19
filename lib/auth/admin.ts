import type { User } from "@/lib/db/schema";

/**
 * Who may see operator pages. Either the account carries the admin role (set in
 * the database, and preserved for v1 admins by the migration), or its address
 * is listed in ADMIN_EMAILS — but only once that address is VERIFIED. Password
 * sign-up doesn't prove who owns an inbox, so an unverified match is worthless:
 * otherwise anyone could register an admin's email and walk in.
 */
export function isAdmin(user: Pick<User, "role" | "email" | "emailVerifiedAt"> | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!user.emailVerifiedAt) return false;
  const listed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return listed.includes(user.email.toLowerCase());
}
