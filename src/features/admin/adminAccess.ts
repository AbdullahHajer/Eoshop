import type { UserProfile } from "../../adapters/uiAdapters";

export type AdminSection = "overview" | "stores" | "audit";

const STORES_VIEW = "platform.stores.view";
const AUDIT_VIEW = "platform.audit.view";

export function canViewPlatformStores(user: Pick<UserProfile, "platformPermissions">): boolean {
  return user.platformPermissions.includes(STORES_VIEW);
}

export function canViewPlatformAudit(user: Pick<UserProfile, "platformPermissions">): boolean {
  return user.platformPermissions.includes(AUDIT_VIEW);
}

export function canAccessPlatformConsole(user: Pick<UserProfile, "platformPermissions">): boolean {
  return canViewPlatformStores(user) || canViewPlatformAudit(user);
}

export function authorizedAdminSections(user: Pick<UserProfile, "platformPermissions">): AdminSection[] {
  const sections: AdminSection[] = [];
  if (canViewPlatformStores(user)) sections.push("overview", "stores");
  if (canViewPlatformAudit(user)) sections.push("audit");

  return sections;
}

export function safeAdminSection(
  requested: AdminSection,
  user: Pick<UserProfile, "platformPermissions">,
): AdminSection | null {
  const sections = authorizedAdminSections(user);
  if (sections.includes(requested)) return requested;

  return sections[0] ?? null;
}
