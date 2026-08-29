import React, { useEffect, useState } from "react";
import { ArrowRight, Building2, CreditCard, Minus, Plus, ShoppingBag, Truck, Wallet } from "lucide-react";
import type { Product, StoreConfig } from "../types";
import ProductArt from "./ProductArt";
import { readableAccent, readableForeground } from "../utils/readableForeground";
import { storefrontAvailableQuantity, storefrontCartLineLimit } from "../workflows/orderState";

interface Props {
  product: Product;
  config: StoreConfig;
  primaryColor: string;
  secondaryColor: string;
  cartQuantity?: number;
  onBack: () => void;
  onAdd: (product: Product, quantity: number) => void;
}

export default function StorefrontProductDetail({ product, config, primaryColor, secondaryColor, cartQuantity = 0, onBack, onAdd }: Props) {
  const primaryForeground = readableForeground(primaryColor);
  const primaryCardAccent = readableAccent(primaryColor, "#FFFFFF");
  const secondaryPageAccent = readableAccent(secondaryColor, config.bgColor || "#FFFFFF");
  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const images = Array.from(new Set([product.imageUrl, ...(product.imageUrls ?? [])].filter((url): url is string => Boolean(url?.trim()))));
  const available = storefrontAvailableQuantity(product);
  const outOfStock = available === 0;
  const remaining = Math.max(0, storefrontCartLineLimit(product) - cartQuantity);
  const atCartLimit = remaining === 0;
  const bankUsable = config.enableBankTransfer === true
    && Boolean(config.bankName?.trim())
    && Boolean(config.bankAccountName?.trim())
    && Boolean(config.bankIban?.trim() || config.bankAccountNumber?.trim());
  const walletCount = config.enableEWallets === true
    ? (config.customWallets ?? []).filter((wallet) => wallet.active !== false && wallet.name.trim() && wallet.accountNumber.trim()).length
    : 0;

  useEffect(() => {
    setImageIndex(0);
    setQuantity(1);
  }, [product.id]);

  useEffect(() => {
    if (remaining > 0) setQuantity((value) => Math.min(value, remaining));
  }, [remaining]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-right animate-fadeIn">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700"><ArrowRight className="h-4 w-4" />العودة إلى المنتجات</button>
      <div className="grid gap-8 md:grid-cols-2 md:items-start">
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-3xl border border-slate-200 bg-white p-5">
            {images.length > 0 ? <img src={images[imageIndex] ?? images[0]} alt={product.name} className="h-full w-full rounded-2xl object-cover" referrerPolicy="no-referrer" /> : <ProductArt keyword={product.imageKeyword} primaryColor={primaryColor} imageUrl={product.imageUrl} />}
          </div>
          {images.length > 1 && <div className="flex flex-wrap gap-2" role="group" aria-label={`صور ${product.name}`}>{images.map((image, index) => <button type="button" key={image} onClick={() => setImageIndex(index)} aria-label={`عرض الصورة ${index + 1} من ${images.length} للمنتج ${product.name}`} aria-pressed={index === imageIndex} className={`h-14 w-14 overflow-hidden rounded-xl border-2 ${index === imageIndex ? "border-sky-600" : "border-slate-200"}`}><img src={image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /></button>)}</div>}
        </div>
        <div className="space-y-5">
          <div><span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{product.category || "غير مصنف"}</span><h1 className="mt-3 text-2xl font-black leading-tight md:text-3xl" style={{ color: secondaryPageAccent }}>{product.name}</h1></div>
          <p className="text-sm leading-8 text-slate-600">{product.description || "لم يضف المتجر وصفًا لهذا المنتج بعد."}</p>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><span className="text-xs text-slate-500">السعر</span><p className="mt-1 text-3xl font-black" style={{ color: primaryCardAccent }}>{product.price} {config.currency}</p></div>
          <div className={`rounded-2xl border p-4 text-xs font-black ${outOfStock || atCartLimit ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {outOfStock ? "غير متوفر حاليًا" : atCartLimit ? "الكمية المتاحة موجودة في السلة" : available !== null ? `المتاح للإضافة: ${remaining}` : "يؤكد المتجر التوفر عند معالجة الطلب"}
          </div>
          <div className="flex flex-col items-stretch gap-3 min-[360px]:flex-row min-[360px]:items-center"><div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white"><button type="button" aria-label="تقليل الكمية" disabled={atCartLimit} onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="min-h-11 min-w-11 p-3 disabled:cursor-not-allowed disabled:opacity-40"><Minus className="h-4 w-4" /></button><span className="min-w-10 text-center text-sm font-black">{quantity}</span><button type="button" aria-label="زيادة الكمية" disabled={atCartLimit || quantity >= remaining} onClick={() => setQuantity((value) => Math.min(remaining, value + 1))} className="min-h-11 min-w-11 p-3 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /></button></div><button type="button" disabled={outOfStock || atCartLimit} onClick={() => onAdd(product, quantity)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: primaryColor, color: primaryForeground }}><ShoppingBag className="h-4 w-4" />{atCartLimit && !outOfStock ? "الكمية المتاحة في السلة" : "إضافة إلى السلة"}</button></div>
          <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-black text-slate-900">الشحن والدفع المنشور</h2>
            {typeof config.freeShippingThreshold === "number" && config.freeShippingThreshold > 0 && <p className="flex items-center gap-2 text-xs text-slate-600"><Truck className="h-4 w-4" />شحن مجاني ابتداءً من {config.freeShippingThreshold} {config.currency}</p>}
            {typeof config.shippingFee === "number" && !(config.freeShippingThreshold && config.freeShippingThreshold > 0) && <p className="flex items-center gap-2 text-xs text-slate-600"><Truck className="h-4 w-4" />رسوم الشحن: {config.shippingFee} {config.currency}</p>}
            {config.enableCashOnDelivery === true && <p className="flex items-center gap-2 text-xs text-slate-600"><CreditCard className="h-4 w-4" />الدفع عند الاستلام متاح</p>}
            {bankUsable && <p className="flex items-center gap-2 text-xs text-slate-600"><Building2 className="h-4 w-4" />التحويل البنكي متاح</p>}
            {walletCount > 0 && <p className="flex items-center gap-2 text-xs text-slate-600"><Wallet className="h-4 w-4" />{walletCount} وسيلة محفظة متاحة</p>}
            {typeof config.shippingFee !== "number" && !(config.freeShippingThreshold && config.freeShippingThreshold > 0) && config.enableCashOnDelivery !== true && !bankUsable && walletCount === 0 && <p className="text-xs text-slate-500">لم ينشر المتجر تفاصيل الشحن والدفع بعد.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
