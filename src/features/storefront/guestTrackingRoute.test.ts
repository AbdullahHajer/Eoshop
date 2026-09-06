import { describe, expect, it } from "vitest";
import {
  isGuestTrackingCapability,
  normalizeServerTrackingUrl,
  parseGuestTrackingLocation,
  parseGuestTrackingUrl,
  trackingUrlForCapability,
} from "./guestTrackingRoute";

const capability = `eot1_${"a".repeat(43)}`;

describe("guest tracking route", () => {
  it("accepts only the fixed path, one token parameter and the versioned capability shape", () => {
    expect(isGuestTrackingCapability(capability)).toBe(true);
    expect(parseGuestTrackingLocation("/track", `#token=${capability}`)).toEqual({
      capability,
      invalidCapability: false,
    });
    expect(parseGuestTrackingLocation("/track/", "")).toEqual({ capability: null, invalidCapability: false });
    expect(parseGuestTrackingLocation("/", `#token=${capability}`)).toBeNull();
    expect(parseGuestTrackingLocation("/track", `#token=${capability}&order=EO-1`)).toEqual({ capability: null, invalidCapability: true });
    expect(parseGuestTrackingLocation("/track", "#token=eot1_short")).toEqual({ capability: null, invalidCapability: true });
    expect(parseGuestTrackingLocation("/track", `#token=${capability.replace("a", "%61")}`)).toEqual({ capability: null, invalidCapability: true });
  });

  it("builds and parses same-origin URLs without placing the capability in the request path", () => {
    const url = trackingUrlForCapability(capability, "https://shop.example.test");
    expect(url).toBe(`https://shop.example.test/track#token=${capability}`);
    expect(new URL(url).pathname).toBe("/track");
    expect(new URL(url).search).toBe("");
    expect(parseGuestTrackingUrl(url, "https://shop.example.test")).toBe(capability);
    expect(parseGuestTrackingUrl(capability, "https://shop.example.test")).toBe(capability);
    expect(parseGuestTrackingUrl(`https://other.example.test/track#token=${capability}`, "https://shop.example.test")).toBeNull();
  });

  it("accepts only canonical server-relative tracking URLs", () => {
    expect(normalizeServerTrackingUrl(`/track#token=${capability}`)).toBe(`/track#token=${capability}`);
    expect(normalizeServerTrackingUrl(`/track?token=${capability}`)).toBeNull();
    expect(normalizeServerTrackingUrl(`https://shop.example.test/track#token=${capability}`)).toBeNull();
    expect(normalizeServerTrackingUrl(`/track#token=${capability}&extra=1`)).toBeNull();
  });
});
