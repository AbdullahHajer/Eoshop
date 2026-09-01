import React from "react";
import { Box, Info, MessageSquare, Phone, Search, ShoppingBag, X, Zap } from "lucide-react";
import { readableForeground } from "../../../utils/readableForeground";

export type StorefrontHeaderRoute = "home" | "products" | "about" | "contact" | "product" | "checkout";

export interface TechStorefrontHeaderTokens {
  surface: string;
  ink: string;
  mutedInk: string;
  border: string;
  accent: string;
}

interface Props {
  storeName: string;
  slogan?: string;
  logoUrl?: string;
  logoIcon?: string;
  logoSize?: number;
  currency: string;
  phone?: string | null;
  cartCount: number;
  cartTotal: number;
  searchQuery: string;
  currentRoute: StorefrontHeaderRoute;
  tokens: TechStorefrontHeaderTokens;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onOpenHome: () => void;
  onOpenProducts: () => void;
  onOpenAbout: () => void;
  onOpenContact: () => void;
  onOpenCart: (trigger: HTMLElement) => void;
}

const NAV_ITEMS = [
  { id: "home", label: "الرئيسية", icon: Zap },
  { id: "products", label: "الأجهزة", icon: Box },
  { id: "about", label: "عن المتجر", icon: Info },
  { id: "contact", label: "الدعم", icon: MessageSquare },
] as const;

export default function TechStorefrontHeader({
  storeName,
  slogan,
  logoUrl,
  logoIcon,
  logoSize = 44,
  currency,
  phone,
  cartCount,
  cartTotal,
  searchQuery,
  currentRoute,
  tokens,
  onSearchChange,
  onSearchSubmit,
  onOpenHome,
  onOpenProducts,
  onOpenAbout,
  onOpenContact,
  onOpenCart,
}: Props) {
  const safeStoreName = storeName.trim() || "متجر الأجهزة الذكية";
  const navHandlers: Record<(typeof NAV_ITEMS)[number]["id"], () => void> = {
    home: onOpenHome,
    products: onOpenProducts,
    about: onOpenAbout,
    contact: onOpenContact,
  };
  const inkForeground = readableForeground(tokens.ink);
  const accentForeground = readableForeground(tokens.accent);

  return (
    <header
      className="tech-storefront-header sticky top-0 z-20 border-b shadow-sm backdrop-blur-xl"
      data-tech-storefront-header
      style={{ backgroundColor: tokens.surface, borderColor: tokens.border }}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-3 md:flex-row">
        <div className="flex w-full shrink-0 items-center justify-between md:w-auto">
          <button
            type="button"
            onClick={onOpenHome}
            className="group flex min-h-11 items-center gap-3 rounded-xl text-right"
            aria-label={`العودة إلى الصفحة الرئيسية لمتجر ${safeStoreName}`}
          >
            <span className="relative flex items-center">
              {logoUrl?.trim() ? (
                <img
                  src={logoUrl}
                  alt=""
                  style={{ height: `${logoSize}px` }}
                  className="w-auto max-w-[150px] shrink-0 object-contain transition duration-300 group-hover:scale-105 motion-reduce:transform-none sm:max-w-[220px]"
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span
                  aria-hidden="true"
                  style={{ width: `${logoSize}px`, height: `${logoSize}px`, fontSize: `${Math.max(16, logoSize * 0.5)}px`, backgroundColor: tokens.accent, color: accentForeground }}
                  className="flex shrink-0 items-center justify-center rounded-2xl shadow-md transition duration-300 group-hover:scale-105 motion-reduce:transform-none"
                >
                  {logoIcon || "⚡"}
                </span>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
            </span>
            <span>
              <span className="flex items-center gap-2">
                <strong className="text-base font-black tracking-tight" style={{ color: tokens.ink }}>{safeStoreName}</strong>
                <span className="rounded-md px-2 py-0.5 text-[9px] font-black uppercase" style={{ backgroundColor: tokens.accent, color: accentForeground }}>TECH</span>
              </span>
              <small className="block max-w-[180px] truncate text-[10px] font-extrabold md:max-w-xs" style={{ color: tokens.mutedInk }}>
                {slogan?.trim() || `مرحبًا بكم في ${safeStoreName}`}
              </small>
            </span>
          </button>

          <button
            type="button"
            onClick={(event) => onOpenCart(event.currentTarget)}
            aria-label={`فتح سلة التسوق، ${cartCount} منتج`}
            className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl lg:hidden"
            style={{ backgroundColor: tokens.ink, color: inkForeground }}
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            {cartCount > 0 ? <span data-storefront-cart-count className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black" style={{ backgroundColor: tokens.accent, color: accentForeground }}>{cartCount > 99 ? "99+" : cartCount}</span> : null}
          </button>
        </div>

        <div className="flex w-full flex-col items-center gap-3 md:w-auto sm:flex-row">
          <form
            role="search"
            className="relative w-full sm:w-64"
            onSubmit={(event) => {
              event.preventDefault();
              onSearchSubmit();
            }}
          >
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: tokens.mutedInk }} aria-hidden="true" />
            <label className="sr-only" htmlFor="tech-storefront-search">البحث في منتجات المتجر</label>
            <input
              id="tech-storefront-search"
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="ابحث عن منتج"
              className="min-h-11 w-full rounded-xl border py-2 pl-9 pr-9 text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{ backgroundColor: tokens.surface, borderColor: tokens.border, color: tokens.ink, outlineColor: tokens.accent }}
            />
            {searchQuery ? (
              <button type="button" onClick={() => onSearchChange("")} aria-label="مسح البحث" className="absolute left-2 top-1/2 flex min-h-8 min-w-8 -translate-y-1/2 items-center justify-center rounded-lg" style={{ color: tokens.mutedInk }}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </form>

          <nav aria-label="التنقل الرئيسي في المتجر" className="hidden items-center gap-1 rounded-2xl border p-1 text-xs font-bold lg:flex" style={{ borderColor: tokens.border }}>
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const active = currentRoute === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={navHandlers[id]}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-9 items-center gap-1.5 rounded-xl px-3 py-1.5 font-extrabold"
                  style={{ backgroundColor: active ? tokens.ink : "transparent", color: active ? inkForeground : tokens.ink }}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden items-center gap-2.5 lg:flex">
          {phone ? (
            <a href={`tel:${phone}`} className="flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-extrabold" style={{ borderColor: tokens.border, color: tokens.ink }}>
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              <span dir="ltr">{phone}</span>
            </a>
          ) : null}
          <button
            type="button"
            onClick={(event) => onOpenCart(event.currentTarget)}
            aria-label={`فتح سلة التسوق، ${cartCount} منتج`}
            className="flex min-h-11 items-center gap-2.5 rounded-xl px-4 text-xs font-extrabold shadow-md"
            style={{ backgroundColor: tokens.ink, color: inkForeground }}
          >
            <span className="relative">
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              {cartCount > 0 ? <span data-storefront-cart-count className="absolute -left-2 -top-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-0.5 text-[9px] font-black" style={{ backgroundColor: tokens.accent, color: accentForeground }}>{cartCount > 99 ? "99+" : cartCount}</span> : null}
            </span>
            <span>سلة التسوق</span>
            {cartTotal > 0 ? <span className="rounded-md border px-2 py-0.5 font-mono text-[11px]" style={{ borderColor: tokens.border }}>{cartTotal} {currency}</span> : null}
          </button>
        </div>
      </div>
    </header>
  );
}
