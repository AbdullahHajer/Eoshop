import type { StoreConfig } from "../../../types";
import type {
  StorefrontMarketingDisclosure,
  StorefrontMarketingTargetType,
} from "../../../contracts/storefrontMarketingBlocks";

export interface TechMarketingTarget {
  targetType: StorefrontMarketingTargetType;
  targetValue?: string;
}

export interface TechHeroViewModel extends TechMarketingTarget {
  title: string;
  subtitle?: string;
  badge?: string;
  ctaLabel: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  height: NonNullable<StoreConfig["heroBannerHeight"]>;
  overlayOpacity: number;
  focalPointX: number;
  focalPointY: number;
}

export interface TechMarketingTileViewModel extends TechMarketingTarget {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  ctaLabel: string;
  imageUrl: string;
  mobileImageUrl?: string;
  altText: string;
  backgroundColor?: string;
  foregroundColor?: string;
  overlayOpacity: number;
  focalPointX: number;
  focalPointY: number;
  disclosure: StorefrontMarketingDisclosure;
  sponsorName?: string;
}

export interface TechBentoHomeViewModel {
  hero: TechHeroViewModel;
  bentoItems: TechMarketingTileViewModel[];
  sideAds: TechMarketingTileViewModel[];
  discoveryItems: TechMarketingTileViewModel[];
}

export interface TechBentoThemeTokens {
  background: string;
  surface: string;
  ink: string;
  mutedInk: string;
  border: string;
  accent: string;
  accentForeground: string;
}

export const DEFAULT_TECH_BENTO_TOKENS: TechBentoThemeTokens = {
  background: "#F7F9FC",
  surface: "#FFFFFF",
  ink: "#0F172A",
  mutedInk: "#475569",
  border: "#E2E8F0",
  accent: "#0969F0",
  accentForeground: "#FFFFFF",
};

export function clampPercentage(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, value));
}

export function marketingDisclosureLabel(
  disclosure: StorefrontMarketingDisclosure,
  sponsorName?: string,
): string | null {
  if (disclosure === "none") return null;
  const label = disclosure === "ad" ? "إعلان" : "برعاية";
  return sponsorName?.trim() ? `${label} · ${sponsorName.trim()}` : label;
}
