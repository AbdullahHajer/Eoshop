import type {
  StorefrontMarketingBlock,
  StorefrontMarketingPlacement,
} from "../../../contracts/storefrontMarketingBlocks";
import type { StoreConfig } from "../../../types";
import { clampPercentage, type TechBentoHomeViewModel, type TechMarketingTileViewModel } from "./model";

function activeBlocks(
  config: StoreConfig,
  placement: StorefrontMarketingPlacement,
  now: Date,
): StorefrontMarketingBlock[] {
  const timestamp = now.getTime();
  return (config.marketingBlocks ?? [])
    .filter((block) => {
      if (!block.enabled || block.placement !== placement) return false;
      const startsAt = block.startsAt ? Date.parse(block.startsAt) : null;
      const endsAt = block.endsAt ? Date.parse(block.endsAt) : null;
      return (startsAt === null || startsAt <= timestamp) && (endsAt === null || endsAt > timestamp);
    })
    .sort((left, right) => left.position - right.position);
}

function tileFromBlock(block: StorefrontMarketingBlock): TechMarketingTileViewModel {
  return {
    id: block.id,
    title: block.title,
    subtitle: block.subtitle,
    badge: block.badge,
    ctaLabel: block.ctaLabel,
    imageUrl: block.imageUrl,
    mobileImageUrl: block.mobileImageUrl,
    altText: block.altText,
    backgroundColor: block.backgroundColor,
    foregroundColor: block.textColor,
    overlayOpacity: clampPercentage(block.overlayOpacity, 58),
    focalPointX: clampPercentage(block.focalPointX, 50),
    focalPointY: clampPercentage(block.focalPointY, 50),
    disclosure: block.disclosure,
    sponsorName: block.sponsorName,
    targetType: block.targetType,
    targetValue: block.targetValue,
  };
}

export function techBentoHomeModel(config: StoreConfig, now = new Date()): TechBentoHomeViewModel {
  const heroTargetType = config.heroBannerTargetType ?? "products";
  const heroTargetValue = heroTargetType === "products" ? undefined : config.heroBannerTargetValue?.trim() || undefined;

  return {
    hero: {
      title: config.heroBannerTitle?.trim() || config.storeName,
      subtitle: config.heroBannerSubtitle?.trim() || config.slogan?.trim() || undefined,
      badge: config.heroBannerBadge?.trim() || undefined,
      ctaLabel: config.heroBannerButtonText?.trim() || "استكشف المنتجات",
      imageUrl: config.showHeroBanner === true ? config.heroBannerImage?.trim() || undefined : undefined,
      mobileImageUrl: config.showHeroBanner === true ? config.heroBannerMobileImage?.trim() || undefined : undefined,
      height: config.heroBannerHeight ?? "medium",
      overlayOpacity: clampPercentage(config.heroBannerOverlayOpacity, 42),
      focalPointX: clampPercentage(config.heroBannerFocalPointX, 50),
      focalPointY: clampPercentage(config.heroBannerFocalPointY, 50),
      targetType: heroTargetType,
      targetValue: heroTargetValue,
    },
    bentoItems: activeBlocks(config, "hero_bento", now).slice(0, 5).map(tileFromBlock),
    sideAds: activeBlocks(config, "side_ad", now).slice(0, 2).map(tileFromBlock),
    discoveryItems: activeBlocks(config, "discovery", now).slice(0, 10).map(tileFromBlock),
  };
}
