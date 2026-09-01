import React from "react";
import {
  ArrowLeft,
  Camera,
  Clock,
  Instagram,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Quote,
  ShoppingBag,
  Twitter,
  Video,
} from "lucide-react";
import type { StoreConfig } from "../../../types";
import { canonicalContactTarget } from "../../../contracts/checkoutPolicy";
import { readableAccent } from "../../../utils/readableForeground";
import { publishedStorefrontSocialLinks, type StorefrontSocialNetwork } from "../storefrontLinks";
import "./elegantStories.css";

interface ThemeProps {
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  backgroundColor: string;
  cardBackground: string;
  borderColor: string;
}

interface AboutProps extends ThemeProps {
  config: StoreConfig;
  onOpenProducts: () => void;
  onOpenContact: () => void;
}

interface ContactProps extends ThemeProps {
  config: StoreConfig;
}

const themeStyle = ({ primaryColor, secondaryColor, textColor, backgroundColor, cardBackground, borderColor }: ThemeProps) => ({
  "--elegant-page-background": backgroundColor,
  "--elegant-page-surface": cardBackground,
  "--elegant-page-border": borderColor,
  "--elegant-page-ink": readableAccent(secondaryColor, backgroundColor),
  "--elegant-page-muted": readableAccent(textColor, backgroundColor),
  "--elegant-page-card-ink": readableAccent(secondaryColor, cardBackground),
  "--elegant-page-card-muted": readableAccent(textColor, cardBackground),
  "--elegant-page-accent": readableAccent(primaryColor, backgroundColor),
  "--elegant-page-card-accent": readableAccent(primaryColor, cardBackground),
  "--elegant-page-strong-surface": secondaryColor,
  "--elegant-page-strong-ink": readableAccent("#ffffff", secondaryColor),
  "--elegant-page-strong-accent": readableAccent(primaryColor, secondaryColor),
}) as React.CSSProperties;

const SOCIAL_ICONS: Record<StorefrontSocialNetwork, React.ComponentType<{ "aria-hidden"?: boolean }>> = {
  instagram: Instagram,
  twitter: Twitter,
  tiktok: Video,
  snapchat: Camera,
};

