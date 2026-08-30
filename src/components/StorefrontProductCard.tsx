import React from "react";
import { ShoppingBag } from "lucide-react";
import type { Product } from "../types";
import { readableAccent, readableForeground } from "../utils/readableForeground";
import { storefrontAvailableQuantity } from "../workflows/orderState";
import ProductArt from "./ProductArt";

interface Props {
  key?: React.Key;
  product: Product;
  currency: string;
  primaryColor: string;
  secondaryColor: string;
  cardBackground: string;
  borderColor: string;
  themeStyle?: "elegant" | "tech";
  onOpen: (product: Product) => void;
  onAdd: (product: Product) => void;
  showDescription?: boolean;
  reducedMotion?: boolean;
}

export default function StorefrontProductCard({
  product,
  currency,
  primaryColor,
  secondaryColor,
  cardBackground,
  borderColor,
  themeStyle = "elegant",
  onOpen,
  onAdd,
  showDescription = false,
  reducedMotion = false,
}: Props) {
  const available = storefrontAvailableQuantity(product);
  const outOfStock = available === 0;
  const priceColor = readableAccent(primaryColor, cardBackground);
  const headingColor = readableAccent(secondaryColor, cardBackground);
  const bodyColor = readableAccent("#475569", cardBackground);
  const isElegant = themeStyle === "elegant";

  return (
    <article data-storefront-product-card data-storefront-product-template={isElegant ? "elegant-editorial" : "tech-bento"} data-reduced-motion={reducedMotion ? "true" : undefined} className={`group flex h-full min-w-0 flex-col overflow-hidden border shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transform-none ${isElegant ? "rounded-[1.75rem]" : "rounded-2xl"}`} style={{ backgroundColor: cardBackground, borderColor }}>
      <button type="button" aria-label={`فتح تفاصيل ${product.name}`} onClick={() => onOpen(product)} className={`relative block w-full overflow-hidden bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${isElegant ? "aspect-[4/5] p-4" : "aspect-square p-3"}`} style={{ outlineColor: primaryColor }}>
        <ProductArt keyword={product.imageKeyword} primaryColor={primaryColor} imageUrl={product.imageUrl} alt={product.name} sizes="(min-width: 1024px) 25vw, (min-width: 360px) 50vw, 100vw" />
        {product.category?.trim() && <span className="absolute right-2 top-2 max-w-[85%] truncate rounded-full bg-slate-950/75 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">{product.category}</span>}
        {outOfStock && <span className="absolute inset-x-3 bottom-3 rounded-lg bg-white/95 px-3 py-2 text-center text-[11px] font-black text-rose-700 shadow-sm">غير متوفر حاليًا</span>}
      </button>
      <div className={`flex flex-1 flex-col justify-between text-right ${isElegant ? "gap-4 p-5" : "gap-3 p-3.5"}`}>
        <div className="space-y-1.5">
          <button type="button" onClick={() => onOpen(product)} className={`line-clamp-2 w-full rounded text-right font-black leading-6 hover:underline ${isElegant ? "text-base" : "text-sm"}`} style={{ color: headingColor }}>{product.name}</button>
          {showDescription && <p className="line-clamp-2 text-xs leading-6" style={{ color: bodyColor }}>{product.description || "لم يضف المتجر وصفًا لهذا المنتج بعد."}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="break-all text-sm font-black" style={{ color: priceColor }}>{product.price} {currency}</span>
          <button
            type="button"
            disabled={outOfStock}
            title={outOfStock ? "غير متوفر حاليًا" : "أضف للسلة"}
            aria-label={`إضافة ${product.name} إلى السلة`}
            onClick={() => onAdd(product)}
            className={`inline-flex min-h-11 items-center gap-1.5 px-3 py-2 text-xs font-black shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${isElegant ? "rounded-full" : "rounded-xl"}`}
            style={{ backgroundColor: primaryColor, color: readableForeground(primaryColor) }}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>{outOfStock ? "غير متوفر" : "إضافة"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
