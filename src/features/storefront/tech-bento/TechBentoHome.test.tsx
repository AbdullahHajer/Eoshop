// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contrastRatio, readableAccent } from "../../../utils/readableForeground";
import TechBentoHome from "./TechBentoHome";
import type { TechBentoHomeViewModel, TechMarketingTileViewModel } from "./model";

afterEach(cleanup);

function item(index: number, overrides: Partial<TechMarketingTileViewModel> = {}): TechMarketingTileViewModel {
  return {
    id: `tile-${index}`,
    title: `مساحة ${index}`,
    subtitle: `وصف مساحة ${index}`,
    badge: `جديد ${index}`,
    ctaLabel: "استكشف",
    imageUrl: `https://cdn.example.test/tile-${index}.webp`,
    mobileImageUrl: `https://cdn.example.test/tile-${index}-mobile.webp`,
    altText: `صورة مساحة ${index}`,
    overlayOpacity: 58,
    focalPointX: 50,
    focalPointY: 50,
    disclosure: "none",
    targetType: "products",
    ...overrides,
  };
}

function model(overrides: Partial<TechBentoHomeViewModel> = {}): TechBentoHomeViewModel {
  return {
    hero: {
      title: "اكتشف التقنية بأسلوب جديد",
      subtitle: "أحدث الأجهزة في واجهة واضحة وسريعة.",
      badge: "تقنية مختارة",
      ctaLabel: "ابدأ الاكتشاف",
      imageUrl: "https://cdn.example.test/hero.webp",
      mobileImageUrl: "https://cdn.example.test/hero-mobile.webp",
      height: "medium",
      overlayOpacity: 10,
      focalPointX: 64,
      focalPointY: 42,
      targetType: "products",
    },
    bentoItems: Array.from({ length: 5 }, (_, index) => item(index + 1)),
    sideAds: [
      item(6, { disclosure: "ad", sponsorName: "بيت الألعاب" }),
      item(7, { disclosure: "sponsored", sponsorName: "علامة التقنية" }),
    ],
    discoveryItems: Array.from({ length: 10 }, (_, index) => item(index + 8)),
    ...overrides,
  };
}