export function ElegantAboutPage({ config, onOpenProducts, onOpenContact, ...theme }: AboutProps) {
  const title = config.aboutTitle?.trim() || `عن ${config.storeName}`;
  const story = config.aboutText?.trim() || config.slogan?.trim() || "لم يضف المتجر نبذة تعريفية بعد.";
  const vision = config.aboutVision?.trim() || null;
  const address = config.address?.trim() || null;
  const hours = config.workingHours?.trim() || null;
  const hasVisitDetails = Boolean(address || hours);

  return (
    <main className="elegant-information-page elegant-about" data-elegant-about="true" style={themeStyle(theme)}>
      <header className="elegant-information-hero">
        <div className="elegant-information-hero__copy">
          <span>قصة المتجر</span>
          <h1 data-storefront-about-heading>{title}</h1>
          <p>{story}</p>
          <div className="elegant-information-hero__actions">
            <button type="button" onClick={onOpenProducts}><ShoppingBag aria-hidden="true" />تصفّح المجموعة</button>
            <button type="button" onClick={onOpenContact}>تواصل معنا<ArrowLeft aria-hidden="true" /></button>
          </div>
        </div>

        {config.aboutImage?.trim() ? (
          <figure className="elegant-about__portrait">
            <img src={config.aboutImage} alt={`صورة تعريفية لمتجر ${config.storeName}`} loading="eager" decoding="async" referrerPolicy="no-referrer" />
            <figcaption>{config.storeName}</figcaption>
          </figure>
        ) : (
          <aside className="elegant-about__signature" aria-label="هوية المتجر النصية">
            <Quote aria-hidden="true" />
            <strong>{config.storeName}</strong>
            <span>{config.slogan?.trim() || "قصة المتجر تبدأ من اختياراته المنشورة."}</span>
          </aside>
        )}
      </header>

      <section className="elegant-about__details" aria-label="تفاصيل المتجر">
        <article className="elegant-about__vision">
          <span>01</span>
          <div>
            <p>رؤيتنا</p>
            <h2>{vision ? "ما الذي يقود اختياراتنا" : "الرؤية لم تُنشر بعد"}</h2>
            <blockquote>{vision || "لم يضف المتجر نص الرؤية حتى الآن."}</blockquote>
          </div>
        </article>

        <article className="elegant-about__visit">
          <span>02</span>
          <div>
            <p>معلومات الزيارة</p>
            <h2>{hasVisitDetails ? "تفاصيل منشورة من المتجر" : "لا توجد تفاصيل زيارة منشورة"}</h2>
            <div className="elegant-about__visit-lines">
              {address ? <p><MapPin aria-hidden="true" /><span><strong>العنوان</strong>{address}</span></p> : null}
              {hours ? <p><Clock aria-hidden="true" /><span><strong>ساعات العمل</strong>{hours}</span></p> : null}
              {!hasVisitDetails ? <p>يمكنك مراجعة صفحة التواصل لمعرفة الوسائل المتاحة حاليًا.</p> : null}
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

export function ElegantContactPage({ config, ...theme }: ContactProps) {
  const phone = canonicalContactTarget(config.phone);
  const whatsapp = canonicalContactTarget(config.whatsapp);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email?.trim() ?? "") ? config.email!.trim() : null;
  const address = config.address?.trim() || null;
  const hours = config.workingHours?.trim() || null;
  const social = publishedStorefrontSocialLinks(config);
  const hasDirectContact = Boolean(phone || whatsapp || email || address || hours);

  return (
    <main className="elegant-information-page elegant-contact" data-elegant-contact="true" style={themeStyle(theme)}>
      <header className="elegant-contact__intro">
        <span>تواصل مباشر</span>
        <h1>لنبدأ الحديث</h1>
        <p>تعرض هذه الصفحة وسائل التواصل التي نشرها المتجر فقط. تتم المكالمات والمراسلات خارج المنصة.</p>
      </header>

      {hasDirectContact ? (
        <section className="elegant-contact__grid" aria-label="وسائل التواصل المنشورة">
          {phone ? (
            <a href={`tel:${phone}`} className="elegant-contact-card elegant-contact-card--primary">
              <span>01</span><Phone aria-hidden="true" /><p>اتصال هاتفي</p><strong dir="ltr">{phone}</strong><ArrowLeft aria-hidden="true" />
            </a>
          ) : null}
          {whatsapp ? (
            <a href={`https://wa.me/${whatsapp.slice(1)}`} target="_blank" rel="noreferrer" className="elegant-contact-card">
              <span>02</span><MessageSquare aria-hidden="true" /><p>WhatsApp</p><strong dir="ltr">{whatsapp}</strong><ArrowLeft aria-hidden="true" />
            </a>
          ) : null}
          {email ? (
            <a href={`mailto:${email}`} className="elegant-contact-card">
              <span>03</span><Mail aria-hidden="true" /><p>البريد الإلكتروني</p><strong dir="ltr">{email}</strong><ArrowLeft aria-hidden="true" />
            </a>
          ) : null}
          {address ? (
            <article className="elegant-contact-card">
              <span>04</span><MapPin aria-hidden="true" /><p>العنوان</p><strong>{address}</strong>
            </article>
          ) : null}
          {hours ? (
            <article className="elegant-contact-card">
              <span>05</span><Clock aria-hidden="true" /><p>ساعات العمل</p><strong>{hours}</strong>
            </article>
          ) : null}
        </section>
      ) : (
        <section className="elegant-contact__empty" role="status">
          <MessageSquare aria-hidden="true" />
          <h2>لا توجد وسيلة تواصل منشورة</h2>
          <p>لم يضف المتجر وسيلة تواصل مباشرة بعد.</p>
        </section>
      )}

      <section className="elegant-contact__social" aria-label="حسابات المتجر الاجتماعية">
        <div><span>تابع المتجر</span><h2>حسابات منشورة</h2></div>
        {social.length > 0 ? (
          <div>{social.map((item) => {
            const Icon = SOCIAL_ICONS[item.key];
            return <a key={item.key} href={item.href} target="_blank" rel="noreferrer" aria-label={`فتح ${item.label}`}><Icon aria-hidden="true" />{item.label}<ArrowLeft aria-hidden="true" /></a>;
          })}</div>
        ) : <p>لا توجد حسابات اجتماعية منشورة.</p>}
      </section>
    </main>
  );
}
