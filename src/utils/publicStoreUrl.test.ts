import { describe, expect, it } from "vitest";
import { publicStoreUrl } from "./publicStoreUrl";

describe("publicStoreUrl", () => {
  it("preserves the Pilot gateway port for a tenant hostname", () => {
    expect(publicStoreUrl("qa-shop.lvh.me", { protocol: "http:", port: "8000" }))
      .toBe("http://qa-shop.lvh.me:8000");
  });

  it("uses the current secure scheme without adding a default port", () => {
    expect(publicStoreUrl("shop.example.com", { protocol: "https:", port: "" }))
      .toBe("https://shop.example.com");
  });

  it("rejects a value that is not a canonical host", () => {
    expect(() => publicStoreUrl("shop.example.com:8000", { protocol: "http:", port: "8000" }))
      .toThrow("canonical public store domain");
  });
});
