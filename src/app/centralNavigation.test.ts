// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { centralPathForView, parseCentralRoute, pushCentralPath, replaceCentralPath } from "./centralNavigation";

afterEach(() => window.history.replaceState({}, "", "/"));

describe("central navigation", () => {
  it("recognizes the merchant shell and exact store design route", () => {
    expect(parseCentralRoute("/app")).toEqual({ name: "merchant" });
    expect(parseCentralRoute("/app/new")).toEqual({ name: "merchant-new" });
    expect(parseCentralRoute("/app/stores/tenant%201/design")).toEqual({ name: "merchant-design", tenantId: "tenant 1" });
    expect(parseCentralRoute("/reset-password")).toEqual({ name: "auth-flow" });
    expect(parseCentralRoute("/app/stores/tenant/orders")).toEqual({ name: "unknown" });
  });

  it("builds route-owned central paths", () => {
    expect(centralPathForView("merchant_dashboard")).toBe("/app");
    expect(centralPathForView("builder", "tenant/one")).toBe("/app/stores/tenant%2Fone/design");
    expect(centralPathForView("landing")).toBe("/");
  });

  it("pushes and replaces browser history without reloading", () => {
    pushCentralPath("/app");
    expect(window.location.pathname).toBe("/app");
    replaceCentralPath("/app/stores/tenant-1/design");
    expect(window.location.pathname).toBe("/app/stores/tenant-1/design");
  });
});
