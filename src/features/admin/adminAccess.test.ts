import { describe, expect, it } from "vitest";
import type { UserProfile } from "../../adapters/uiAdapters";
import {
  authorizedAdminSections,
  canAccessPlatformConsole,
  safeAdminSection,
} from "./adminAccess";

function user(platformPermissions: string[]): UserProfile {
  return {
    id: "01USER",
    fullName: "مستخدم",
    email: "user@example.com",
    phone: "",
    role: platformPermissions.length > 0 ? "admin" : "merchant",
    platformRoles: [],
    platformPermissions,
  };
}

describe("platform administration access", () => {
  it("routes store and audit operators only to authorized sections", () => {
    const storesOnly = user(["platform.stores.view"]);
    const auditOnly = user(["platform.audit.view"]);

    expect(authorizedAdminSections(storesOnly)).toEqual(["overview", "stores"]);
    expect(safeAdminSection("audit", storesOnly)).toBe("overview");
    expect(authorizedAdminSections(auditOnly)).toEqual(["audit"]);
    expect(safeAdminSection("overview", auditOnly)).toBe("audit");
  });

  it("fails closed for merchants without either read permission", () => {
    const merchant = user([]);

    expect(canAccessPlatformConsole(merchant)).toBe(false);
    expect(authorizedAdminSections(merchant)).toEqual([]);
    expect(safeAdminSection("overview", merchant)).toBeNull();
  });
});
