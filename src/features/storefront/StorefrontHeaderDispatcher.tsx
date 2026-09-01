import React from "react";
import type { StoreConfig } from "../../types";
import ElegantEditorialHeader from "./elegant-stories/ElegantEditorialHeader";
import TechStorefrontHeader, { type StorefrontHeaderRoute, type TechStorefrontHeaderTokens } from "./tech-bento/TechStorefrontHeader";

interface Props {
  config: StoreConfig;
  isElegant: boolean;
  categories: string[];
  cartCount: number;
  cartTotal: number;
  searchQuery: string;
  currentRoute: StorefrontHeaderRoute;
  phone?: string | null;
  tokens: TechStorefrontHeaderTokens;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onOpenHome: () => void;
  onOpenProducts: () => void;
  onOpenAbout: () => void;
  onOpenContact: () => void;
  onOpenCart: (trigger: HTMLElement) => void;
  onSelectCategory: (category: string) => void;
}

export default function StorefrontHeaderDispatcher({
  config,
  isElegant,
  categories,
  cartCount,
  cartTotal,
  searchQuery,
  currentRoute,
  phone,
  tokens,
  onSearchChange,
  onSearchSubmit,
  onOpenHome,
  onOpenProducts,
  onOpenAbout,
  onOpenContact,
  onOpenCart,
  onSelectCategory,
}: Props) {
  if (isElegant) {
    const elegantRoute = currentRoute === "home" || currentRoute === "products" || currentRoute === "about" || currentRoute === "contact"
      ? currentRoute
      : undefined;
    return (
      <ElegantEditorialHeader
        storeName={config.storeName || "متجر جديد"}
        logoUrl={config.logoUrl}
        categories={categories.filter((category) => category !== "الكل")}
        cartCount={cartCount}
        searchQuery={searchQuery}
        currentRoute={elegantRoute}
        tokens={tokens}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        onOpenHome={onOpenHome}
        onOpenProducts={onOpenProducts}
        onOpenAbout={onOpenAbout}
        onOpenCart={onOpenCart}
        onSelectCategory={onSelectCategory}
      />
    );
  }

  return (
    <TechStorefrontHeader
      storeName={config.storeName}
      slogan={config.slogan}
      logoUrl={config.logoUrl}
      logoIcon={config.logoIcon}
      logoSize={config.logoSize}
      currency={config.currency || "ر.س"}
      phone={phone}
      cartCount={cartCount}
      cartTotal={cartTotal}
      searchQuery={searchQuery}
      currentRoute={currentRoute}
      tokens={tokens}
      onSearchChange={onSearchChange}
      onSearchSubmit={onSearchSubmit}
      onOpenHome={onOpenHome}
      onOpenProducts={onOpenProducts}
      onOpenAbout={onOpenAbout}
      onOpenContact={onOpenContact}
      onOpenCart={onOpenCart}
    />
  );
}