describe("TechBentoHome isolated presentation", () => {
  it("renders the hero, five Bento tiles, two ads and ten discovery items", () => {
    const view = render(
      <TechBentoHome model={model()} onOpenHero={vi.fn()} onOpenMarketingItem={vi.fn()} onOpenProducts={vi.fn()} />,
    );

    expect(screen.getByRole("heading", { name: "اكتشف التقنية بأسلوب جديد" })).toBeTruthy();
    expect(view.container.querySelector("[data-storefront-hero]")?.getAttribute("data-storefront-hero-height")).toBe("medium");
    expect(view.container.querySelectorAll('[data-tech-marketing-placement="hero_bento"]')).toHaveLength(5);
    expect(view.container.querySelectorAll('[data-tech-marketing-placement="side_ad"]')).toHaveLength(2);
    expect(view.container.querySelectorAll("[data-tech-discovery-id]")).toHaveLength(10);
    expect(screen.getByText("إعلان · بيت الألعاب")).toBeTruthy();
    expect(screen.getByText("برعاية · علامة التقنية")).toBeTruthy();
    expect(view.container.querySelector('source[srcset="https://cdn.example.test/hero-mobile.webp"]')).not.toBeNull();
  });

  it("routes every real action through the supplied callbacks", () => {
    const onOpenHero = vi.fn();
    const onOpenMarketingItem = vi.fn();
    const onOpenProducts = vi.fn();
    const currentModel = model();
    const view = render(
      <TechBentoHome model={currentModel} onOpenHero={onOpenHero} onOpenMarketingItem={onOpenMarketingItem} onOpenProducts={onOpenProducts} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "ابدأ الاكتشاف" }));
    expect(onOpenHero).toHaveBeenCalledWith(currentModel.hero);

    const firstBento = view.container.querySelector('[data-tech-marketing-id="tile-1"]');
    fireEvent.click(within(firstBento as HTMLElement).getByRole("button", { name: "استكشف: مساحة 1" }));
    expect(onOpenMarketingItem).toHaveBeenCalledWith(currentModel.bentoItems[0]);

    fireEvent.click(screen.getByRole("button", { name: "فتح مساحة 8" }));
    expect(onOpenMarketingItem).toHaveBeenCalledWith(currentModel.discoveryItems[0]);
    fireEvent.click(screen.getByRole("button", { name: "كل المنتجات" }));
    expect(onOpenProducts).toHaveBeenCalledTimes(1);
  });

  it("shows bounded loading and truthful empty states", () => {
    const emptyModel = model({ bentoItems: [], sideAds: [], discoveryItems: [] });
    const view = render(
      <TechBentoHome model={emptyModel} loading onOpenHero={vi.fn()} onOpenMarketingItem={vi.fn()} onOpenProducts={vi.fn()} />,
    );
    expect(view.container.querySelector("[data-tech-bento-loading]")?.getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("heading", { name: emptyModel.hero.title })).toBeNull();

    view.rerender(<TechBentoHome model={emptyModel} onOpenHero={vi.fn()} onOpenMarketingItem={vi.fn()} onOpenProducts={vi.fn()} />);
    expect(screen.getByText("لم تُنشر مربعات Bento بعد.")).toBeTruthy();
    expect(screen.getByText("لا توجد إعلانات منشورة حاليًا.")).toBeTruthy();
    expect(screen.getByText("ستظهر عناصر الاكتشاف هنا عند نشرها.")).toBeTruthy();
  });

  it("replaces a failed managed image with an accessible missing-image state", () => {
    const view = render(
      <TechBentoHome model={model({ bentoItems: [item(1)], sideAds: [], discoveryItems: [] })} onOpenHero={vi.fn()} onOpenMarketingItem={vi.fn()} onOpenProducts={vi.fn()} />,
    );
    fireEvent.error(screen.getByAltText("صورة مساحة 1"));
    const card = view.container.querySelector('[data-tech-marketing-id="tile-1"]');
    expect(card?.querySelector("[data-tech-image-missing]")).not.toBeNull();
    expect(within(card as HTMLElement).getByRole("img", { name: "صورة مساحة 1 — الصورة غير متاحة" })).toBeTruthy();
  });

  it("keeps the hero readable even when the saved overlay is too transparent", () => {
    const view = render(
      <TechBentoHome model={model()} onOpenHero={vi.fn()} onOpenMarketingItem={vi.fn()} onOpenProducts={vi.fn()} />,
    );
    expect(view.container.querySelector(".tech-bento-hero__overlay")?.getAttribute("style")).toContain("opacity: 0.58");
    expect(screen.getByRole("heading", { name: "اكتشف التقنية بأسلوب جديد" }).closest("[data-tech-hero-has-image]")?.getAttribute("data-tech-hero-has-image")).toBe("true");
  });

  it("corrects merchant text colors against the actual marketing-card surface", () => {
    const backgroundColor = "#0F172A";
    const requestedForeground = "#475569";
    const expectedForeground = readableAccent(requestedForeground, backgroundColor);
    const view = render(
      <TechBentoHome
        model={model({ bentoItems: [item(1, { backgroundColor, foregroundColor: requestedForeground })], sideAds: [], discoveryItems: [] })}
        onOpenHero={vi.fn()}
        onOpenMarketingItem={vi.fn()}
        onOpenProducts={vi.fn()}
      />,
    );
    const card = view.container.querySelector('[data-tech-marketing-id="tile-1"]') as HTMLElement;
    const expectedRgb = `rgb(${[1, 3, 5].map((start) => Number.parseInt(expectedForeground.slice(start, start + 2), 16)).join(", ")})`;
    expect(card.style.color).toBe(expectedRgb);
    expect(contrastRatio(expectedForeground, backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });
});
