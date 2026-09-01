// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import TechTrustTicker from "./TechTrustTicker";

afterEach(cleanup);

describe("TechTrustTicker", () => {
  it("renders only supplied server-backed facts in RTL order", () => {
    const view = render(
      <div dir="rtl">
        <TechTrustTicker
          items={[
            { key: "shipping", label: "رسوم الشحن 500 YER" },
            { key: "cod", label: "الدفع عند الاستلام مفعّل" },
          ]}
          tokens={{ surface: "#0F172A", ink: "#FFFFFF", mutedInk: "#E2E8F0", border: "#334155", accent: "#38BDF8" }}
        />
      </div>,
    );

    const ticker = view.container.querySelector("[data-tech-trust-ticker]") as HTMLElement;
    expect(ticker.closest('[dir="rtl"]')).not.toBeNull();
    expect(screen.getByText("رسوم الشحن 500 YER")).toBeTruthy();
    expect(screen.getByText("الدفع عند الاستلام مفعّل")).toBeTruthy();
    expect(ticker.style.getPropertyValue("--tech-surface")).toBe("#0F172A");
    expect(screen.queryByText(/الأكثر طلبًا|خصم|ضمان/)).toBeNull();
  });

  it("shows a truthful empty state", () => {
    render(<TechTrustTicker items={[]} />);
    expect(screen.getByText("لم ينشر المتجر معلومات خدمة بعد.")).toBeTruthy();
  });
});
