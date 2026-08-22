// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { adminPath, centralPathForView, merchantStorePath, parseCentralRoute, pushCentralPath, replaceCentralPath } from "./centralNavigation";

afterEach(() => window.history.replaceState({}, "", "/"));

describe("central navigation", () => {
  it("recognizes the merchant shell and exact store design route", () => {
    expect(parseCentralRoute("/app")).toEqual({ name: "merchant" });
    expect(parseCentralRoute("/app/new")).toEqual({ name: "merchant-new" });
    expect(parseCentralRoute("/app/stores/tenant%201")).toEqual({ name: "merchant-store", tenantId: "tenant 1", section: "overview" });
    expect(parseCentralRoute("/app/stores/tenant%201/design")).toEqual({ name: "merchant-store", tenantId: "tenant 1", section: "design" });
    expect(parseCentralRoute("/app/stores/tenant/orders")).toEqual({ name: "merchant-store", tenantId: "tenant", section: "orders" });
    expect(parseCentralRoute("/reset-password")).toEqual({ name: "auth-flow" });
    expect(parseCentralRoute("/admin")).toEqual({ name: "admin", section: "overview" });
    expect(parseCentralRoute("/admin/stores")).toEqual({ name: "admin", section: "stores" });
    expect(parseCentralRoute("/admin/users")).toEqual({ name: "admin", section: "users" });
    expect(parseCentralRoute("/admin/audit")).toEqual({ name: "admin", section: "audit" });
    expect(parseCentralRoute("/admin/settings")).toEqual({ name: "admin", section: "settings" });
    expect(parseCentralRoute("/admin/unknown")).toEqual({ name: "unknown" });
    expect(parseCentralRoute("/app/stores/tenant/unknown")).toEqual({ name: "unknown" });
  });

  it("builds fixed administration paths", () => {
    expect(adminPath()).toBe("/admin");
    expect(adminPath("stores")).toBe("/admin/stores");
    expect(adminPath("users")).toBe("/admin/users");
    expect(adminPath("audit")).toBe("/admin/audit");
    expect(adminPath("settings")).toBe("/admin/settings");
  });

  it("builds route-owned central paths", () => {
    expect(centralPathForView("merchant_dashboard")).toBe("/app");
    expect(centralPathForView("merchant_store", "tenant/one")).toBe("/app/stores/tenant%2Fone");
    expect(centralPathForView("builder", "tenant/one")).toBe("/app/stores/tenant%2Fone/design");
    expect(centralPathForView("landing")).toBe("/");
    expect(merchantStorePath("tenant/one", "inventory")).toBe("/app/stores/tenant%2Fone/inventory");
  });

  it("pushes and replaces browser history without reloading", () => {
    pushCentralPath("/app");
    expect(window.location.pathname).toBe("/app");
    replaceCentralPath("/app/stores/tenant-1/design");
    expect(window.location.pathname).toBe("/app/stores/tenant-1/design");
  });
});
