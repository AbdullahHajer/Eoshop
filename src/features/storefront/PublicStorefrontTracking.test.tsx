// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GuestOrderTracking } from "../../adapters/uiAdapters";
import PublicStorefrontScreen from "./PublicStorefrontScreen";

const capability = `eot1_${"A".repeat(43)}`;

const tracking: GuestOrderTracking = {
  number: "EO-TRACK-1",
  orderStatus: "processing",
  fulfillmentStatus: "preparing",
  createdAt: "2026-09-06T10:00:00Z",
  updatedAt: "2026-09-06T10:05:00Z",
  timeline: [
    { stage: "submitted", occurredAt: "2026-09-06T10:00:00Z" },
    { stage: "preparing", occurredAt: "2026-09-06T10:05:00Z" },
  ],
};

const props = {
  storefront: null,
  error: null,
  loading: true,
  cart: [],
  addToCart: vi.fn(),
  updateQuantity: vi.fn(),
  isCartDrawerOpen: false,
  setIsCartDrawerOpen: vi.fn(),
  hasOrdered: false,
  handleCheckout: vi.fn(),
  selectedCategory: "الكل",
  setSelectedCategory: vi.fn(),
  submitOrder: vi.fn(),
};

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("public guest tracking route", () => {
  it("owns /track before storefront loading and never renders the capability as text", async () => {
    window.history.replaceState({}, "", `/track#token=${capability}`);
    const lookupOrder = vi.fn(async () => tracking);

    render(<PublicStorefrontScreen {...props} lookupOrder={lookupOrder} />);

    expect(screen.getByRole("heading", { name: "تتبّع طلبك" })).toBeTruthy();
    expect(await screen.findByText("EO-TRACK-1")).toBeTruthy();
    expect(lookupOrder).toHaveBeenCalledWith(capability, expect.any(AbortSignal));
    expect(document.body.textContent).not.toContain(capability);
    expect(screen.queryByText("جارٍ تحميل المتجر…")).toBeNull();
  });

  it("keeps the capability fragment intact when the keyboard skip control moves focus", async () => {
    window.history.replaceState({}, "", `/track#token=${capability}`);
    const user = userEvent.setup();

    render(<PublicStorefrontScreen {...props} lookupOrder={vi.fn(async () => tracking)} />);

    const success = await screen.findByTestId("tracking-success");
    await user.click(screen.getByRole("button", { name: "تخطي إلى حالة الطلب" }));

    expect(document.activeElement).toBe(success);
    expect(window.location.hash).toBe(`#token=${capability}`);
    expect(screen.getByTestId("tracking-success")).toBeTruthy();
  });

  it("fails closed for a missing or malformed fragment without calling lookup", () => {
    window.history.replaceState({}, "", "/track#token=bad");
    const lookupOrder = vi.fn(async () => tracking);

    render(<PublicStorefrontScreen {...props} lookupOrder={lookupOrder} />);

    expect(screen.getByRole("heading", { name: "تعذّر فتح رابط التتبع" })).toBeTruthy();
    expect(lookupOrder).not.toHaveBeenCalled();
  });

  it("reacts to fragment changes while keeping the fixed tracking pathname", async () => {
    window.history.replaceState({}, "", "/track");
    const lookupOrder = vi.fn(async () => tracking);
    render(<PublicStorefrontScreen {...props} lookupOrder={lookupOrder} />);
    expect(screen.getByRole("heading", { name: "رابط التتبع غير مكتمل" })).toBeTruthy();

    window.history.replaceState({}, "", `/track#token=${capability}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    await waitFor(() => expect(lookupOrder).toHaveBeenCalledWith(capability, expect.any(AbortSignal)));
    expect(await screen.findByText("EO-TRACK-1")).toBeTruthy();
  });
});
