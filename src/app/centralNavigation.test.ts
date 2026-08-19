// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { centralPathForView, merchantStorePath, parseCentralRoute, pushCentralPath, replaceCentralPath } from "./centralNavigation";

afterEach(() => window.history.replaceState({}, "", "/"));

describe("central navigation", () => {
  it("recognizes the merchant shell and exact store design route", () => {
    expect(parseCentralRoute("/app")).toEqual({ name: "merchant" });
    expect(parseCentralRoute("/app/new")).toEqual({ name: "merchant-new" });
    expect(parseCentralRoute("/app/stores/tenant%201")).toEqual({ name: "merchant-store", tenantId: "tenant 1", section: "overview" });
    expect(parseCentralRoute("/app/stores/tenant%201/design")).toEqual({ name: "merchant-store", tenantId: "tenant 1", section: "design" });
    expect(parseCentralRoute("/app/stores/tenant/orders")).toEqual({ name: "merchant-store", tenantId: "tenant", section: "orders" });
    expect(parseCentralRoute("/reset-password")).toEqual({ name: "auth-flow" });
    expect(parseCentralRoute("/app/stores/tenant/unknown")).toEqual({ name: "unknown" });
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
