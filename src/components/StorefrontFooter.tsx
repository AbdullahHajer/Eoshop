import React from "react";
import { Camera, Clock, Info, Instagram, Mail, MapPin, MessageSquare, Phone, ShoppingBag, Twitter, Video } from "lucide-react";
import type { StoreConfig } from "../types";
import { canonicalContactTarget } from "../contracts/checkoutPolicy";
import { readableAccent } from "../utils/readableForeground";

interface Props {
  config: StoreConfig;
  primaryColor: string;
  secondaryColor: string;
  cardBackground: string;
  borderColor: string;
  attribution?: string | null;
  onNavigate: (page: "home" | "products" | "about" | "contact") => void;
}

const socialUrl = (network: "instagram" | "twitter" | "tiktok" | "snapchat", raw?: string): string | null => {
  const value = raw?.trim();
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  if (!/^@?[A-Za-z0-9._-]+$/.test(value)) return null;
  const handle = value.replace(/^@/, "");
  return {
    instagram: `https://instagram.com/${handle}`,
    twitter: `https://x.com/${handle}`,
    tiktok: `https://tiktok.com/@${handle}`,
    snapchat: `https://snapchat.com/add/${handle}`,
  }[network];
};

export default function StorefrontFooter({ config, primaryColor, secondaryColor, cardBackground, borderColor, attribution, onNavigate }: Props) {
  const phone = canonicalContactTarget(config.phone);
  const whatsapp = canonicalContactTarget(config.whatsapp);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email?.trim() ?? "") ? config.email!.trim() : null;
  const headingColor = readableAccent(secondaryColor, cardBackground);
  const accentColor = readableAccent(primaryColor, cardBackground);
  const bodyColor = readableAccent(config.textColor || "#475569", cardBackground);
  const attributionColor = readableAccent("#94A3B8", cardBackground);
  const social = [
    { key: "instagram" as const, label: "Instagram", value: config.instagram, icon: Instagram },
    { key: "twitter" as const, label: "X", value: config.twitter, icon: Twitter },
    { key: "tiktok" as const, label: "TikTok", value: config.tiktok, icon: Video },
    { key: "snapchat" as const, label: "Snapchat", value: config.snapchat, icon: Camera },
  ].map((item) => ({ ...item, href: socialUrl(item.key, item.value) })).filter((item) => item.href);

  return (
    <footer data-storefront-footer className="border-t px-4 pb-24 pt-10 lg:pb-10" style={{ backgroundColor: cardBackground, borderColor }}>
      <div className="mx-auto grid max-w-7xl gap-8 text-right sm:grid-cols-2 lg:grid-cols-4">
        <section className="space-y-3 sm:col-span-2 lg:col-span-1">
          <h2 className="text-lg font-black" style={{ color: headingColor }}>{config.storeName}</h2>
          <p className="max-w-sm text-sm leading-7" style={{ color: bodyColor }}>{config.slogan || "مرحبًا بكم في متجرنا."}</p>
        </section>

        <nav aria-label="روابط تذييل المتجر" className="space-y-3">
          <h2 className="text-sm font-black" style={{ color: headingColor }}>روابط المتجر</h2>
          <div className="grid gap-2 text-xs font-bold" style={{ color: bodyColor }}>
            <button type="button" onClick={() => onNavigate("home")} className="flex items-center gap-2 text-right hover:underline"><ShoppingBag className="h-4 w-4" style={{ color: accentColor }} />الرئيسية</button>
            <button type="button" onClick={() => onNavigate("products")} className="flex items-center gap-2 text-right hover:underline"><ShoppingBag className="h-4 w-4" style={{ color: accentColor }} />المنتجات</button>
            <button type="button" onClick={() => onNavigate("about")} className="flex items-center gap-2 text-right hover:underline"><Info className="h-4 w-4" style={{ color: accentColor }} />عن المتجر</button>
            <button type="button" onClick={() => onNavigate("contact")} className="flex items-center gap-2 text-right hover:underline"><MessageSquare className="h-4 w-4" style={{ color: accentColor }} />التواصل</button>
          </div>
        </nav>

        <section className="space-y-3">
          <h2 className="text-sm font-black" style={{ color: headingColor }}>بيانات التواصل</h2>
          <div className="grid gap-2 text-xs" style={{ color: bodyColor }}>
            {phone && <a href={`tel:${phone}`} className="flex items-center gap-2 hover:underline"><Phone className="h-4 w-4" style={{ color: accentColor }} /><span dir="ltr">{phone}</span></a>}
            {whatsapp && <a href={`https://wa.me/${whatsapp.slice(1)}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline"><MessageSquare className="h-4 w-4" style={{ color: accentColor }} />WhatsApp</a>}
            {email && <a href={`mailto:${email}`} className="flex items-center gap-2 break-all hover:underline"><Mail className="h-4 w-4 shrink-0" style={{ color: accentColor }} />{email}</a>}
            {config.address?.trim() && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accentColor }} />{config.address}</p>}
            {config.workingHours?.trim() && <p className="flex items-start gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accentColor }} />{config.workingHours}</p>}
            {!phone && !whatsapp && !email && !config.address?.trim() && !config.workingHours?.trim() && <p>لم يضف المتجر بيانات تواصل بعد.</p>}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-black" style={{ color: headingColor }}>حسابات المتجر</h2>
          {social.length > 0 ? <div className="flex flex-wrap gap-2">{social.map(({ label, href, icon: Icon }) => <a key={label} href={href!} target="_blank" rel="noreferrer" aria-label={`فتح ${label}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border" style={{ borderColor, color: accentColor }}><Icon className="h-4 w-4" /></a>)}</div> : <p className="text-xs" style={{ color: bodyColor }}>لا توجد حسابات اجتماعية منشورة.</p>}
        </section>
      </div>
      <div className="mx-auto mt-8 max-w-7xl border-t pt-5 text-center text-[11px]" style={{ borderColor }}>
        <p style={{ color: bodyColor }}>© {new Date().getFullYear()} {config.storeName} — جميع الحقوق محفوظة.</p>
        {attribution && <p className="mt-1 text-[10px]" style={{ color: attributionColor }}>{attribution}</p>}
      </div>
    </footer>
  );
}
