import { describe, expect, it } from "vitest";
import { ELEGANT_PRESET, TECH_PRESET, type StoreConfig } from "../types";
import {
  applyStoreOnboardingAppearance,
  STORE_ONBOARDING_APPEARANCE_KEYS,
  storeOnboardingAppearance,
} from "./storeOnboardingAppearance";

describe("store onboarding appearance contract", () => {
  it("extracts exactly the 17 canonical appearance fields", () => {
    const expectedKeys = [
      "slogan",
      "logoIcon",
      "primaryColor",
      "secondaryColor",
      "textColor",
      "bgColor",
      "cardBgColor",
      "borderColor",
      "fontFamily",
      "bannerText",
      "showHeroBanner",
      "heroBannerTitle",
      "heroBannerSubtitle",
      "heroBannerBadge",
      "heroBannerButtonText",
      "heroBannerHeight",
      "heroBannerOverlayOpacity",
    ];
    const source: StoreConfig = {
      ...ELEGANT_PRESET,
      slogan: "هوية محددة",
      heroBannerTitle: undefined,
      heroBannerOverlayOpacity: undefined,
      marketingBlocks: [],
    };

    const appearance = storeOnboardingAppearance(source);

    expect(STORE_ONBOARDING_APPEARANCE_KEYS).toEqual(expectedKeys);
    expect(Object.keys(appearance)).toEqual(expectedKeys);
    expect(appearance).toMatchObject({
      slogan: "هوية محددة",
      heroBannerTitle: null,
      heroBannerOverlayOpacity: null,
    });
    expect(appearance).not.toHaveProperty("storeName");
    expect(appearance).not.toHaveProperty("products");
    expect(appearance).not.toHaveProperty("homeSections");
    expect(appearance).not.toHaveProperty("marketingBlocks");
  });

  it("applies only the canonical appearance plus authoritative identity", () => {
    const source: StoreConfig = {
      ...ELEGANT_PRESET,
      storeName: "الاسم السابق",
      products: [{
        id: "product-1",
        name: "منتج محفوظ",
        price: 25,
        description: "وصف",
        category: "قسم",
        imageKeyword: "item",
      }],
      marketingBlocks: [],
    };
    const appearance = storeOnboardingAppearance({
      ...TECH_PRESET,
      slogan: "هوية Tech المحفوظة",
    });

    const applied = applyStoreOnboardingAppearance(source, appearance, "  المتجر الجديد  ", "tech");

    expect(applied).not.toBe(source);
    expect(source.storeName).toBe("الاسم السابق");
    expect(applied.storeName).toBe("المتجر الجديد");
    expect(applied.themeStyle).toBe("tech");
    expect(applied.slogan).toBe("هوية Tech المحفوظة");
    expect(applied.products).toBe(source.products);
    expect(applied.marketingBlocks).toBe(source.marketingBlocks);
    for (const key of STORE_ONBOARDING_APPEARANCE_KEYS) {
      expect(applied[key]).toEqual(appearance[key]);
    }
  });
});
