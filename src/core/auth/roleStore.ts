import type { User } from "@/features/auth/types/authTypes";
import type { Role } from "@/types/domain";

/**
 * Backend-driven role: exactly one of buyer/seller/broker in `user.roles`
 * decides the workspace. Ambiguous accounts (multiple or none) fall back
 * to buyer Browse.
 */
export function resolveBackendRole(user: Pick<User, "roles"> | null | undefined): Role | null {
  const roles = (user?.roles ?? []).map((r) =>
    typeof r === "string" ? r.trim().toLowerCase() : "",
  );
  const isBuyer = roles.includes("buyer");
  const isSeller = roles.includes("seller");
  const isBroker = roles.includes("broker");
  if (isBroker && !isBuyer && !isSeller) return "broker";
  if (isSeller && !isBuyer) return "seller";
  if (isBuyer && !isSeller) return "buyer";
  return null;
}

/**
 * Workspace landing screen for a role (ambiguous roles default to buyer Browse).
 * Both buyer and broker land on Browse by default; seller lands on requirements.
 */
export function homePath(role: Role | null): "/browse" | "/requirements" {
  if (role === "broker") return "/browse";
  return role === "seller" ? "/requirements" : "/browse";
}
