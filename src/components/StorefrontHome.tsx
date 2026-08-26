import React from "react";
import { Building2, Clock, CreditCard, Grid3X3, Mail, MessageSquare, Phone, ShoppingBag, Truck } from "lucide-react";
import type { Product, StoreConfig, StorefrontSectionId } from "../types";
import { storefrontSectionsOrDefault } from "../contracts/storefrontSections";
import ProductArt from "./ProductArt";
import { canonicalContactTarget } from "../contracts/checkoutPolicy";
import { readableAccent, readableForeground } from "../utils/readableForeground";

interface Props {
  config: StoreConfig;
  isElegant: boolean;
  primaryColor: string;
  secondaryColor: string;
  onOpenProducts: () => void;
  onOpenAbout: () => void;
  onSelectCategory: (category: string) => void;
  onOpenProduct: (product: Product) => void;
  onAddProduct: (product: Product) => void;
}

interface TrustFact {
  key: string;
  label: string;
  icon: typeof Phone;
}

export default function StorefrontHome({
  config,
  isElegant,
  primaryColor,
  secondaryColor,
  onOpenProducts,
  onOpenAbout,
  onSelectCategory,
  onOpenProduct,
  onAddProduct,
}: Props) {
  const primaryForeground = readableForeground(primaryColor);
  const primaryPageAccent = readableAccent(primaryColor, config.bgColor || "#FFFFFF");
  const primaryCardAccent = readableAccent(primaryColor, "#FFFFFF");
  const primarySoftAccent = readableAccent(primaryColor, "#F8FAFC");
  const secondaryPageAccent = readableAccent(secondaryColor, config.bgColor || "#FFFFFF");
  const secondaryCardAccent = readableAccent(secondaryColor, "#FFFFFF");
  const products = config.products.filter((product) => product.status !== "archived" && product.status !== "draft");
  const categories = Array.from(new Set(products.map((product) => product.category.trim()).filter(Boolean)));
  const phone = canonicalContactTarget(config.phone);
  const whatsapp = canonicalContactTarget(config.whatsapp);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email?.trim() ?? "") ? config.email?.trim() : null;
  const bankUsable = config.enableBankTransfer === true
    && Boolean(config.bankName?.trim())
    && Boolean(config.bankAccountName?.trim())
    && Boolean(config.bankIban?.trim() || config.bankAccountNumber?.trim());
  const walletCount = config.enableEWallets === true
    ? (config.customWallets ?? []).filter((wallet) => wallet.active !== false && wallet.name.trim() && wallet.accountNumber.trim()).length
    : 0;
  const heroImageVisible = config.showHeroBanner === true && Boolean(config.heroBannerImage);
  const facts: TrustFact[] = [
    ...(products.length > 0 ? [{ key: "products", label: `${products.length} منتج منشور`, icon: ShoppingBag }] : []),
    ...(categories.length > 0 ? [{ key: "categories", label: `${categories.length} تصنيف فعلي`, icon: Grid3X3 }] : []),
    ...(phone ? [{ key: "phone", label: `اتصال: ${phone}`, icon: Phone }] : []),
    ...(whatsapp ? [{ key: "whatsapp", label: "التواصل عبر WhatsApp متاح", icon: MessageSquare }] : []),
    ...(validEmail ? [{ key: "email", label: `البريد: ${validEmail}`, icon: Mail }] : []),
    ...(config.workingHours?.trim() ? [{ key: "hours", label: config.workingHours.trim(), icon: Clock }] : []),
    ...(config.enableCashOnDelivery === true ? [{ key: "cod", label: "الدفع عند الاستلام مفعّل", icon: CreditCard }] : []),
    ...(bankUsable ? [{ key: "bank", label: "التحويل البنكي متاح", icon: Building2 }] : []),
    ...(walletCount > 0 ? [{ key: "wallets", label: `${walletCount} وسيلة محفظة مفعلة`, icon: CreditCard }] : []),
    ...(typeof config.freeShippingThreshold === "number" && config.freeShippingThreshold > 0
      ? [{ key: "free-shipping", label: `الشحن المجاني يبدأ من ${config.freeShippingThreshold} ${config.currency}`, icon: Truck }]
      : typeof config.shippingFee === "number"
        ? [{ key: "shipping", label: `رسوم الشحن ${config.shippingFee} ${config.currency}`, icon: Truck }]
        : []),
  ];

  const sections: Record<StorefrontSectionId, React.ReactNode> = {
    hero: (
      <section className={`relative overflow-hidden rounded-3xl border px-5 py-10 shadow-sm md:px-10 md:py-14 ${isElegant ? "bg-white" : "border-slate-800 bg-slate-950 text-white"}`}>
        {heroImageVisible && (
          <img src={config.heroBannerImage} alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" />
        )}
        {heroImageVisible && <div className="absolute inset-0 bg-black" style={{ opacity: (config.heroBannerOverlayOpacity ?? 35) / 100 }} />}
        <div className="relative z-10 max-w-3xl space-y-4">
          {config.heroBannerBadge?.trim() && <span className="inline-flex rounded-full border border-current/20 bg-white/10 px-3 py-1 text-xs font-black">{config.heroBannerBadge}</span>}
          <h1 className="text-3xl font-black leading-tight md:text-5xl" style={{ color: isElegant && !heroImageVisible ? secondaryCardAccent : undefined }}>
            {config.heroBannerTitle?.trim() || config.storeName}
          </h1>
          <p className={`max-w-2xl text-sm leading-7 ${isElegant && !heroImageVisible ? "text-slate-600" : "text-white/85"}`}>
            {config.heroBannerSubtitle?.trim() || config.slogan}
          </p>
          <button type="button" onClick={onOpenProducts} className="rounded-xl px-5 py-3 text-xs font-black" style={{ backgroundColor: primaryColor, color: primaryForeground }}>
            {config.heroBannerButtonText?.trim() || "تصفح المنتجات"}
          </button>
        </div>
      </section>
    ),
    trust: (
      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="mb-4"><h2 className="text-lg font-black text-slate-900">معلومات المتجر والخدمة</h2><p className="mt-1 text-xs text-slate-500">بيانات منشورة من إعدادات المتجر الحالية.</p></div>
        {facts.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map(({ key, label, icon: Icon }) => <div key={key} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-xs font-bold text-slate-700"><Icon className="h-4 w-4 shrink-0" style={{ color: primarySoftAccent }} /><span>{label}</span></div>)}
          </div>
        ) : <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm font-bold text-slate-500">لم يضف المتجر معلومات الخدمة بعد</div>}
      </section>
    ),
    categories: (
      <section className="space-y-4">
        <div><h2 className="text-xl font-black" style={{ color: secondaryPageAccent }}>التصنيفات</h2><p className="mt-1 text-xs text-slate-500">التصنيفات المستخرجة من المنتجات المنشورة.</p></div>
        {categories.length > 0 ? <div className="flex flex-wrap gap-2">{categories.map((category) => <button key={category} type="button" onClick={() => onSelectCategory(category)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:border-slate-400">{category}</button>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-bold text-slate-500">لا توجد تصنيفات منشورة بعد.</div>}
      </section>
    ),
    featured_products: (
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-black" style={{ color: secondaryPageAccent }}>المنتجات المنشورة</h2><p className="mt-1 text-xs text-slate-500">منتجات من كتالوج المتجر الحالي.</p></div>{products.length > 0 && <button type="button" onClick={onOpenProducts} className="text-xs font-black" style={{ color: primaryPageAccent }}>عرض الكل</button>}</div>
        {products.length > 0 ? <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4">{products.slice(0, 8).map((product) => <article key={product.id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"><button type="button" aria-label={`فتح تفاصيل ${product.name}`} onClick={() => onOpenProduct(product)} className="block aspect-square w-full bg-slate-50 p-3"><ProductArt keyword={product.imageKeyword} primaryColor={primaryColor} imageUrl={product.imageUrl} /></button><div className="space-y-2 p-3"><p className="line-clamp-2 break-words text-right text-xs font-black text-slate-900">{product.name}</p><div className="flex flex-wrap items-center justify-between gap-2"><span className="break-all text-xs font-black" style={{ color: primaryCardAccent }}>{product.price} {config.currency}</span><button type="button" title="أضف للسلة" aria-label={`إضافة ${product.name} إلى السلة`} onClick={() => onAddProduct(product)} className="min-h-11 rounded-lg px-3 py-2 text-[10px] font-black" style={{ backgroundColor: primaryColor, color: primaryForeground }}>إضافة</button></div></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">لم ينشر المتجر منتجات بعد.</div>}
      </section>
    ),
    about: (
      <section className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 md:grid-cols-[minmax(0,1fr)_240px] md:items-center">
        <div className="space-y-3"><h2 data-storefront-about-heading className="text-xl font-black" style={{ color: secondaryCardAccent }}>{config.aboutTitle?.trim() || `عن ${config.storeName}`}</h2><p className="line-clamp-4 text-sm leading-7 text-slate-600">{config.aboutText?.trim() || config.slogan}</p><button type="button" onClick={onOpenAbout} className="text-xs font-black" style={{ color: primaryCardAccent }}>قراءة صفحة من نحن</button></div>
        {config.aboutImage && <img src={config.aboutImage} alt="" className="aspect-video h-full w-full rounded-2xl object-cover md:aspect-square" referrerPolicy="no-referrer" />}
      </section>
    ),
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-10 px-3 py-6 animate-fadeIn md:px-6 md:py-10">
      {storefrontSectionsOrDefault(config.homeSections).filter((section) => section.visible).map((section) => (
        <div key={section.id} data-storefront-section={section.id}>{sections[section.id]}</div>
      ))}
    </div>
  );
}
