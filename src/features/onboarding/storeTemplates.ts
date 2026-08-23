import { applyStoreOnboardingAppearance, type StoreOnboardingAppearance } from "../../contracts/storeOnboardingAppearance";
import type { Product, StoreConfig } from "../../types";

export type OnboardingTemplateKey = "elegant" | "tech";

export interface OnboardingTemplate {
  key: OnboardingTemplateKey;
  name: string;
  category: string;
  description: string;
  bestFor: string;
  previewProducts: string[];
  appearance: StoreOnboardingAppearance;
  sampleProducts: Product[];
}

const safeOnboardingConfig: StoreConfig = {
  storeName: "متجري الجديد",
  slogan: "كل ما تحتاجه في مكان واحد",
  logoIcon: "🛍️",
  primaryColor: "#0284C7",
  secondaryColor: "#0F172A",
  textColor: "#334155",
  bgColor: "#F8FAFC",
  cardBgColor: "#FFFFFF",
  borderColor: "#E2E8F0",
  themeStyle: "elegant",
  bannerText: "أهلاً بك في متجري الجديد",
  products: [],
  fontFamily: "Cairo",
  phone: "",
  currency: "YER",
  enableStockManagement: true,
  allowOrdersWhenOutOfStock: false,
  showStockBadge: true,
  lowStockWarningThreshold: 5,
  enableCashOnDelivery: true,
  cashOnDeliveryFee: 0,
  enableBankTransfer: false,
  enableOnlineCard: false,
  enableApplePay: false,
  enableStcPay: false,
  enableEWallets: false,
  customWallets: [],
  enableCoupons: false,
  customCoupons: [],
  enableWhatsAppNotification: false,
};

export const ONBOARDING_TEMPLATES: OnboardingTemplate[] = [
  {
    key: "elegant",
    name: "الأناقة العصرية",
    category: "دافئ وفاخر",
    description: "واجهة واسعة بهوية هادئة وبطاقات أنيقة تبرز قصة النشاط.",
    bestFor: "العطور، الأزياء، الهدايا والمنتجات اليدوية",
    previewProducts: ["#F4E7D3", "#E8D4B4", "#D9B77E"],
    appearance: {
      slogan: "منتجات مختارة بعناية لتجربة لا تُنسى",
      logoIcon: "✨",
      primaryColor: "#B7791F",
      secondaryColor: "#292524",
      textColor: "#44403C",
      bgColor: "#FFFBEB",
      cardBgColor: "#FFFFFF",
      borderColor: "#F1E5D1",
      fontFamily: "Cairo",
      bannerText: "اكتشف تشكيلتنا المختارة بعناية",
      showHeroBanner: true,
      heroBannerTitle: "تفاصيل جميلة تصنع فرقًا",
      heroBannerSubtitle: "واجهة دافئة تساعد عملاءك على اكتشاف منتجاتك بسهولة",
      heroBannerBadge: "اختيارات مميزة",
      heroBannerButtonText: "استكشف المنتجات",
      heroBannerHeight: "medium",
      heroBannerOverlayOpacity: 35,
    },
    sampleProducts: [
      { id: "preview-elegant-1", status: "published", name: "عطر ليالي صنعاء", price: 18500, description: "توليفة دافئة بروح يمنية أصيلة.", category: "عطور", imageKeyword: "perfume", manageStock: false },
      { id: "preview-elegant-2", status: "published", name: "مبخرة حجرية", price: 12500, description: "قطعة أنيقة للمنزل والمكتب.", category: "هدايا", imageKeyword: "incense", manageStock: false },
      { id: "preview-elegant-3", status: "published", name: "صندوق هدية فاخر", price: 22000, description: "هدية جاهزة بتغليف مميز.", category: "هدايا", imageKeyword: "gift", manageStock: false },
    ],
  },
  {
    key: "tech",
    name: "التقنية والابتكار",
    category: "واضح وحديث",
    description: "تصميم سريع ومباشر يبرز المواصفات والعروض والمنتجات الحديثة.",
    bestFor: "الإلكترونيات، الملحقات، الخدمات والمنتجات الرقمية",
    previewProducts: ["#DBEAFE", "#BAE6FD", "#CBD5E1"],
    appearance: {
      slogan: "حلول ذكية لحياة أسرع وأسهل",
      logoIcon: "⚡",
      primaryColor: "#0284C7",
      secondaryColor: "#0F172A",
      textColor: "#334155",
      bgColor: "#F8FAFC",
      cardBgColor: "#FFFFFF",
      borderColor: "#E2E8F0",
      fontFamily: "Tajawal",
      bannerText: "تقنية موثوقة وتجربة شراء واضحة",
      showHeroBanner: true,
      heroBannerTitle: "التقنية التي تناسب يومك",
      heroBannerSubtitle: "اعرض المواصفات والمزايا بأسلوب مباشر وحديث",
      heroBannerBadge: "وصل حديثًا",
      heroBannerButtonText: "شاهد المنتجات",
      heroBannerHeight: "medium",
      heroBannerOverlayOpacity: 40,
    },
    sampleProducts: [
      { id: "preview-tech-1", status: "published", name: "سماعة لاسلكية", price: 14500, description: "صوت واضح وبطارية طويلة.", category: "صوتيات", imageKeyword: "headphones", manageStock: false },
      { id: "preview-tech-2", status: "published", name: "شاحن ذكي سريع", price: 8500, description: "شحن آمن لعدة أجهزة.", category: "ملحقات", imageKeyword: "charger", manageStock: false },
      { id: "preview-tech-3", status: "published", name: "ساعة رياضية", price: 19500, description: "متابعة النشاط والتنبيهات اليومية.", category: "ساعات", imageKeyword: "smartwatch", manageStock: false },
    ],
  },
];

export function createTemplateConfig(
  template: OnboardingTemplate,
  storeName: string,
  baseConfig: StoreConfig = safeOnboardingConfig,
): StoreConfig {
  return applyStoreOnboardingAppearance(baseConfig, template.appearance, storeName, template.key);
}

export function createTemplatePreviewConfig(template: OnboardingTemplate, persistedConfig: StoreConfig): StoreConfig {
  return {
    ...persistedConfig,
    products: template.sampleProducts.map((product) => ({ ...product })),
  };
}
