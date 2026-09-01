import React from "react";
import { ArrowLeft, Camera, Clock, Info, Instagram, Mail, MapPin, MessageSquare, Phone, ShoppingBag, Twitter, Video } from "lucide-react";
import type { StoreConfig } from "../types";
import { canonicalContactTarget } from "../contracts/checkoutPolicy";
import { readableAccent } from "../utils/readableForeground";
import { publishedStorefrontSocialLinks } from "../features/storefront/storefrontLinks";
import "../features/storefront/elegant-stories/elegantStories.css";

interface Props {
  config: StoreConfig;
  primaryColor: string;
  secondaryColor: string;
  cardBackground: string;
  borderColor: string;
  variant?: "default" | "elegant";
  attribution?: string | null;
  onNavigate: (page: "home" | "products" | "about" | "contact") => void;
}

export default function StorefrontFooter({ config, primaryColor, secondaryColor, cardBackground, borderColor, variant = "default", attribution, onNavigate }: Props) {
  const phone = canonicalContactTarget(config.phone);
  const whatsapp = canonicalContactTarget(config.whatsapp);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email?.trim() ?? "") ? config.email!.trim() : null;
  const headingColor = readableAccent(secondaryColor, cardBackground);
  const accentColor = readableAccent(primaryColor, cardBackground);
  const bodyColor = readableAccent(config.textColor || "#475569", cardBackground);
  const attributionColor = readableAccent("#94A3B8", cardBackground);
  const socialIcons = { instagram: Instagram, twitter: Twitter, tiktok: Video, snapchat: Camera } as const;
  const social = publishedStorefrontSocialLinks(config).map((item) => ({ ...item, icon: socialIcons[item.key] }));

  if (variant === "elegant") {
    const elegantSurface = secondaryColor;
    const elegantInk = readableAccent("#ffffff", elegantSurface);
    const elegantMuted = readableAccent(config.textColor || "#d6d3d1", elegantSurface);
    const elegantAccent = readableAccent(primaryColor, elegantSurface);
    const elegantBorder = readableAccent(borderColor, elegantSurface);
    const style = {
      backgroundColor: elegantSurface,
      "--elegant-footer-ink": elegantInk,
      "--elegant-footer-muted": elegantMuted,
      "--elegant-footer-accent": elegantAccent,
      "--elegant-footer-border": elegantBorder,
    } as React.CSSProperties;

    return (
      <footer data-storefront-footer data-elegant-footer="true" className="elegant-footer" style={style}>
        <div className="elegant-footer__lead">
          <section>
            <span>اكتشف القصة كاملة</span>
            <h2>{config.storeName}</h2>
            <p>{config.slogan?.trim() || "مرحبًا بكم في متجرنا."}</p>
          </section>
          <nav aria-label="روابط تذييل المتجر">
            <button type="button" onClick={() => onNavigate("home")}>الرئيسية<ArrowLeft aria-hidden="true" /></button>
            <button type="button" onClick={() => onNavigate("products")}>المنتجات<ArrowLeft aria-hidden="true" /></button>
            <button type="button" onClick={() => onNavigate("about")}>عن المتجر<ArrowLeft aria-hidden="true" /></button>
            <button type="button" onClick={() => onNavigate("contact")}>التواصل<ArrowLeft aria-hidden="true" /></button>
          </nav>
        </div>

        <div className="elegant-footer__details">
          <section>
            <h3>بيانات التواصل</h3>
            <div>
              {phone ? <a href={`tel:${phone}`}><Phone aria-hidden="true" /><span dir="ltr">{phone}</span></a> : null}
              {whatsapp ? <a href={`https://wa.me/${whatsapp.slice(1)}`} target="_blank" rel="noreferrer"><MessageSquare aria-hidden="true" />WhatsApp</a> : null}
              {email ? <a href={`mailto:${email}`}><Mail aria-hidden="true" />{email}</a> : null}
              {config.address?.trim() ? <p><MapPin aria-hidden="true" />{config.address}</p> : null}
              {config.workingHours?.trim() ? <p><Clock aria-hidden="true" />{config.workingHours}</p> : null}
              {!phone && !whatsapp && !email && !config.address?.trim() && !config.workingHours?.trim() ? <p>لم يضف المتجر بيانات تواصل بعد.</p> : null}
            </div>
          </section>
          <section>
            <h3>حسابات المتجر</h3>
            {social.length > 0 ? <div className="elegant-footer__social">{social.map(({ key, label, href, icon: Icon }) => <a key={key} href={href} target="_blank" rel="noreferrer" aria-label={`فتح ${label}`}><Icon aria-hidden="true" />{label}</a>)}</div> : <p>لا توجد حسابات اجتماعية منشورة.</p>}
          </section>
        </div>

        <div className="elegant-footer__legal">
          <p>© {new Date().getFullYear()} {config.storeName} — جميع الحقوق محفوظة.</p>
          {attribution ? <p>{attribution}</p> : null}
        </div>
      </footer>
    );
  }

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
          {social.length > 0 ? <div className="flex flex-wrap gap-2">{social.map(({ key, label, href, icon: Icon }) => <a key={key} href={href} target="_blank" rel="noreferrer" aria-label={`فتح ${label}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border" style={{ borderColor, color: accentColor }}><Icon className="h-4 w-4" /></a>)}</div> : <p className="text-xs" style={{ color: bodyColor }}>لا توجد حسابات اجتماعية منشورة.</p>}
        </section>
      </div>
      <div className="mx-auto mt-8 max-w-7xl border-t pt-5 text-center text-[11px]" style={{ borderColor }}>
        <p style={{ color: bodyColor }}>© {new Date().getFullYear()} {config.storeName} — جميع الحقوق محفوظة.</p>
        {attribution && <p className="mt-1 text-[10px]" style={{ color: attributionColor }}>{attribution}</p>}
      </div>
    </footer>
  );
}
