import type { StoreConfig } from "../../types";

export type StorefrontSocialNetwork = "instagram" | "twitter" | "tiktok" | "snapchat";

export interface StorefrontSocialLink {
  key: StorefrontSocialNetwork;
  label: "Instagram" | "X" | "TikTok" | "Snapchat";
  href: string;
}

const SOCIAL_PROFILES: Record<StorefrontSocialNetwork, { label: StorefrontSocialLink["label"]; baseUrl: string }> = {
  instagram: { label: "Instagram", baseUrl: "https://instagram.com/" },
  twitter: { label: "X", baseUrl: "https://x.com/" },
  tiktok: { label: "TikTok", baseUrl: "https://tiktok.com/@" },
  snapchat: { label: "Snapchat", baseUrl: "https://snapchat.com/add/" },
};

export const storefrontSocialUrl = (network: StorefrontSocialNetwork, raw?: string): string | null => {
  const value = raw?.trim();
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  if (!/^@?[A-Za-z0-9._-]+$/.test(value)) return null;
  return `${SOCIAL_PROFILES[network].baseUrl}${value.replace(/^@/, "")}`;
};

export const publishedStorefrontSocialLinks = (
  config: Pick<StoreConfig, "instagram" | "twitter" | "tiktok" | "snapchat">,
): StorefrontSocialLink[] => (Object.keys(SOCIAL_PROFILES) as StorefrontSocialNetwork[])
  .map((key) => {
    const href = storefrontSocialUrl(key, config[key]);
    return href ? { key, label: SOCIAL_PROFILES[key].label, href } : null;
  })
  .filter((link): link is StorefrontSocialLink => link !== null);
