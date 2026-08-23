import type { StoreConfig } from "../types";

export interface StoreOnboardingAppearance {
  slogan: string;
  logoIcon: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  bgColor: string;
  cardBgColor: string;
  borderColor: string;
  fontFamily: string;
  bannerText: string;
  showHeroBanner: boolean;
  heroBannerTitle: string | null;
  heroBannerSubtitle: string | null;
  heroBannerBadge: string | null;
  heroBannerButtonText: string | null;
  heroBannerHeight: "compact" | "medium" | "large" | null;
  heroBannerOverlayOpacity: number | null;
}

export function storeOnboardingAppearance(config: StoreConfig): StoreOnboardingAppearance {
  return {
    slogan: config.slogan,
    logoIcon: config.logoIcon,
    primaryColor: config.primaryColor,
    secondaryColor: config.secondaryColor,
    textColor: config.textColor ?? "#334155",
    bgColor: config.bgColor ?? "#F8FAFC",
    cardBgColor: config.cardBgColor ?? "#FFFFFF",
    borderColor: config.borderColor ?? "#E2E8F0",
    fontFamily: config.fontFamily,
    bannerText: config.bannerText,
    showHeroBanner: config.showHeroBanner === true,
    heroBannerTitle: config.heroBannerTitle ?? null,
    heroBannerSubtitle: config.heroBannerSubtitle ?? null,
    heroBannerBadge: config.heroBannerBadge ?? null,
    heroBannerButtonText: config.heroBannerButtonText ?? null,
    heroBannerHeight: config.heroBannerHeight ?? null,
    heroBannerOverlayOpacity: config.heroBannerOverlayOpacity ?? null,
  };
}

export function applyStoreOnboardingAppearance(
  config: StoreConfig,
  appearance: StoreOnboardingAppearance,
  storeName: string,
  themeStyle: "elegant" | "tech",
): StoreConfig {
  return {
    ...config,
    ...appearance,
    storeName: storeName.trim() || config.storeName,
    themeStyle,
  };
}
