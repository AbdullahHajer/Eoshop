import type { StorefrontSection, StorefrontSectionId } from "../types";

export const STOREFRONT_SECTION_IDS = [
  "hero",
  "trust",
  "categories",
  "featured_products",
  "about",
] as const satisfies readonly StorefrontSectionId[];

export const STOREFRONT_SECTION_LABELS: Record<StorefrontSectionId, string> = {
  hero: "واجهة الترحيب",
  trust: "معلومات الخدمة",
  categories: "التصنيفات",
  featured_products: "المنتجات المختارة",
  about: "نبذة عن المتجر",
};

export function defaultStorefrontSections(): StorefrontSection[] {
  return STOREFRONT_SECTION_IDS.map((id) => ({ id, visible: true }));
}

export function validStorefrontSections(value: unknown): value is StorefrontSection[] {
  if (!Array.isArray(value) || value.length !== STOREFRONT_SECTION_IDS.length) return false;
  const seen = new Set<string>();
  let visible = false;
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const keys = Object.keys(item).sort();
    if (keys.length !== 2 || keys[0] !== "id" || keys[1] !== "visible") return false;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== "string"
      || !STOREFRONT_SECTION_IDS.includes(candidate.id as StorefrontSectionId)
      || typeof candidate.visible !== "boolean"
      || seen.has(candidate.id)) return false;
    seen.add(candidate.id);
    visible ||= candidate.visible;
  }
  return seen.size === STOREFRONT_SECTION_IDS.length && visible;
}

export function storefrontSectionsOrDefault(value: unknown): StorefrontSection[] {
  return validStorefrontSections(value)
    ? value.map((section) => ({ ...section }))
    : defaultStorefrontSections();
}
