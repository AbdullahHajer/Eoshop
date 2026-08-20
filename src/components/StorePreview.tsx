import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShoppingBag, Phone, ChevronLeft, ChevronRight, Search, Plus, Minus, X, Check, ArrowRight,
  Mail, MapPin, Clock, MessageSquare, Send, Sparkles, Heart, ShieldCheck, Truck, CreditCard,
  Instagram, Twitter, Video, Camera, Share2, Cpu, Zap, Activity, Shield, Terminal, Wifi, Box,
  Home, Info, Wallet, Copy, FileText, Printer, CheckCircle2, Building, QrCode, Tag, ExternalLink, Lock,
  Headphones
} from "lucide-react";
import { StoreConfig, Product } from "../types";
import type { CreateOrderInput, OrderReceipt } from "../adapters/uiAdapters";
import ProductArt from "./ProductArt";
import { buildPrintableInvoiceHtml, calculatePreviewCheckout, canonicalContactTarget, preferredContactTarget, previewPercentageDiscount } from "../contracts/checkoutPolicy";

interface StorePreviewProps {
  config: StoreConfig;
  cart: { product: Product; quantity: number }[];
  addToCart: (product: Product) => void;
  updateQuantity: (productId: string, amount: number) => void;
  calculateTotal: () => void; // not used as we can calculate locally
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (isOpen: boolean) => void;
  hasOrdered: boolean;
  handleCheckout: () => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  previewDevice?: "desktop" | "mobile";
  onBackToLanding?: () => void;
  externalPage?: string;
  onResetExternalPage?: () => void;
  mode?: "preview" | "live";
  submitOrder?: (input: Omit<CreateOrderInput, "workspaceRevision" | "catalogRevision">) => Promise<OrderReceipt>;
}

const getFontFamilyStyle = (fontName?: string) => {
  switch (fontName) {
    case "Tajawal": return "'Tajawal', sans-serif";
    case "Almarai": return "'Almarai', sans-serif";
    case "Alexandria": return "'Alexandria', sans-serif";
    case "IBM Plex Sans Arabic":
    case "IBMPlexSansArabic": return "'IBM Plex Sans Arabic', sans-serif";
    case "Amiri": return "'Amiri', serif";
    case "Changa": return "'Changa', sans-serif";
    case "Readex Pro":
    case "ReadexPro": return "'Readex Pro', sans-serif";
    case "Cairo":
    default:
      return "'Cairo', sans-serif";
  }
};

export default function StorePreview({
  config,
  cart,
  addToCart,
  updateQuantity,
  isCartDrawerOpen,
  setIsCartDrawerOpen,
  hasOrdered,
  handleCheckout,
  selectedCategory,
  setSelectedCategory,
  previewDevice = "desktop",
  externalPage,
  onResetExternalPage,
  mode = "preview",
  submitOrder,
}: StorePreviewProps) {
  
  // Navigation Page State inside store
  const [storePage, setStorePage] = useState<"home" | "products" | "about" | "contact" | "product" | "checkout">("home");

  useEffect(() => {
    if (externalPage && ["home", "products", "about", "contact", "product", "checkout"].includes(externalPage)) {
      setStorePage(externalPage as any);
      if (onResetExternalPage) onResetExternalPage();
    }
  }, [externalPage]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [productQty, setProductQty] = useState(1);
  const [activeTab, setActiveTab] = useState<"specs" | "shipping" | "reviews">("specs");
  const [copiedLink, setCopiedLink] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Checkout & Payment States
  const [checkoutForm, setCheckoutForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    city: "صنعاء",
    address: "",
    notes: ""
  });
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "wallet">("cod");
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [transferRefNumber, setTransferRefNumber] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponMessage, setCouponMessage] = useState("");
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [placedOrderDetails, setPlacedOrderDetails] = useState<any>(null);
  const [copiedWalletNum, setCopiedWalletNum] = useState<string | null>(null);
  const [formValidationErr, setFormValidationErr] = useState("");
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  useEffect(() => {
    if (config.enableCashOnDelivery !== true) setPaymentMethod("wallet");
  }, [config.enableCashOnDelivery]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedProduct]);

  const handleOpenProductProfile = (product: Product) => {
    setSelectedProduct(product);
    setProductQty(1);
    setActiveImageIndex(0);
    setStorePage("product");
    const container = document.getElementById("store-preview-scroll-container");
    if (container) {
      container.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleAddToCartWithQty = (product: Product, qty: number) => {
    for (let i = 0; i < qty; i++) {
      addToCart(product);
    }
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 3000);
  };

  const primaryColor = config.primaryColor || "#D4AF37";
  const secondaryColor = config.secondaryColor || "#1C1917";
  const textColor = config.textColor || (config.themeStyle === "elegant" ? "#44403C" : "#334155");
  const bgColor = config.bgColor || (config.themeStyle === "elegant" ? "#fdfbf7" : "#f8fafc");
  const cardBgColor = config.cardBgColor || "#ffffff";
  const borderColor = config.borderColor || (config.themeStyle === "elegant" ? "#f2eae1" : "#e2e8f0");
  const isElegant = config.themeStyle === "elegant";
  const canonicalPhone = canonicalContactTarget(config.phone);

  // Calculate cart total locally
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Categories list
  const categories = ["الكل"];
  config.products.forEach((p) => {
    if (p.category && !categories.includes(p.category)) {
      categories.push(p.category);
    }
  });

  // Filter products by category AND search query
  const displayedProducts = config.products.filter((p) => {
    const matchesCategory = selectedCategory === "الكل" || p.category === selectedCategory;
    const matchesSearch = searchQuery.trim() === "" || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div 
      id="store-preview-scroll-container"
      className="w-full h-full flex flex-col relative select-none overflow-y-auto pb-20 md:pb-6"
      style={{ 
        fontFamily: getFontFamilyStyle(config.fontFamily),
        backgroundColor: bgColor,
        color: textColor
      }}
    >
      {/* Promotion / Announcement Bar */}
      {config.bannerText && (
        <div 
          className={`text-center py-2.5 px-4 text-xs font-extrabold transition-all duration-300 shadow-2xs flex items-center justify-center min-h-[40px] ${
            !isElegant ? "bg-slate-900 border-b border-sky-900/40 text-sky-100 flex items-center justify-between gap-2 max-w-full" : ""
          }`}
          style={{ 
            backgroundColor: isElegant ? primaryColor : undefined, 
            color: isElegant ? "#ffffff" : undefined 
          }}
        >
          {!isElegant ? (
            <div className="max-w-7xl mx-auto w-full flex items-center justify-between text-[11px] leading-normal">
              <div className="hidden sm:flex items-center gap-2">
                <span className="bg-sky-500/20 text-sky-300 border border-sky-400/30 px-2.5 py-0.5 rounded-full font-mono text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>تِك فيو V2.4 ⚡</span>
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-300 flex items-center gap-1 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>ضمان رسمي 24 شهراً معتمد</span>
                </span>
              </div>
              <motion.p
                animate={{ opacity: [0.85, 1, 0.85] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="truncate max-w-xl text-center mx-auto sm:mx-0 font-bold text-sky-200 leading-relaxed"
              >
                🔥 {config.bannerText}
              </motion.p>
              {canonicalPhone && <div className="hidden lg:flex items-center gap-3 text-slate-300">
                <a href={`tel:${canonicalPhone}`} className="hover:text-sky-300 transition flex items-center gap-1">
                  <Phone className="w-3 h-3 text-sky-400" />
                  <span>دعم العملاء المباشر</span>
                </a>
              </div>}
            </div>
          ) : (
            <motion.p
              animate={{ opacity: [0.85, 1, 0.85] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="truncate max-w-2xl text-xs sm:text-sm mx-auto font-bold leading-normal text-center"
            >
              {config.bannerText}
            </motion.p>
          )}
        </div>
      )}

      {/* Main Header */}
      {!isElegant ? (
        /* TECH TEMPLATE UNIQUE HEADER DESIGN */
        <header 
          className="sticky top-0 z-20 backdrop-blur-xl border-b shadow-sm transition-all duration-300"
          style={{ backgroundColor: cardBgColor, borderColor: borderColor }}
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Top Row: Brand & Mobile Cart */}
            <div className="flex items-center justify-between w-full md:w-auto shrink-0">
              <div 
                onClick={() => setStorePage("home")}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div className="relative flex items-center">
                  {config.logoUrl ? (
                    <img 
                      src={config.logoUrl} 
                      alt={config.storeName} 
                      style={{ height: `${config.logoSize || 44}px` }} 
                      className="w-auto max-w-[220px] object-contain group-hover:scale-105 transition duration-300 shrink-0 filter drop-shadow-xs" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <span 
                      style={{ 
                        width: `${config.logoSize || 44}px`, 
                        height: `${config.logoSize || 44}px`,
                        fontSize: `${Math.max(16, (config.logoSize || 44) * 0.5)}px`
                      }} 
                      className="rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20 group-hover:scale-105 transition duration-300 shrink-0"
                    >
                      {config.logoIcon || "⚡"}
                    </span>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-black group-hover:text-sky-700 transition tracking-tight" style={{ color: secondaryColor }}>
                      {config.storeName || "متجر الأجهزة الذكية"}
                    </h1>
                    <span className="bg-gradient-to-r from-sky-500 to-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase">
                      TECH
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-extrabold truncate max-w-[180px] md:max-w-xs">
                    {config.slogan || "أحدث ابتكارات التكنولوجيا والملحقات"}
                  </p>
                </div>
              </div>

              {/* Mobile Shopping Cart Trigger */}
              <div className="flex md:hidden items-center gap-2">
                <button
                  onClick={() => setIsCartDrawerOpen(true)}
                  className="p-2.5 rounded-xl bg-slate-900 text-white shadow-md relative flex items-center justify-center"
                >
                  <ShoppingBag className="w-4 h-4 text-sky-400" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1.5 -left-1.5 bg-sky-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                      {totalItems}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Middle Section: Integrated Header Live Search & Desktop Nav */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
              {/* Header Live Search Input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (storePage !== "products" && storePage !== "home" && e.target.value.trim() !== "") {
                      setStorePage("products");
                    }
                  }}
                  placeholder="ابحث عن جهاز، سماعة، شاحن..."
                  className="w-full bg-slate-100/90 border border-slate-200/90 hover:border-sky-300 focus:border-sky-500 focus:bg-white rounded-xl py-2 pr-9 pl-7 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-hidden transition shadow-2xs"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute top-1/2 -translate-y-1/2 left-2.5 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Segmented Floating Pill Nav (Desktop Only) */}
              <nav className="hidden md:flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/90 text-xs font-bold">
                {[
                  { id: "home", label: "الرئيسية", icon: Zap },
                  { id: "products", label: "الأجهزة", icon: Box },
                  { id: "about", label: "الضمان", icon: ShieldCheck },
                  { id: "contact", label: "الدعم", icon: MessageSquare }
                ].map((item) => {
                  const isActive = storePage === item.id;
                  const IconComp = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setStorePage(item.id as any)}
                      className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 font-extrabold ${
                        isActive
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                      }`}
                    >
                      <IconComp className={`w-3.5 h-3.5 ${isActive ? "text-sky-400" : "text-slate-500"}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Desktop Actions Section: Contact hotline & Cart Trigger Pill */}
            <div className="hidden md:flex items-center gap-2.5">
              {canonicalPhone && (
                <a 
                  href={`tel:${canonicalPhone}`}
                  className="p-2 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200/80 transition flex items-center gap-1.5 text-xs font-extrabold"
                  title="تواصل هاتفياً"
                >
                  <Phone className="w-3.5 h-3.5 text-sky-600" />
                  <span className="hidden lg:inline">{canonicalPhone}</span>
                </a>
              )}

              <button
                onClick={() => setIsCartDrawerOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-extrabold text-xs transition shadow-md hover:shadow-lg flex items-center gap-2.5 border border-slate-800 group"
              >
                <div className="relative">
                  <ShoppingBag className="w-4 h-4 text-sky-400 group-hover:scale-110 transition" />
                  {totalItems > 0 && (
                    <span className="absolute -top-2 -left-2 bg-sky-500 text-white font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center border border-slate-900 shadow-2xs">
                      {totalItems}
                    </span>
                  )}
                </div>
                <span>سلة التسوق</span>
                {cartTotal > 0 && (
                  <span className="bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-md text-[11px] font-mono border border-sky-500/30">
                    {cartTotal} {config.currency || "ر.س"}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>
      ) : (
        /* ELEGANT LUXURY TEMPLATE HEADER DESIGN */
        <header 
          className="sticky top-0 z-20 px-4 py-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-3 backdrop-blur-md shadow-2xs"
          style={{ 
            backgroundColor: cardBgColor,
            borderColor: borderColor
          }}
        >
          <div className="flex items-center justify-between w-full md:w-auto">
            {/* Brand Logo & Name */}
            <div 
              onClick={() => setStorePage("home")}
              className="flex items-center gap-2.5 text-right cursor-pointer group"
            >
              {config.logoUrl ? (
                <img 
                  src={config.logoUrl} 
                  alt={config.storeName} 
                  style={{ height: `${config.logoSize || 42}px` }} 
                  className="w-auto max-w-[220px] object-contain shrink-0 transition group-hover:scale-105 filter drop-shadow-xs" 
                  referrerPolicy="no-referrer" 
                />
              ) : config.logoIcon ? (
                <span 
                  style={{ 
                    width: `${config.logoSize || 40}px`, 
                    height: `${config.logoSize || 40}px`,
                    borderColor: `${primaryColor}40`,
                    fontSize: `${Math.max(16, (config.logoSize || 40) * 0.5)}px`
                  }} 
                  className="rounded-xl flex items-center justify-center shadow-2xs border shrink-0 transition bg-white group-hover:scale-105"
                >
                  {config.logoIcon}
                </span>
              ) : null}
              <div className="flex flex-col">
                <h1 className="text-sm md:text-base font-black tracking-tight leading-none" style={{ color: secondaryColor }}>
                  {config.storeName || "متجر جديد"}
                </h1>
                <p className="text-[10px] text-slate-500 font-bold truncate max-w-[150px] md:max-w-xs leading-tight mt-0.5">
                  {config.slogan || "أهلاً بكم في متجرنا"}
                </p>
              </div>
            </div>

            {/* Mobile Right Controls: Cart */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => setIsCartDrawerOpen(true)}
                className="p-2.5 rounded-xl relative transition flex items-center justify-center text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <ShoppingBag className="w-4 h-4" />
                {totalItems > 0 && (
                  <span 
                    className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shadow-md text-white"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    {totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Center Page Navigation Bar (Desktop Only) */}
          <nav className="hidden md:flex items-center justify-center gap-1 p-1 rounded-xl self-center border bg-slate-400/10"
               style={{ borderColor: "#f2eae1" }}>
            {[
              { id: "home", label: "الرئيسية", icon: "🏠" },
              { id: "products", label: "كتالوج المنتجات", icon: "🛍️" },
              { id: "about", label: "عن المتجر والضمان", icon: "📖" },
              { id: "contact", label: "الدعم الفني", icon: "📞" }
            ].map((nav) => {
              const isActive = storePage === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setStorePage(nav.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    isActive ? "shadow-2xs" : "hover:text-slate-600 opacity-80 hover:opacity-100"
                  }`}
                  style={{
                    backgroundColor: isActive ? primaryColor : "transparent",
                    color: isActive ? "#ffffff" : secondaryColor
                  }}
                >
                  <span>{nav.icon}</span>
                  <span>{nav.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Desktop Header Actions */}
          <div className="hidden md:flex items-center gap-3">
            {canonicalPhone && (
              <a 
                href={`tel:${canonicalPhone}`}
                className="p-2 px-3 rounded-xl transition flex items-center gap-1.5 text-xs font-bold"
                style={{ 
                  backgroundColor: "#f5efe6",
                  color: primaryColor 
                }}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{canonicalPhone}</span>
              </a>
            )}

            <button
              onClick={() => setIsCartDrawerOpen(true)}
              className="p-2.5 px-4 rounded-xl relative transition flex items-center gap-2 font-bold text-xs text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>السلة</span>
              {totalItems > 0 && (
                <span className="w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center shadow-2xs mr-1 bg-white text-slate-900">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </header>
      )}

      {/* ------------------- PAGE CONTENTS RENDER ------------------- */}
      <div className="flex-1">

        {/* 1. HOME PAGE (الرئيسية) */}
        {storePage === "home" && (
          !isElegant ? (
            /* ==================================================== */
            /* TECH & MODERN DEVICES TEMPLATE UNIQUE HOMEPAGE DESIGN */
            /* ==================================================== */
            <div className="space-y-10 animate-fadeIn pb-12">
              {/* 1. FUTURISTIC TECH HERO HUB */}
              <section className="relative overflow-hidden py-8 sm:py-12 md:py-14 px-4 md:px-6 bg-slate-950 text-white rounded-3xl mx-2 sm:mx-4 md:mx-6 shadow-2xl border border-slate-800">
                {/* Background Ambient Cyber Glows */}
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:2rem_2rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />

                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                  <div className="text-right space-y-4 flex-1 w-full">
                    {/* Cyber Status Header Pills */}
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 font-bold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                        <span>STATION: ONLINE ⚡</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300">
                        ضمان معتمد 24M 🛡️
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300">
                        توصيل فوري 🚀
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {config.logoUrl ? (
                        <img 
                          src={config.logoUrl} 
                          alt={config.storeName} 
                          style={{ height: `${Math.min(110, Math.max(36, (config.logoSize || 48) * 1.2))}px` }} 
                          className="w-auto max-w-[280px] object-contain shrink-0 filter drop-shadow-md" 
                          referrerPolicy="no-referrer" 
                        />
                      ) : config.logoIcon ? (
                        <span 
                          style={{ 
                            width: `${Math.min(80, Math.max(36, (config.logoSize || 48) * 1.1))}px`,
                            height: `${Math.min(80, Math.max(36, (config.logoSize || 48) * 1.1))}px`,
                            fontSize: `${Math.max(18, (config.logoSize || 48) * 0.55)}px`
                          }}
                          className="rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 border border-sky-400/40 shrink-0"
                        >
                          {config.logoIcon}
                        </span>
                      ) : null}
                      <div>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
                          منصة {config.storeName}
                        </h2>
                        <span className="text-xs text-sky-400 font-bold tracking-wide">
                          TECH INNOVATION HUB // V2.5
                        </span>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed font-medium">
                      {config.slogan}. أحدث الأجهزة الذكية والملحقات التقنية بأعلى معايير الجودة والأمان مع ضمان استبدال رسمي 24 شهراً.
                    </p>

                    {/* Quick Categories Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-1 text-xs">
                      {categories.slice(0, 5).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => {
                            setSelectedCategory(cat);
                            setStorePage("products");
                          }}
                          className="px-3 py-1 rounded-xl bg-slate-800/90 hover:bg-sky-500/20 hover:border-sky-400 border border-slate-700 text-slate-200 text-[11px] font-bold transition flex items-center gap-1"
                        >
                          <span>⚡</span>
                          <span>{cat}</span>
                        </button>
                      ))}
                    </div>

                    {/* Action CTAs */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 w-full sm:w-auto">
                      <button
                        onClick={() => setStorePage("products")}
                        className="px-6 py-3.5 rounded-xl font-black text-xs text-white bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-lg shadow-sky-500/20 active:scale-95 transition flex items-center justify-center gap-2"
                      >
                        <Cpu className="w-4 h-4" />
                        <span>استكشف كتالوج الأجهزة العصرية 🛍️</span>
                      </button>
                      <button
                        onClick={() => setStorePage("contact")}
                        className="px-5 py-3.5 rounded-xl font-bold text-xs text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-700 transition flex items-center justify-center gap-2"
                      >
                        <Phone className="w-4 h-4 text-sky-400" />
                        <span>الدعم الفني والخدمات 💬</span>
                      </button>
                    </div>
                  </div>

                  {/* Hero Featured Image / Art */}
                  <div className="w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-3xl bg-slate-900 border-2 border-sky-500/40 p-3 shadow-2xl relative shrink-0 overflow-hidden group">
                    <ProductArt keyword={config.products[0]?.imageKeyword || "default"} primaryColor="#0284c7" imageUrl={config.products[0]?.imageUrl} />
                    <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur border border-sky-400/40 text-sky-300 font-mono font-extrabold text-[9px] px-2.5 py-1 rounded-full shadow z-10 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>ابتكار مميز 🔥</span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 bg-slate-950/90 backdrop-blur p-2 rounded-xl border border-slate-800 text-center z-10">
                      <p className="text-[10px] font-bold text-slate-200 truncate">{config.products[0]?.name || "المنتج المميز"}</p>
                      <p className="text-xs font-black text-sky-400">{config.products[0]?.price} {config.currency}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. HIGH-TECH SPECS & FEATURES MATRIX */}
              <section className="max-w-7xl mx-auto px-4">
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { icon: Cpu, title: "معالجات ذكية عالية الأداء", desc: "كفاءة سرعة استجابة فائقة", tag: "AI POWERED" },
                    { icon: ShieldCheck, title: "ضمان رسمي 24 شهراً", desc: "استبدال فوري وصيانة معتمدة", tag: "24M WARRANTY" },
                    { icon: Zap, title: "شحن سريع Turbo 65W", desc: "دعم الشحن الذكي الآمن", tag: "TURBO CHARGE" },
                    { icon: Headphones, title: "عزل ضوضاء فعال ANC", desc: "صوت محيطي نقي بوضوح 360°", tag: "HI-RES AUDIO" }
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-sky-300 hover:shadow-md transition text-right space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center group-hover:bg-sky-500 group-hover:text-white transition duration-300">
                          <item.icon className="w-4 h-4" />
                        </div>
                        <span className="text-[9px] font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                          {item.tag}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-900 group-hover:text-sky-600 transition">{item.title}</h4>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 3. INTERACTIVE CATEGORIES SHOWCASE GRID */}
              <section className="max-w-7xl mx-auto px-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-extrabold text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                      CATEGORIES // أقسام المتجر
                    </span>
                    <h3 className="font-black text-base md:text-lg text-slate-900 mt-1">
                      استكشف أقسام وتخصصات الأجهزة الذكية ⚡
                    </h3>
                  </div>
                  <button
                    onClick={() => setStorePage("products")}
                    className="text-xs font-bold text-sky-700 hover:text-sky-900 underline flex items-center gap-1 shrink-0"
                  >
                    <span>كافة الأقسام</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {categories.map((cat, idx) => {
                    const count = cat === "الكل" ? config.products.length : config.products.filter(p => p.category === cat).length;
                    return (
                      <div
                        key={cat}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setStorePage("products");
                        }}
                        className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white border border-slate-700 hover:border-sky-400 hover:shadow-lg transition cursor-pointer group flex flex-col justify-between space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center justify-center font-bold text-sm group-hover:scale-110 transition">
                            {idx === 0 ? "⚡" : idx === 1 ? "🎧" : idx === 2 ? "⌚" : idx === 3 ? "🔌" : "💻"}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                            {count} عنصر
                          </span>
                        </div>
                        <div>
                          <h4 className="font-extrabold text-xs text-white group-hover:text-sky-300 transition">{cat}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">تصفح التشكيلة ➔</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 4. FEATURED PRODUCTS GRID WITH TECH STYLING */}
              <section className="max-w-7xl mx-auto px-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-extrabold text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                      HARDWARE // الأجهزة المختارة
                    </span>
                    <h3 className="font-black text-base md:text-lg text-slate-900 mt-1">
                      الابتكارات والأجهزة الأكثر طلباً 🔥
                    </h3>
                  </div>
                  <button
                    onClick={() => setStorePage("products")}
                    className="text-xs font-bold text-sky-700 hover:text-sky-900 underline flex items-center gap-1 shrink-0"
                  >
                    <span>تصفح الكل ({config.products.length})</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  {config.products.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-slate-200 bg-white flex flex-col justify-between overflow-hidden group hover:border-sky-400 hover:shadow-xl transition duration-300"
                    >
                      <div
                        onClick={() => handleOpenProductProfile(p)}
                        className="aspect-square w-full p-3 sm:p-4 flex items-center justify-center cursor-pointer relative bg-slate-900 group-hover:bg-slate-950 transition overflow-hidden"
                      >
                        <ProductArt keyword={p.imageKeyword} primaryColor="#0284c7" imageUrl={p.imageUrl} />
                        
                        <span className="absolute top-2.5 right-2.5 text-[9px] font-mono font-bold px-2 py-0.5 rounded-md backdrop-blur bg-sky-500/20 text-sky-300 border border-sky-400/40">
                          {p.category}
                        </span>

                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[9px] text-slate-300 font-mono opacity-0 group-hover:opacity-100 transition duration-300 bg-black/70 backdrop-blur px-2 py-1 rounded-lg">
                          <span>⚡ VERIFIED</span>
                          <span className="text-amber-400 font-bold">★ 4.9</span>
                        </div>
                      </div>

                      <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between text-right space-y-2">
                        <div>
                          <h4
                            onClick={() => handleOpenProductProfile(p)}
                            className="font-extrabold text-xs text-slate-900 truncate hover:text-sky-600 cursor-pointer transition"
                          >
                            {p.name}
                          </h4>
                          <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 font-medium">{p.description}</p>
                          
                          <div className="flex flex-wrap items-center gap-1 mt-2 text-[9px]">
                            <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-bold">🛡️ ضمان 24M</span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">⚡ شحن مجاني</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1">
                          <div>
                            <span className="font-black text-sm text-sky-600 block leading-none">
                              {p.price} <span className="text-[10px] text-slate-500">{config.currency}</span>
                            </span>
                          </div>
                          <button
                            onClick={() => addToCart(p)}
                            className="p-2 rounded-xl bg-slate-900 hover:bg-sky-600 text-white font-bold text-xs transition shadow active:scale-95 flex items-center gap-1"
                            title="أضف للسلة"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="text-[10px] hidden sm:inline">إضافة</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 5. TECH ECOSYSTEM & QUALITY STANDARDS BANNER */}
              <section className="max-w-7xl mx-auto px-4">
                <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white border border-slate-800 shadow-2xl space-y-6 text-right relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 relative z-10">
                    <div>
                      <span className="text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 px-3 py-1 rounded-full inline-block">
                        ECOSYSTEM // معايير الاعتماد الفني
                      </span>
                      <h3 className="font-black text-base md:text-xl text-white mt-1">
                        منظومة الجودة والتوافق الفني المعتمدة لأجهزتنا
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-sky-300 bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700 shrink-0 font-bold">
                      <Cpu className="w-4 h-4 text-sky-400" />
                      <span>اختبار أداء بنسبة 100% قبل الشحن</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-2 hover:border-sky-400 transition">
                      <div className="flex items-center justify-between">
                        <Zap className="w-5 h-5 text-amber-400" />
                        <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 rounded">VERIFIED</span>
                      </div>
                      <h4 className="font-extrabold text-xs text-white">شحن فائق ونظام بطاريات أمن</h4>
                      <p className="text-[11px] font-sans text-slate-300 leading-relaxed">دعم معايير الشحن الذكي والمجالات المغناطيسية لحماية عمر البطارية طويلاً.</p>
                    </div>

                    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-2 hover:border-sky-400 transition">
                      <div className="flex items-center justify-between">
                        <Shield className="w-5 h-5 text-sky-400" />
                        <span className="text-[10px] font-mono text-sky-300 font-bold bg-sky-500/20 border border-sky-400/30 px-2 py-0.5 rounded">24 MONTHS</span>
                      </div>
                      <h4 className="font-extrabold text-xs text-white">ضمان استبدال مباشر فورياً</h4>
                      <p className="text-[11px] font-sans text-slate-300 leading-relaxed">تغطية شاملة ضد العيوب المصنعية مع صيانة واستبدال فوري بدون تعقيدات.</p>
                    </div>

                    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 space-y-2 hover:border-sky-400 transition">
                      <div className="flex items-center justify-between">
                        <Box className="w-5 h-5 text-indigo-400" />
                        <span className="text-[10px] font-mono text-indigo-300 font-bold bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 rounded">EXPRESS</span>
                      </div>
                      <h4 className="font-extrabold text-xs text-white">تغليف آمن ومقاوم للظروف</h4>
                      <p className="text-[11px] font-sans text-slate-300 leading-relaxed">تعبئة ممتصة للصدمات ومقاومة للحرارة والرطوبة أثناء رحلة الشحن.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 6. TECH INNOVATION LAB DOSSIER (ABOUT US CARD) */}
              <section className="max-w-7xl mx-auto px-4">
                <div className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-md flex flex-col md:flex-row items-center gap-6 text-right transition hover:border-sky-300">
                  {config.aboutImage && (
                    <div className="w-full md:w-56 h-48 rounded-2xl overflow-hidden shrink-0 border border-slate-200 shadow-inner bg-slate-900">
                      <img src={config.aboutImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div className="space-y-3 flex-1">
                    <span className="text-[10px] font-mono font-bold bg-sky-100 text-sky-800 border border-sky-300 px-3 py-1 rounded-full inline-block">
                      DOSSIER // عن مركز الابتكار والرؤية 🔬
                    </span>
                    <h3 className="font-black text-lg text-slate-900">
                      {config.aboutTitle || `قصتنا ورؤيتنا في ${config.storeName}`}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 font-medium">
                      {config.aboutText || config.slogan}
                    </p>

                    <div className="flex flex-wrap gap-3 pt-2 text-[11px] font-mono text-slate-700 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>+50,000 عميل موثوق</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-sky-500" />
                        <span>100% منتجات أصلية</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span>دعم فني 24/7</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setStorePage("about")}
                      className="text-xs font-extrabold text-sky-700 hover:text-sky-900 underline inline-flex items-center gap-1 pt-1"
                    >
                      <span>استكشاف كافة تفاصيل المركز والتراخيص ➔</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            /* ELEGANT TEMPLATE HOMEPAGE DESIGN */
            <div className="space-y-10 animate-fadeIn pb-12">
              {/* HERO BANNER IMAGE DIRECTLY BELOW HEADER (الصفحة الرئيسية فقط - قالب الأناقة العصرية) */}
              {(config.showHeroBanner !== false) && (
                <section className="relative w-full overflow-hidden shadow-sm group">
                  <div className="relative w-full h-56 sm:h-72 md:h-80 lg:h-[360px] bg-slate-900 overflow-hidden">
                    <img 
                      src={config.heroBannerImage || "https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=1600&q=80"} 
                      alt={config.heroBannerTitle || "Hero Banner"} 
                      className="w-full h-full object-cover object-center transform group-hover:scale-105 transition duration-700 opacity-90"
                      referrerPolicy="no-referrer"
                    />
                    {/* Elegant Dark Gradient Overlay with Text & CTA */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10 flex flex-col justify-end p-6 sm:p-10 md:p-12 text-white text-right">
                      <div className="max-w-7xl mx-auto w-full space-y-2.5 sm:space-y-3.5">
                        {config.heroBannerBadge && (
                          <span 
                            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] sm:text-xs font-black shadow-lg border border-white/20 backdrop-blur-md"
                            style={{ backgroundColor: primaryColor, color: "#ffffff" }}
                          >
                            <span>{config.heroBannerBadge}</span>
                          </span>
                        )}
                        
                        <h2 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight text-white drop-shadow-md">
                          {config.heroBannerTitle || config.storeName}
                        </h2>
                        
                        {(config.heroBannerSubtitle || config.slogan) && (
                          <p className="text-xs sm:text-sm md:text-base text-slate-200 max-w-2xl leading-relaxed font-medium drop-shadow-sm">
                            {config.heroBannerSubtitle || config.slogan}
                          </p>
                        )}

                        {config.heroBannerButtonText && (
                          <div className="pt-2">
                            <button
                              onClick={() => setStorePage("products")}
                              className="px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-black text-white shadow-xl transition hover:scale-105 active:scale-95 flex items-center gap-2 border border-white/20"
                              style={{ backgroundColor: primaryColor }}
                            >
                              <span>{config.heroBannerButtonText}</span>
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Hero Showcase */}
              <section className="relative overflow-hidden py-10 md:py-14 px-4 md:px-6 border-b" style={{ borderColor: "#f2eae1" }}>
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 relative z-10">
                  <div className="text-right space-y-3 sm:space-y-4 flex-1 w-full">
                    <span 
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] sm:text-xs font-black tracking-wide shadow-2xs"
                      style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                    >
                      <span>متجر رسمي وموثّق ✨</span>
                    </span>
                    
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      {config.logoUrl ? (
                        <img 
                          src={config.logoUrl} 
                          alt={config.storeName} 
                          style={{ height: `${Math.min(110, Math.max(36, (config.logoSize || 48) * 1.2))}px` }} 
                          className="w-auto max-w-[280px] object-contain shrink-0 filter drop-shadow-sm" 
                          referrerPolicy="no-referrer" 
                        />
                      ) : config.logoIcon ? (
                        <span 
                          style={{ 
                            width: `${Math.min(80, Math.max(36, (config.logoSize || 48) * 1.1))}px`,
                            height: `${Math.min(80, Math.max(36, (config.logoSize || 48) * 1.1))}px`,
                            borderColor: `${primaryColor}50`,
                            fontSize: `${Math.max(18, (config.logoSize || 48) * 0.55)}px`
                          }}
                          className="rounded-2xl flex items-center justify-center shadow-2xs border shrink-0 bg-white"
                        >
                          {config.logoIcon}
                        </span>
                      ) : null}
                      <h2 className="text-xl sm:text-2xl md:text-4xl font-black leading-tight" style={{ color: secondaryColor }}>
                        مرحباً بكم في {config.storeName}
                      </h2>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 max-w-xl leading-relaxed">
                      {config.slogan}. اكتشف معنا أرقى التشكيلات المبتكرة المنتقاة بعناية فائقة لتلبي ذوقك وتناسب أسلوب حياتك.
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2 w-full sm:w-auto">
                      <button
                        onClick={() => setStorePage("products")}
                        className="px-5 py-3 rounded-xl font-black text-xs shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <span>تصفح الأجهزة والمنتجات 🛍️</span>
                      </button>
                      <button
                        onClick={() => setStorePage("contact")}
                        className="px-4 py-3 rounded-xl font-bold text-xs border transition flex items-center justify-center hover:bg-slate-400/10"
                        style={{ borderColor: "#e5d5c5" }}
                      >
                        <span>الدعم الفني والخدمات 💬</span>
                      </button>
                    </div>
                  </div>

                  {/* Hero Featured Image/Art */}
                  <div className="w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 rounded-3xl flex items-center justify-center p-2 sm:p-3 shadow-xl relative shrink-0 overflow-hidden bg-white"
                       style={{ border: `2px solid ${primaryColor}40` }}>
                    <ProductArt keyword={config.products[0]?.imageKeyword || "default"} primaryColor={primaryColor} imageUrl={config.products[0]?.imageUrl} />
                    <div className="absolute -bottom-2.5 -left-1 text-white font-extrabold text-[9px] sm:text-[10px] px-3 py-1 rounded-full shadow-md z-10 bg-emerald-500">
                      أفضل مبيعاً 🔥
                    </div>
                  </div>
                </div>
              </section>

              {/* Trust Features Bar */}
              <section className="max-w-7xl mx-auto px-4">
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
                  {[
                    { icon: Truck, title: "توصيل آمن وسريع", desc: "شحن مجاني لكافة المناطق" },
                    { icon: ShieldCheck, title: "ضمان رسمـي سنتين", desc: "منتجات معتمدة 100% مع ضمان فوري" },
                    { icon: CreditCard, title: "دفع آمن بالكامل", desc: "مدى، فيزا، والدفع عند الاستلام" },
                    { icon: Phone, title: "دعم فني وتواصل", desc: "فريق متخصص متواجد للإجابة" }
                  ].map((ft, idx) => (
                    <div 
                      key={idx}
                      className="p-3 sm:p-4 rounded-2xl border text-right space-y-1 transition hover:shadow-md"
                      style={{ 
                        backgroundColor: cardBgColor,
                        borderColor: borderColor
                      }}
                    >
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-1.5"
                           style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                        <ft.icon className="w-4 h-4" />
                      </div>
                      <h4 className="font-extrabold text-xs text-slate-900 leading-tight" style={{ color: secondaryColor }}>{ft.title}</h4>
                      <p className="text-[10px] text-slate-500 leading-normal font-medium">{ft.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Featured Products Section */}
              <section className="max-w-7xl mx-auto px-4 space-y-4">
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "#f2eae1" }}>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-1.5" style={{ color: secondaryColor }}>
                      <span>تشكيلة المنتجات المميزة 🔥</span>
                    </h3>
                    <p className="text-[11px] text-slate-500">تصفح أبرز المنتجات الأكثر طلباً لهذا الشهر</p>
                  </div>
                  <button
                    onClick={() => setStorePage("products")}
                    className="text-xs font-bold underline flex items-center gap-1 hover:opacity-80 shrink-0"
                    style={{ color: primaryColor }}
                  >
                    <span>عرض الكل ({config.products.length})</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Grid of items */}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
                  {config.products.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl border flex flex-col justify-between overflow-hidden group transition hover:shadow-md"
                      style={{ 
                        backgroundColor: cardBgColor,
                        borderColor: borderColor
                      }}
                    >
                      <div 
                        onClick={() => handleOpenProductProfile(p)}
                        className="aspect-square w-full p-3 sm:p-4 flex items-center justify-center cursor-pointer relative bg-gradient-to-br from-slate-50 to-amber-50/20 hover:from-amber-50/40 hover:to-orange-50/30 transition"
                      >
                        <ProductArt keyword={p.imageKeyword} primaryColor={primaryColor} imageUrl={p.imageUrl} />
                        <span className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full font-bold backdrop-blur truncate max-w-[85%] bg-black/60 text-white">
                          {p.category}
                        </span>
                      </div>

                      <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between text-right space-y-2">
                        <div>
                          <h4 
                            onClick={() => handleOpenProductProfile(p)}
                            className="font-bold text-xs truncate hover:underline cursor-pointer"
                            style={{ color: secondaryColor }}
                          >
                            {p.name}
                          </h4>
                          <p className="text-[10px] line-clamp-1 mt-0.5 opacity-80" style={{ color: textColor }}>{p.description}</p>
                        </div>

                        <div className="flex items-center justify-between pt-1 gap-1">
                          <span className="font-black text-xs sm:text-sm whitespace-nowrap" style={{ color: primaryColor }}>
                            {p.price} {config.currency}
                          </span>
                          <button
                            onClick={() => addToCart(p)}
                            className="p-1.5 rounded-lg font-bold text-xs transition shrink-0 text-white hover:opacity-90 shadow-xs"
                            style={{ backgroundColor: primaryColor }}
                            title="أضف للسلة"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* About Us Preview Card */}
              <section className="max-w-7xl mx-auto px-4">
                <div 
                  className="p-6 md:p-8 rounded-3xl border flex flex-col md:flex-row items-center gap-6 text-right transition hover:shadow-md"
                  style={{ 
                    backgroundColor: cardBgColor,
                    borderColor: borderColor
                  }}
                >
                  {config.aboutImage && (
                    <div className="w-full md:w-52 h-44 rounded-2xl overflow-hidden shrink-0 border border-slate-200">
                      <img src={config.aboutImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  <div className="space-y-3 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                          style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                      عن متجرنا 📖
                    </span>
                    <h3 className="font-black text-lg" style={{ color: secondaryColor }}>
                      {config.aboutTitle || `قصتنا في ${config.storeName}`}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                      {config.aboutText || config.slogan}
                    </p>
                    <button
                      onClick={() => setStorePage("about")}
                      className="text-xs font-bold underline inline-flex items-center gap-1 pt-1"
                      style={{ color: primaryColor }}
                    >
                      <span>معرفة المزيد عن قصتنا ورؤيتنا ➔</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )
        )}

        {/* 2. PRODUCTS PAGE (المنتجات) */}
        {storePage === "products" && (
          <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-fadeIn pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4"
                 style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}>
              <div className="text-right">
                <h2 className={`font-black text-xl ${!isElegant ? "text-slate-900" : ""}`} style={{ color: isElegant ? secondaryColor : undefined }}>
                  معرض جميع المنتجات المعروضة
                </h2>
                <p className="text-xs text-slate-500">استعرض وتصفح أحدث الخيارات المتوفرة لدينا</p>
              </div>

              {/* Embedded Search Input */}
              <div className="relative w-full md:w-72">
                <input 
                  type="text" 
                  placeholder="ابحث عن منتج بالاسم أو الوصف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pr-9 pl-4 py-2 rounded-xl text-xs border focus:outline-none transition ${
                    !isElegant ? "bg-white border-slate-300 focus:border-sky-500 text-slate-900 shadow-xs" : ""
                  }`}
                  style={{ 
                    backgroundColor: isElegant ? "#ffffff" : undefined,
                    borderColor: isElegant ? "#e5d5c5" : undefined,
                    color: isElegant ? "#1c1917" : undefined
                  }}
                />
                <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute left-3 top-2.5 text-xs text-slate-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filters Pills */}
            {categories.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar max-w-full">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition duration-200 shrink-0 ${
                      selectedCategory === cat ? "shadow-sm" : "hover:bg-slate-200/60"
                    }`}
                    style={{ 
                      backgroundColor: selectedCategory === cat ? (isElegant ? primaryColor : "#0284c7") : (isElegant ? "#f5efe6" : "#f1f5f9"),
                      color: selectedCategory === cat 
                        ? "#ffffff" 
                        : (isElegant ? secondaryColor : "#334155")
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Products Grid */}
            {displayedProducts.length === 0 ? (
              <div className="text-center py-16 bg-white/80 rounded-2xl border border-dashed border-slate-300">
                <ShoppingBag className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-60" />
                <p className="text-sm font-semibold text-slate-500">لا توجد منتجات تطابق خياراتك حالياً</p>
                <button 
                  onClick={() => { setSelectedCategory("الكل"); setSearchQuery(""); }}
                  className="mt-3 text-xs text-sky-600 underline font-bold"
                >
                  إعادة ضبط عوامل التصفية
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
                {displayedProducts.map((p) => (
                  <motion.div
                    key={p.id}
                    layoutId={p.id}
                    className={`rounded-2xl border flex flex-col justify-between overflow-hidden group transition ${
                      !isElegant ? "bg-white border-slate-200 hover:border-sky-400 hover:shadow-lg" : "hover:shadow-md"
                    }`}
                    style={{ 
                      backgroundColor: isElegant ? "#ffffff" : undefined,
                      borderColor: isElegant ? "#f2eae1" : undefined
                    }}
                  >
                    <div 
                      onClick={() => handleOpenProductProfile(p)}
                      className="aspect-square w-full p-3 sm:p-4 flex items-center justify-center cursor-pointer relative bg-slate-50/60 hover:bg-sky-50/40 transition"
                    >
                      <ProductArt keyword={p.imageKeyword} primaryColor={primaryColor} imageUrl={p.imageUrl} />
                      <span className={`absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full font-bold truncate max-w-[85%] ${
                        !isElegant ? "bg-sky-100 text-sky-800 border border-sky-300/80" : "bg-black/60 text-white backdrop-blur"
                      }`}>
                        {p.category}
                      </span>
                    </div>

                    <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between text-right space-y-2.5">
                      <div className="space-y-1">
                        <h4 
                          onClick={() => handleOpenProductProfile(p)}
                          className={`font-extrabold text-xs sm:text-sm line-clamp-1 hover:underline cursor-pointer ${
                            !isElegant ? "text-slate-900 hover:text-sky-700" : ""
                          }`}
                          style={{ color: isElegant ? secondaryColor : undefined }}
                        >
                          {p.name}
                        </h4>
                        <p className="text-[10px] sm:text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1 gap-1">
                        <span className={`font-black text-xs sm:text-sm whitespace-nowrap ${!isElegant ? "text-sky-700" : ""}`} style={{ color: isElegant ? primaryColor : undefined }}>
                          {p.price} {config.currency || "ر.س"}
                        </span>
                        <button
                          onClick={() => addToCart(p)}
                          className={`p-1.5 rounded-lg text-white font-bold text-xs transition flex items-center justify-center shrink-0 hover:opacity-90 ${
                            !isElegant ? "bg-gradient-to-r from-sky-600 to-blue-600 shadow-xs hover:shadow-md" : ""
                          }`}
                          style={{ backgroundColor: isElegant ? primaryColor : undefined }}
                          title="أضف للسلة"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. ABOUT US PAGE (من نحن) */}
        {storePage === "about" && (
          <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fadeIn pb-12 text-right">
            {/* Header Title */}
            <div className="text-center space-y-2 border-b pb-6" style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}>
              <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider inline-block ${
                !isElegant ? "bg-sky-100 text-sky-800 border border-sky-300/80 font-mono" : ""
              }`}
                    style={{ backgroundColor: isElegant ? `${primaryColor}15` : undefined, color: isElegant ? primaryColor : undefined }}>
                {!isElegant ? "DOSSIER // عن مختبر الابتكار 🔬" : "من نحن 📖"}
              </span>
              <h2 className={`text-2xl md:text-3xl font-black ${!isElegant ? "font-mono text-slate-900" : ""}`} style={{ color: isElegant ? secondaryColor : undefined }}>
                {config.aboutTitle || `عن متجر ${config.storeName}`}
              </h2>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                {!isElegant ? "تعرف على معايير الجودة والتطوير التكنولوجي وسلسلة التوريد المعتمدة لدينا." : "تعرف على قصتنا وقيمنا ورؤيتنا المستقبلية في عالم التجارة والابتكار."}
              </p>
            </div>

            {/* Main Content & Image */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {config.aboutImage && (
                <div className={`rounded-3xl overflow-hidden border shadow-sm aspect-4/3 ${
                  !isElegant ? "bg-white border-sky-300" : "bg-slate-100"
                }`}
                     style={{ borderColor: isElegant ? "#e5d5c5" : undefined }}>
                  <img src={config.aboutImage} alt="عن المتجر" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className={`font-extrabold text-base flex items-center gap-2 ${!isElegant ? "font-mono text-sky-800" : ""}`} style={{ color: isElegant ? primaryColor : undefined }}>
                    <span>{!isElegant ? "⚡" : "✨"}</span>
                    <span>{!isElegant ? "شغف الابتكار والتميز التكنولوجي" : "قصة التأسيس والشغف"}</span>
                  </h3>
                  <p className={`text-xs md:text-sm leading-relaxed p-4 rounded-2xl border ${
                    !isElegant ? "bg-white border-slate-200 text-slate-700 shadow-xs" : "bg-slate-400/5 border-slate-300/10 text-slate-600"
                  }`}>
                    {config.aboutText || config.slogan}
                  </p>
                </div>

                {config.aboutVision && (
                  <div className="space-y-2 pt-2">
                    <h3 className={`font-extrabold text-base flex items-center gap-2 ${!isElegant ? "font-mono text-sky-800" : ""}`} style={{ color: isElegant ? primaryColor : undefined }}>
                      <span>🎯</span>
                      <span>{!isElegant ? "رؤيتنا التقنية المستقبلية" : "رؤيتنا ورسالتنا"}</span>
                    </h3>
                    <p className={`text-xs leading-relaxed p-4 rounded-2xl border ${
                      !isElegant ? "bg-white border-slate-200 text-slate-700 shadow-xs" : "bg-slate-400/5 border-slate-300/10 text-slate-600"
                    }`}>
                      {config.aboutVision}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Core Values */}
            <div className="space-y-4 pt-4">
              <h3 className={`font-extrabold text-base text-center ${!isElegant ? "font-mono text-slate-900" : ""}`} style={{ color: isElegant ? secondaryColor : undefined }}>
                {!isElegant ? "ركائز منظومتنا التقنية" : "قيمنا وركائزنا الأساسية"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: Cpu, title: !isElegant ? "اختبارات جودة العتاد" : "الجودة والأصالة", desc: !isElegant ? "تخضع جميع القطع لفحوصات دقيقة لضمان أعلى مستويات الأداء." : "نلتزم بأعلى معايير الدقة والاتقان في كافة المنتجات والخيارات المعروضة." },
                  { icon: ShieldCheck, title: !isElegant ? "ضمان رسمي مشفر" : "ثقة العملاء", desc: !isElegant ? "سلسلة توريد موثوقة وضمان سنتين حقيقي لكافة الأجهزة والقطع." : "رضاكم وراحتكم هي غايتنا الأولى عبر خدمات دعم متكاملة ومستمرة." },
                  { icon: Zap, title: !isElegant ? "توصيل لوجستي آلي" : "السرعة والسهولة", desc: !isElegant ? "معالجة فورية للطلبات وتتبع لمسار الشحنة حتى باب المنزل." : "تجربة تسوق سلسة من الطلب بنقرة واحدة حتى التوصيل السريع لكرت المشتريات." }
                ].map((val, idx) => (
                  <div 
                    key={idx}
                    className={`p-5 rounded-2xl border text-center space-y-2 transition ${
                      !isElegant ? "bg-white border-slate-200 hover:border-sky-300 hover:shadow-sm" : "bg-slate-400/5"
                    }`}
                    style={{ borderColor: isElegant ? "#f2eae1" : undefined }}
                  >
                    <div className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center ${
                      !isElegant ? "bg-sky-50 text-sky-600 border border-sky-200" : ""
                    }`}
                         style={{ backgroundColor: isElegant ? `${primaryColor}20` : undefined, color: isElegant ? primaryColor : undefined }}>
                      <val.icon className="w-5 h-5" />
                    </div>
                    <h4 className={`font-bold text-xs ${!isElegant ? "font-mono text-slate-900" : ""}`} style={{ color: isElegant ? secondaryColor : undefined }}>{val.title}</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{val.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Cyber Stats Counter Bar */}
            {!isElegant && (
              <div className="p-6 rounded-3xl bg-slate-900 border border-sky-500/30 grid grid-cols-3 gap-4 text-center font-mono text-white shadow-md">
                <div>
                  <div className="text-xl md:text-2xl font-black text-sky-400">+50,000</div>
                  <div className="text-[10px] text-slate-300 mt-1">جهاز مفعل ومسلم 📦</div>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-emerald-400">99.9%</div>
                  <div className="text-[10px] text-slate-300 mt-1">دقة الشحنات والالتزام 🎯</div>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-black text-indigo-300">24 شهر</div>
                  <div className="text-[10px] text-slate-300 mt-1">ضمان معتمد شاملاً 🛡️</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. CONTACT US PAGE (تواصل معنا) */}
        {storePage === "contact" && (() => {
          const phone = canonicalContactTarget(config.phone);
          const whatsapp = canonicalContactTarget(config.whatsapp);
          const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email?.trim() ?? "") ? config.email?.trim() : null;
          const address = config.address?.trim() || null;
          const hours = config.workingHours?.trim() || null;
          const hasDirectContact = Boolean(phone || whatsapp || email || address || hours);
          return (
            <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 text-right animate-fadeIn">
              <header className="space-y-2 text-center">
                <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black text-sky-800">التواصل مع المتجر</span>
                <h2 className="text-2xl font-black text-slate-900">اختر وسيلة التواصل المتاحة</h2>
                <p className="text-xs text-slate-500">تعرض هذه الصفحة البيانات التي حفظها المتجر فقط، ولا تستقبل رسائل داخل المنصة.</p>
              </header>
              {hasDirectContact ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {phone && <a href={`tel:${phone}`} className="rounded-2xl border border-slate-200 bg-white p-5"><Phone className="mb-3 h-5 w-5 text-sky-600" /><h3 className="text-xs font-black">اتصال هاتفي</h3><p dir="ltr" className="mt-1 text-sm font-bold text-slate-700">{phone}</p></a>}
                  {whatsapp && <a href={`https://wa.me/${whatsapp.slice(1)}`} target="_blank" rel="noreferrer" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><MessageSquare className="mb-3 h-5 w-5 text-emerald-600" /><h3 className="text-xs font-black">بدء محادثة WhatsApp</h3><p dir="ltr" className="mt-1 text-sm font-bold text-emerald-800">{whatsapp}</p></a>}
                  {email && <a href={`mailto:${email}`} className="rounded-2xl border border-slate-200 bg-white p-5"><Mail className="mb-3 h-5 w-5 text-indigo-600" /><h3 className="text-xs font-black">البريد الإلكتروني</h3><p dir="ltr" className="mt-1 break-all text-sm text-slate-700">{email}</p></a>}
                  {address && <div className="rounded-2xl border border-slate-200 bg-white p-5"><MapPin className="mb-3 h-5 w-5 text-rose-600" /><h3 className="text-xs font-black">العنوان</h3><p className="mt-1 text-sm text-slate-700">{address}</p></div>}
                  {hours && <div className="rounded-2xl border border-slate-200 bg-white p-5"><Clock className="mb-3 h-5 w-5 text-amber-600" /><h3 className="text-xs font-black">ساعات العمل</h3><p className="mt-1 text-sm text-slate-700">{hours}</p></div>}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">لم يضف المتجر وسيلة تواصل مباشرة بعد.</div>
              )}
              {(config.instagram || config.twitter || config.tiktok || config.snapchat) && <div className="flex flex-wrap justify-center gap-2">{([["Instagram", config.instagram], ["X", config.twitter], ["TikTok", config.tiktok], ["Snapchat", config.snapchat]] as const).filter(([, value]) => Boolean(value?.trim())).map(([label, value]) => <span key={label} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold">{label}: @{value}</span>)}</div>}
            </div>
          );
        })()}

        {/* 5. PRODUCT PROFILE PAGE (بروفايل المنتَج الشامل) */}
        {storePage === "product" && (() => {
          const currentProduct = selectedProduct || config.products[0];
          if (!currentProduct) return null;

          const allImages: string[] = [];
          if (currentProduct.imageUrl && currentProduct.imageUrl.trim() !== "") {
            allImages.push(currentProduct.imageUrl);
          }
          if (currentProduct.imageUrls && currentProduct.imageUrls.length > 0) {
            currentProduct.imageUrls.forEach(url => {
              if (url && url.trim() !== "" && !allImages.includes(url)) {
                allImages.push(url);
              }
            });
          }

          const relatedProducts = config.products.filter(p => p.id !== currentProduct.id).slice(0, 4);

          return (
            <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-8 animate-fadeIn pb-16 text-right">
              {/* Top Navigation / Breadcrumbs & Back Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4"
                   style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}>
                <button
                  onClick={() => setStorePage("products")}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition shadow-2xs hover:shadow-xs w-fit ${
                    !isElegant ? "bg-white border-slate-300 text-slate-800 hover:border-sky-400 font-mono" : "bg-white hover:bg-slate-50"
                  }`}
                  style={{ borderColor: isElegant ? "#e5d5c5" : undefined }}
                >
                  <ArrowRight className="w-4 h-4 text-sky-600" />
                  <span>العودة لجميع المنتجات</span>
                </button>

                {/* Breadcrumbs */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium overflow-x-auto">
                  <span onClick={() => setStorePage("home")} className="cursor-pointer hover:underline">الرئيسية</span>
                  <ChevronLeft className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span onClick={() => setStorePage("products")} className="cursor-pointer hover:underline">المنتجات</span>
                  <ChevronLeft className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="text-slate-400 truncate">{currentProduct.category}</span>
                  <ChevronLeft className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className={`font-bold truncate ${!isElegant ? "text-sky-900 font-mono" : "text-slate-900"}`}>{currentProduct.name}</span>
                </div>
              </div>

              {/* Main Product Showcase Block (2-column layout) */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                
                {/* Right Column: Gallery & Art (5 cols) */}
                <div className="md:col-span-5 space-y-4">
                  <div className={`aspect-square w-full rounded-3xl p-6 flex items-center justify-center border relative overflow-hidden shadow-sm group ${
                    !isElegant ? "bg-gradient-to-br from-white via-sky-50/60 to-blue-50/40 border-sky-200" : "bg-white"
                  }`}
                       style={{ borderColor: isElegant ? `${primaryColor}40` : undefined }}>
                    
                    {allImages.length > 0 ? (
                      <img 
                        src={allImages[activeImageIndex] || allImages[0]} 
                        alt={currentProduct.name}
                        className="w-full h-full object-cover rounded-2xl transition-all duration-300 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <ProductArt keyword={currentProduct.imageKeyword} primaryColor={primaryColor} imageUrl={currentProduct.imageUrl} />
                    )}

                    {/* Badge */}
                    <span className={`absolute top-4 right-4 text-[10px] px-3 py-1 rounded-full font-bold shadow-2xs ${
                      !isElegant ? "bg-sky-100 text-sky-900 border border-sky-300 font-mono" : "bg-black/60 text-white backdrop-blur"
                    }`}>
                      {!isElegant ? "⚡ ضمان معتمد 24 شهر" : "منتج أصلي 100% ✨"}
                    </span>
                  </div>

                  {/* Thumbnails list if multiple images */}
                  {allImages.length > 1 && (
                    <div className="flex flex-wrap gap-2 justify-center pt-1">
                      {allImages.map((imgUrl, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveImageIndex(idx)}
                          className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                            idx === activeImageIndex 
                              ? "border-sky-600 scale-105 shadow-xs" 
                              : "border-slate-200 opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img src={imgUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Trust Highlights under gallery */}
                  <div className={`p-4 rounded-2xl border space-y-2.5 text-xs ${
                    !isElegant ? "bg-white border-sky-200 text-slate-700 font-mono shadow-2xs" : "bg-slate-400/5 border-slate-200"
                  }`}>
                    <div className="flex items-center gap-2 text-sky-800 font-bold">
                      <Truck className="w-4 h-4 text-sky-600 shrink-0" />
                      <span>توصيل سريع مجاني لجميع مناطق المملكة 🚚</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>ضمان استبدال مباشر سنتين ضد العيوب المصنعية</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <CreditCard className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>دفع آمن ومحمي 100% (مدى، فيزا، والدفع عند الاستلام)</span>
                    </div>
                  </div>
                </div>

                {/* Left Column: Product Specification & Console (7 cols) */}
                <div className="md:col-span-7 space-y-6">
                  
                  {/* Category & Availability Badge */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span 
                      className={`text-xs px-3 py-1 rounded-full font-bold inline-block ${
                        !isElegant ? "bg-sky-100 text-sky-800 border border-sky-300 font-mono" : ""
                      }`}
                      style={{ backgroundColor: isElegant ? `${primaryColor}20` : undefined, color: isElegant ? primaryColor : undefined }}
                    >
                      {currentProduct.category}
                    </span>

                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>متوفر في المخزون (جاهز للشحن الفوري)</span>
                    </span>
                  </div>

                  {/* Product Title */}
                  <div className="space-y-2">
                    <h1 
                      className={`text-xl md:text-2xl font-black leading-tight ${!isElegant ? "text-slate-900 font-mono" : ""}`}
                      style={{ color: isElegant ? secondaryColor : undefined }}
                    >
                      {currentProduct.name}
                    </h1>

                    {/* Rating & Reviews Bar */}
                    <div className="flex items-center gap-3 text-xs text-slate-600 font-semibold pt-1">
                      <div className="flex items-center gap-1 text-amber-500">
                        <span>⭐⭐⭐⭐⭐</span>
                        <span className="font-bold text-slate-900 mr-1">4.9 / 5.0</span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500">(32 تقييم مشتري معتمد)</span>
                      <span className="text-slate-300 hidden sm:inline">•</span>
                      <span className="text-emerald-700 font-mono text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 hidden sm:inline-block">🔥 تم طلب هذا المنتج 140+ مرة</span>
                    </div>
                  </div>

                  {/* Price Tag */}
                  <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
                    !isElegant ? "bg-gradient-to-r from-sky-50 via-white to-blue-50/50 border-sky-200" : "bg-slate-400/5 border-slate-200"
                  }`}>
                    <div>
                      <span className="text-[10px] text-slate-500 block">السعر الإجمالي:</span>
                      <div className={`text-2xl md:text-3xl font-black ${!isElegant ? "text-sky-800 font-mono" : ""}`} style={{ color: isElegant ? primaryColor : undefined }}>
                        {currentProduct.price} {config.currency}
                      </div>
                    </div>

                    <div className="text-left space-y-0.5 text-[11px] text-slate-500">
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full inline-block">شامل الضريبة 15%</span>
                      <p className="text-[10px] text-slate-400">توصيل مجاني لطلبات المتجر</p>
                    </div>
                  </div>

                  {/* Full Description Box */}
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-xs text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-sky-600" />
                      <span>وصف وتفاصيل المنتج الشاملة:</span>
                    </h3>
                    <p className={`text-xs md:text-sm text-slate-700 leading-relaxed p-4 rounded-2xl border ${
                      !isElegant ? "bg-white border-slate-200 shadow-2xs" : "bg-white border-slate-200"
                    }`}>
                      {currentProduct.description}
                    </p>
                  </div>

                  {/* Spec Highlights Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-mono">// الجودة والأصالة</span>
                      <p className="text-xs font-bold text-slate-800">أصلي معتمد 100%</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-mono">// الضمان والخدمة</span>
                      <p className="text-xs font-bold text-slate-800">24 شهراً شاملاً الاستبدال</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-mono">// محتويات العلبة</span>
                      <p className="text-xs font-bold text-slate-800">المنتج + الملحقات والضمان</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-mono">// سرعة الشحن</span>
                      <p className="text-xs font-bold text-slate-800">خلال 24 إلى 48 ساعة</p>
                    </div>
                  </div>

                  {/* Quantity Stepper & Buy Console */}
                  <div className="space-y-4 pt-2 border-t" style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}>
                    
                    {/* Quantity selection row */}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-bold text-slate-700">حدد الكمية المطلوبة:</span>
                      
                      <div className="flex items-center gap-3 border rounded-xl p-1 bg-white shadow-2xs"
                           style={{ borderColor: isElegant ? "#e5d5c5" : "#cbd5e1" }}>
                        <button
                          onClick={() => setProductQty(prev => Math.max(1, prev - 1))}
                          className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-700"
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        <span className="w-8 text-center font-bold text-sm text-slate-900 font-mono">
                          {productQty}
                        </span>

                        <button
                          onClick={() => setProductQty(prev => prev + 1)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 transition text-slate-700"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-xs font-bold text-slate-600">
                        المجموع: <span className="text-sky-700 font-black text-sm font-mono">{currentProduct.price * productQty} {config.currency}</span>
                      </div>
                    </div>

                    {/* Added Success Banner Notification */}
                    {addedSuccess && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-center justify-between animate-fadeIn">
                        <span className="flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>تمت إضافة ({productQty}) قطعة من المنتج إلى السلة بنجاح! 🎉</span>
                        </span>
                        <button 
                          onClick={() => setIsCartDrawerOpen(true)} 
                          className="underline text-emerald-900 hover:text-black shrink-0 text-[11px]"
                        >
                          عرض السلة ➔
                        </button>
                      </div>
                    )}

                    {/* Primary Buttons Row */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                      <button
                        onClick={() => handleAddToCartWithQty(currentProduct, productQty)}
                        className={`flex-1 py-3.5 rounded-xl font-bold text-xs md:text-sm text-white shadow-md transition hover:scale-[1.01] flex items-center justify-center gap-2 ${
                          !isElegant ? "bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 font-mono shadow-sm" : "hover:opacity-90"
                        }`}
                        style={{ backgroundColor: isElegant ? primaryColor : undefined }}
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>أضف إلى السلة 🛒</span>
                      </button>

                      <button
                        onClick={() => {
                          handleAddToCartWithQty(currentProduct, productQty);
                          setIsCartDrawerOpen(false);
                          setStorePage("checkout");
                          const container = document.getElementById("store-preview-scroll-container");
                          if (container) {
                            container.scrollTo({ top: 0, behavior: "smooth" });
                          }
                        }}
                        className={`px-6 py-3.5 rounded-xl border font-bold text-xs md:text-sm transition flex items-center justify-center gap-2 cursor-pointer ${
                          !isElegant ? "border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100 font-mono shadow-2xs" : "bg-stone-900 text-white hover:bg-black"
                        }`}
                      >
                        <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span>شراء مباشر الآن ⚡</span>
                      </button>

                      <button
                        onClick={() => {
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2500);
                        }}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shrink-0 flex items-center justify-center"
                        title="مشاركة المنتج"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>

                    {copiedLink && (
                      <p className="text-[11px] text-sky-700 font-bold text-center animate-fadeIn">
                        ✓ تم نسخ رابط المنتج لمشاركته بنجاح!
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed Specs & Reviews Tabs Section */}
              <div className="pt-8 space-y-4">
                <div className="flex border-b gap-2 text-xs font-bold" style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}>
                  <button
                    onClick={() => setActiveTab("specs")}
                    className={`pb-3 px-4 transition border-b-2 ${
                      activeTab === "specs" 
                        ? (isElegant ? "border-amber-600 text-amber-900" : "border-sky-600 text-sky-800 font-mono") 
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    تفاصيل ومواصفات المنتج 📋
                  </button>

                  <button
                    onClick={() => setActiveTab("shipping")}
                    className={`pb-3 px-4 transition border-b-2 ${
                      activeTab === "shipping" 
                        ? (isElegant ? "border-amber-600 text-amber-900" : "border-sky-600 text-sky-800 font-mono") 
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    سياسة الشحن والضمان 🚚
                  </button>

                  <button
                    onClick={() => setActiveTab("reviews")}
                    className={`pb-3 px-4 transition border-b-2 ${
                      activeTab === "reviews" 
                        ? (isElegant ? "border-amber-600 text-amber-900" : "border-sky-600 text-sky-800 font-mono") 
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    تقييمات العملاء (32) ⭐
                  </button>
                </div>

                <div className="p-6 rounded-2xl bg-white border border-slate-200/90 text-xs text-slate-700 space-y-4 shadow-2xs">
                  {activeTab === "specs" && (
                    <div className="space-y-3 leading-relaxed">
                      <h4 className="font-extrabold text-sm text-slate-900">المعلومات الفنية والمواصفات الكاملة:</h4>
                      <p>{currentProduct.description}</p>
                      <ul className="list-disc list-inside space-y-1.5 text-slate-600 pt-1">
                        <li>منتج تم فحصه واختباره بدقة لضمان أعلى معايير الكفاءة والاستدامة.</li>
                        <li>تغليف فاخر واقٍ ممتص للصدمات لحماية المنتج أثناء مراحل الشحن.</li>
                        <li>دعم متكامل من فريق خدمة العملاء للمساعدة في الاستخدام والدعم الفني.</li>
                      </ul>
                    </div>
                  )}

                  {activeTab === "shipping" && (
                    <div className="space-y-3 leading-relaxed">
                      <h4 className="font-extrabold text-sm text-slate-900">معلومات التوصيل والضمان المعتمد:</h4>
                      <p>• الشحن الفوري متوفر لكافة مناطق ومدن المملكة العربية السعودية ودول الخليج.</p>
                      <p>• يستغرق التوصيل بين 24 إلى 48 ساعة للمدن الرئيسية و3 أيام عمل لجميع المناطق الأخرى.</p>
                      <p>• ضمان معتمد سنتين يشمل الاستبدال المباشر في حال وجود أي عيوب تصنيعية.</p>
                    </div>
                  )}

                  {activeTab === "reviews" && (
                    <div className="space-y-4">
                      <h4 className="font-extrabold text-sm text-slate-900">أحدث تقييمات المشترين الموثقين:</h4>
                      
                      <div className="space-y-3">
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">عبدالله الشمري</span>
                            <span className="text-amber-500">⭐⭐⭐⭐⭐</span>
                          </div>
                          <p className="text-slate-600">منتج رائع جداً وجاء بنفس المواصفات تماماً والتوصيل كان في غضون 24 ساعة!</p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">سارة التميمي</span>
                            <span className="text-amber-500">⭐⭐⭐⭐⭐</span>
                          </div>
                          <p className="text-slate-600">التغليف فخم والجودة ممتازة وسرعة الاستجابة من الدعم تشكرون عليها.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Related Products Showcase */}
              {relatedProducts.length > 0 && (
                <div className="pt-8 space-y-4">
                  <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}>
                    <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                      <span>منتجات أخرى قد تعجبك أيضا 🔥</span>
                    </h3>
                    <button 
                      onClick={() => setStorePage("products")}
                      className="text-xs font-bold text-sky-700 underline"
                    >
                      عرض جميع المنتجات
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {relatedProducts.map(rel => (
                      <div
                        key={rel.id}
                        onClick={() => handleOpenProductProfile(rel)}
                        className="rounded-2xl border bg-white p-3 space-y-2 cursor-pointer hover:shadow-md hover:border-sky-400 transition"
                      >
                        <div className="aspect-square w-full rounded-xl bg-slate-50 p-2 flex items-center justify-center overflow-hidden">
                          <ProductArt keyword={rel.imageKeyword} primaryColor={primaryColor} imageUrl={rel.imageUrl} />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs truncate text-slate-900">{rel.name}</h4>
                          <span className="text-xs font-black text-sky-700 font-mono block mt-0.5">{rel.price} {config.currency}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 6. CHECKOUT PAGE (صفحة إتمام الطلب وتعبئة البيانات والدفع) */}
        {storePage === "checkout" && (() => {
          const customWalletsList = config.customWallets ?? [];

          const activeWallets = (config.enableEWallets === true ? customWalletsList : [])
            .filter((wallet) => wallet.active === true && Boolean(wallet.id.trim() && wallet.name.trim() && wallet.accountNumber.trim() && wallet.accountName?.trim()));

          const bankWallet = config.enableBankTransfer === true
            && Boolean(config.bankName?.trim())
            && Boolean(config.bankAccountName?.trim())
            && Boolean(config.bankIban?.trim() || config.bankAccountNumber?.trim()) ? {
              id: "bank-transfer",
              name: config.bankName!.trim(),
              accountNumber: config.bankIban?.trim() ? `IBAN: ${config.bankIban.trim()}` : config.bankAccountNumber!.trim(),
              accountName: config.bankAccountName!.trim(),
              icon: "💳",
              badge: "تحويل بنكي",
              bgColor: "bg-slate-100 border-slate-300 text-slate-900",
            } : null;

          const WALLETS = [
            ...activeWallets.map((wallet) => ({ ...wallet, selectionKey: `wallet:${wallet.id}`, kind: "wallet" as const })),
            ...(bankWallet ? [{ ...bankWallet, selectionKey: "bank", kind: "bank" as const }] : [])
          ];
          const codAvailable = config.enableCashOnDelivery === true;
          const transferAvailable = WALLETS.length > 0;
          const effectiveWalletId = WALLETS.some((wallet) => wallet.selectionKey === selectedWallet) ? selectedWallet : WALLETS[0]?.selectionKey;

          const handleApplyCoupon = () => {
            const code = couponCode.trim().toUpperCase();
            if (!code) return;

            if (mode === "live") {
              setCouponDiscount(0);
              setCouponApplied(false);
              setCouponMessage("سيتم التحقق من القسيمة وحساب الخصم بدقة على الخادم عند إرسال الطلب.");
              return;
            }

            const allCoupons = config.customCoupons || [];

            const matched = allCoupons.find(c => (c.active !== false) && c.code.trim().toUpperCase() === code);

            if (matched) {
              const disc = previewPercentageDiscount(cartTotal, matched.discountPercent);
              setCouponDiscount(disc);
              setCouponApplied(true);
              setCouponMessage(`✓ تم تطبيق كود الخصم (${matched.code} - خصم ${matched.discountPercent}%) بنجاح! 🎉`);
            } else {
              setCouponDiscount(0);
              setCouponApplied(false);
              setCouponMessage("❌ كود الخصم غير صحيح أو منتهي الصلاحية");
            }
          };

          const previewTotals = calculatePreviewCheckout({
            subtotal: cartTotal,
            discount: couponDiscount,
            shippingFee: Number(config.shippingFee ?? 0),
            freeShippingThreshold: Number(config.freeShippingThreshold ?? 0),
            taxRate: Number(config.taxRate ?? 0),
            paymentFee: paymentMethod === "cod" ? Number(config.cashOnDeliveryFee ?? 0) : 0,
            minimum: Number(config.minOrderAmount ?? 0),
          });
          const shippingCost = previewTotals.shipping;
          const codFee = previewTotals.paymentFee;
          const tax = previewTotals.tax;
          const finalCheckoutTotal = previewTotals.total;

          const handlePlaceOrderSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!checkoutForm.fullName.trim() || !checkoutForm.phone.trim() || !checkoutForm.address.trim() || (config.requireEmail && !checkoutForm.email.trim())) {
              setFormValidationErr("يرجى تعبئة كافة الحقول المطلوبة (الاسم الكامل، رقم الجوال، والعنوان) للمتابعة.");
              return;
            }
            setFormValidationErr("");

            const currentWallet = WALLETS.find(w => w.selectionKey === effectiveWalletId);
            if (!codAvailable && !transferAvailable) {
              setFormValidationErr("لا توجد وسيلة دفع مفعلة لهذا المتجر حالياً.");
              return;
            }
            if (paymentMethod === "wallet" && (!currentWallet || !transferRefNumber.trim())) {
              setFormValidationErr("أدخل رقم مرجع التحويل بعد تنفيذ العملية؛ سيبقى بانتظار تحقق المتجر.");
              return;
            }
            if (paymentMethod === "cod" && !codAvailable) {
              setFormValidationErr("الدفع عند الاستلام غير مفعّل لهذا المتجر. اختر وسيلة تحويل متاحة.");
              return;
            }
            if (mode === "preview" && !previewTotals.minimumMet) {
              setFormValidationErr(`الطلب أقل من الحد الأدنى المحفوظ (${Number(config.minOrderAmount ?? 0)} ${config.currency}).`);
              return;
            }
            if (mode === "live") {
              if (!submitOrder || orderSubmitting) return;
              if ((paymentMethod === "cod" && !codAvailable) || (paymentMethod === "wallet" && !currentWallet)) {
                setFormValidationErr("وسيلة الدفع المحددة غير مفعلة لهذا المتجر. اختر وسيلة متاحة قبل إرسال الطلب.");
                return;
              }
              setOrderSubmitting(true);
              try {
                const payment = paymentMethod === "cod"
                  ? { method: "cod" as const }
                  : currentWallet?.kind === "bank"
                    ? { method: "bank_transfer" as const, reference: transferRefNumber || undefined }
                    : { method: "wallet" as const, channelId: currentWallet?.id, reference: transferRefNumber || undefined };
                const receipt = await submitOrder({
                  lines: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
                  couponCode: couponCode.trim() || undefined,
                  payment,
                  customer: {
                    name: checkoutForm.fullName.trim(),
                    phone: checkoutForm.phone.trim(),
                    email: checkoutForm.email.trim() || undefined,
                    notes: checkoutForm.notes.trim() || undefined,
                  },
                  address: {
                    city: checkoutForm.city.trim(),
                    area: checkoutForm.address.trim(),
                    details: checkoutForm.address.trim(),
                  },
                });
                const minor = (value: number) => value / 100;
                const orderObj = {
                  orderNum: receipt.number,
                  date: new Date(receipt.createdAt).toLocaleString("ar-SA"),
                  customer: { ...checkoutForm },
                  paymentMethod: receipt.paymentState === "due_on_delivery" ? "الدفع عند الاستلام" : "تحويل بانتظار التحقق",
                  walletName: paymentMethod === "wallet" ? currentWallet?.name : null,
                  walletAccount: paymentMethod === "wallet" ? currentWallet?.accountNumber : null,
                  transferRefNumber: paymentMethod === "wallet" ? transferRefNumber : null,
                  items: (receipt.items || []).map((item) => ({
                    product: { name: item.name, price: minor(item.unitPriceMinor) },
                    quantity: item.quantity,
                  })),
                  subtotal: minor(receipt.totals.itemsSubtotalMinor),
                  discount: minor(receipt.totals.discountMinor),
                  shipping: minor(receipt.totals.shippingMinor),
                  tax: minor(receipt.totals.taxMinor),
                  codFee: minor(receipt.totals.paymentFeeMinor),
                  total: minor(receipt.totals.grandTotalMinor),
                  currency: receipt.currencyCode,
                  presentation: receipt.checkoutPresentation,
                };
                setPlacedOrderDetails(orderObj);
                setOrderCompleted(true);
                handleCheckout();
              } catch (error) {
                setFormValidationErr(error instanceof Error ? error.message : "تعذر إرسال الطلب. حاول مرة أخرى.");
              } finally {
                setOrderSubmitting(false);
              }
              return;
            }

            const orderNum = `PREVIEW-${Math.floor(10000 + Math.random() * 90000)}`;

            const orderObj = {
              orderNum,
              date: new Date().toLocaleString("ar-SA"),
              customer: { ...checkoutForm },
              paymentMethod: paymentMethod === "cod" 
                ? `الدفع عند الاستلام / التوصيل 💵 ${codFee > 0 ? `(+${codFee} ${config.currency} رسوم COD)` : ''}`
                : `${currentWallet?.kind === "bank" ? "تحويل بنكي" : "محفظة إلكترونية"} (${currentWallet?.name})`,
              walletName: paymentMethod === "wallet" ? currentWallet?.name : null,
              walletAccount: paymentMethod === "wallet" ? currentWallet?.accountNumber : null,
              transferRefNumber: paymentMethod === "wallet" ? transferRefNumber.trim() : null,
              items: [...cart],
              subtotal: cartTotal,
              discount: couponDiscount,
              shipping: shippingCost,
              tax,
              codFee,
              total: finalCheckoutTotal,
              currency: config.currency || "ر.س",
              presentation: {
                title: config.thankYouTitle?.trim() || "تم استلام طلبك",
                message: config.thankYouMessage?.trim() || "احتفظ برقم الطلب للمتابعة مع المتجر.",
                whatsappTarget: config.enableWhatsAppNotification === true ? preferredContactTarget(config) : null,
              },
            };

            setPlacedOrderDetails(orderObj);
            setOrderCompleted(true);
            handleCheckout();
          };

          const handleCopyWalletNumber = (num: string) => {
            navigator.clipboard.writeText(num);
            setCopiedWalletNum(num);
            setTimeout(() => setCopiedWalletNum(null), 2500);
          };

          const handlePrintInvoice = (order: any) => {
            if (!order) return;
            const invoiceWindow = window.open("", "_blank", "width=800,height=900");
            if (!invoiceWindow) return;
            invoiceWindow.document.open();
            invoiceWindow.document.write(buildPrintableInvoiceHtml(order, config.storeName || "المتجر"));
            invoiceWindow.document.close();
          };

          const getWhatsAppInvoiceUrl = (order: any) => {
            const target = order?.presentation?.whatsappTarget;
            if (!target) return null;
            const items = order.items.map((item: any) => `${item.product.name} × ${item.quantity}`).join("\n");
            const message = `طلب ${order.orderNum}\n${items}\nالإجمالي: ${order.total} ${order.currency}`;
            return `https://wa.me/${target.slice(1)}?text=${encodeURIComponent(message)}`;
          };

          return (
            <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-8 animate-fadeIn pb-16 text-right">
              <header className="space-y-2 text-center">
                <h2 className="text-2xl font-black text-slate-900">{config.checkoutTitle?.trim() || "إتمام الطلب"}</h2>
                {config.checkoutSubtitle?.trim() && <p className="text-sm text-slate-600">{config.checkoutSubtitle}</p>}
                {config.checkoutNotice?.trim() && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">{config.checkoutNotice}</p>}
              </header>
              {/* Checkout Progress Stepper Bar */}
              <div className="flex items-center justify-between border-b pb-4 overflow-x-auto gap-2"
                   style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}>
                <button
                  onClick={() => setStorePage("products")}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs hover:shadow-xs w-fit shrink-0 ${
                    !isElegant ? "bg-white border-slate-300 text-slate-800 hover:border-sky-400 font-mono" : "bg-white hover:bg-slate-50"
                  }`}
                  style={{ borderColor: isElegant ? "#e5d5c5" : undefined }}
                >
                  <ArrowRight className="w-4 h-4 text-sky-600" />
                  <span>متابعة التسوق</span>
                </button>

                {/* Progress Badges */}
                <div className="flex items-center gap-2 sm:gap-3 text-xs font-bold text-slate-600 shrink-0">
                  <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>1. السلة ({totalItems})</span>
                  </div>
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-300" />
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] border ${
                    !orderCompleted ? "bg-sky-500 text-white border-sky-600 font-black shadow-xs" : "bg-emerald-50 text-emerald-600 border-emerald-200"
                  }`}>
                    <FileText className="w-3.5 h-3.5" />
                    <span>2. بيانات الدفع والشحن</span>
                  </div>
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-300" />
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] border ${
                    orderCompleted ? "bg-emerald-600 text-white border-emerald-700 font-black" : "bg-slate-100 text-slate-400 border-slate-200"
                  }`}>
                    <Check className="w-3.5 h-3.5" />
                    <span>3. الفاتورة والتأكيد</span>
                  </div>
                </div>
              </div>

              {/* SUCCESS VIEW / ORDER COMPLETED RECEIPT */}
              {orderCompleted && placedOrderDetails ? (
                <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
                  {/* Top Success Banner */}
                  <div className="p-6 md:p-8 rounded-3xl bg-emerald-900/90 text-white text-center space-y-3 shadow-xl border border-emerald-500/30">
                    <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md animate-bounce">
                      <Check className="w-10 h-10 stroke-[3]" />
                    </div>
                    <h2 className="text-xl md:text-2xl font-black">{placedOrderDetails.presentation.title}</h2>
                    <p className="text-xs md:text-sm text-emerald-100 max-w-lg mx-auto leading-relaxed">{placedOrderDetails.presentation.message}</p>
                    <div className="inline-flex items-center gap-2 bg-emerald-950/80 px-4 py-2 rounded-xl text-xs font-mono text-emerald-300 border border-emerald-600/40">
                      <span>رقم المرجعية المعتمد:</span>
                      <strong className="text-white font-bold text-sm">{placedOrderDetails.orderNum}</strong>
                    </div>
                  </div>

                  {/* Printable Invoice Receipt Card */}
                  <div className={`p-6 md:p-8 rounded-3xl border shadow-lg space-y-6 text-slate-800 ${
                    !isElegant ? "bg-white border-slate-200" : "bg-stone-50"
                  }`}>
                    {/* Invoice Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-200">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-md font-mono">
                          فاتورة طلب إلكترونية 🧾
                        </span>
                        <h3 className="text-lg font-black text-slate-900">{config.storeName}</h3>
                        <p className="text-xs text-slate-500">{placedOrderDetails.date}</p>
                      </div>

                      <div className="text-right sm:text-left space-y-1">
                        <span className="text-xs text-slate-500 block">حالة الطلب:</span>
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          قيد التجهيز والتوصيل ⏳
                        </span>
                      </div>
                    </div>

                    {/* Customer & Shipping Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs leading-relaxed">
                      <div className="space-y-1.5">
                        <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-sky-600" />
                          <span>بيانات العميل والتوصيل:</span>
                        </h4>
                        <p><strong>الاسم:</strong> {placedOrderDetails.customer.fullName}</p>
                        <p><strong>الجوال:</strong> <span className="font-mono">{placedOrderDetails.customer.phone}</span></p>
                        <p><strong>المدينة/المحافظة:</strong> {placedOrderDetails.customer.city}</p>
                        <p><strong>العنوان التفصيلي:</strong> {placedOrderDetails.customer.address}</p>
                        {placedOrderDetails.customer.notes && (
                          <p className="text-slate-500"><strong>ملاحظات:</strong> {placedOrderDetails.customer.notes}</p>
                        )}
                      </div>

                      <div className="space-y-1.5 border-t md:border-t-0 md:border-r md:pr-4 pt-3 md:pt-0 border-slate-200">
                        <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                          <span>طريقة الدفع المحددة:</span>
                        </h4>
                        <p className="font-bold text-slate-800">{placedOrderDetails.paymentMethod}</p>
                        {placedOrderDetails.walletName && (
                          <p><strong>المحفظة المختارة:</strong> {placedOrderDetails.walletName}</p>
                        )}
                        {placedOrderDetails.transferRefNumber && placedOrderDetails.transferRefNumber !== "غير محدد" && (
                          <p className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 w-fit font-mono font-bold">
                            رقم السند/الإشعار: {placedOrderDetails.transferRefNumber}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Ordered Items Table */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-xs text-slate-900">المنتجات المطلوبة:</h4>
                      <div className="divide-y divide-slate-200 border rounded-2xl overflow-hidden text-xs">
                        {placedOrderDetails.items.map((it: any, idx: number) => (
                          <div key={idx} className="p-3 bg-white flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 bg-slate-100 rounded-lg p-1 shrink-0 overflow-hidden border">
                                <ProductArt keyword={it.product.imageKeyword} primaryColor={primaryColor} imageUrl={it.product.imageUrl} />
                              </div>
                              <div>
                                <h5 className="font-bold text-slate-900">{it.product.name}</h5>
                                <span className="text-[11px] text-slate-500">الكمية: {it.quantity} × {it.product.price} {placedOrderDetails.currency}</span>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-slate-900">
                              {(parseFloat(it.product.price) * it.quantity).toLocaleString()} {placedOrderDetails.currency}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Total Summary */}
                    <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2 text-xs font-mono">
                      <div className="flex justify-between text-slate-300">
                        <span>المجموع الفرعي:</span>
                        <span>{placedOrderDetails.subtotal} {placedOrderDetails.currency}</span>
                      </div>
                      {placedOrderDetails.discount > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>الخصم المطبق:</span>
                          <span>- {placedOrderDetails.discount} {placedOrderDetails.currency}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-300">
                        <span>رسوم الشحن:</span>
                        <span className="text-emerald-400 font-bold">
                          {placedOrderDetails.shipping === 0 ? "مجاني 🚚" : `${placedOrderDetails.shipping} ${placedOrderDetails.currency}`}
                        </span>
                      </div>
                      {placedOrderDetails.tax > 0 && (
                        <div className="flex justify-between text-slate-300">
                          <span>الضريبة:</span>
                          <span>+ {placedOrderDetails.tax} {placedOrderDetails.currency}</span>
                        </div>
                      )}
                      {placedOrderDetails.codFee > 0 && (
                        <div className="flex justify-between text-slate-300">
                          <span>رسوم الدفع عند الاستلام:</span>
                          <span>+ {placedOrderDetails.codFee} {placedOrderDetails.currency}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-700">
                        <span>الإجمالي النهائي المستحق:</span>
                        <span className="text-sky-400 text-base">{placedOrderDetails.total} {placedOrderDetails.currency}</span>
                      </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                      {getWhatsAppInvoiceUrl(placedOrderDetails) && <a
                        href={getWhatsAppInvoiceUrl(placedOrderDetails)!}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
                      >
                        <MessageSquare className="w-4 h-4 fill-white" />
                        <span>مشاركة تفاصيل الفاتورة عبر WhatsApp</span>
                      </a>}

                      <button
                        onClick={() => handlePrintInvoice(placedOrderDetails)}
                        className="w-full sm:w-auto py-3 px-4 min-h-[44px] rounded-xl border border-slate-300 hover:bg-slate-100 active:scale-95 text-slate-800 font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer touch-manipulation shadow-2xs"
                      >
                        <Printer className="w-4 h-4 text-sky-600" />
                        <span>طباعة الفاتورة 🖨️</span>
                      </button>

                      <button
                        onClick={() => {
                          setOrderCompleted(false);
                          setPlacedOrderDetails(null);
                          setStorePage("products");
                        }}
                        className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>طلب جديد 🛒</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : cart.length === 0 ? (
                /* EMPTY CART CHECKOUT WARNING */
                <div className="p-8 md:p-12 text-center rounded-3xl border bg-white space-y-4 max-w-lg mx-auto shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mx-auto text-sky-600">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800">السلة فارغة حالياً!</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    يرجى إضافة بعض المنتجات إلى سلة المشتريات أولاً للتمكن من تعبئة البيانات واختيار طريقة الدفع.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStorePage("products")}
                      className="py-3 px-5 rounded-xl text-white font-bold text-xs bg-slate-900 hover:bg-slate-800 shadow-md transition inline-flex items-center gap-2 w-full sm:w-auto justify-center cursor-pointer"
                    >
                      <span>استعراض معرض المنتجات 🛍️</span>
                    </button>

                  </div>
                </div>
              ) : (
                /* ACTIVE CHECKOUT FORM & PAYMENT SELECTION */
                <form onSubmit={handlePlaceOrderSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* RIGHT / MAIN COLUMN: Form & Payment (7 cols) */}
                  <div className="lg:col-span-7 space-y-6">
                    
                    {/* SECTION 1: Customer & Delivery Info */}
                    <div className={`p-5 md:p-6 rounded-3xl border space-y-4 shadow-sm ${
                      !isElegant ? "bg-white border-slate-200" : "bg-white border-amber-200/80"
                    }`}>
                      <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}>
                        <div className="w-8 h-8 rounded-xl bg-sky-500 text-white font-bold flex items-center justify-center text-xs shadow-2xs">1</div>
                        <div>
                          <h3 className="font-black text-sm text-slate-900">بيانات المشتري وعنوان التوصيل</h3>
                          <p className="text-[11px] text-slate-500">أدخل معلومات التواصل الدقيقة لتسهيل وصول الشحنة لك بسرعة.</p>
                        </div>
                      </div>

                      {formValidationErr && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                          <span>⚠️</span>
                          <span>{formValidationErr}</span>
                        </div>
                      )}

                      <div className="space-y-3.5">
                        {/* Full Name */}
                        <div className="space-y-1">
                          <label className="block text-xs font-extrabold text-slate-700">
                            الاسم الكامل الثلاثي <span className="text-rose-500">*</span>
                          </label>
                          <input 
                            type="text"
                            required
                            placeholder="مثال: عبدالله محمد الشمري"
                            value={checkoutForm.fullName}
                            onChange={(e) => setCheckoutForm({ ...checkoutForm, fullName: e.target.value })}
                            className="w-full border rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/80 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                          />
                        </div>

                        {/* Phone Number */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-xs font-extrabold text-slate-700">
                              رقم الجوال / الواتساب <span className="text-rose-500">*</span>
                            </label>
                            <input 
                              type="tel"
                              required
                              placeholder="0500000000 أو 770000000"
                              value={checkoutForm.phone}
                              onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                              className="w-full border rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 bg-slate-50/80 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                            />
                          </div>

                          {/* City / Governorate */}
                          <div className="space-y-1">
                            <label className="block text-xs font-extrabold text-slate-700">
                              المحافظة / المدينة <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={checkoutForm.city}
                              onChange={(e) => setCheckoutForm({ ...checkoutForm, city: e.target.value })}
                              className="w-full border rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/80 focus:bg-white focus:border-sky-500 focus:outline-none transition cursor-pointer"
                            >
                              <option value="صنعاء">صنعاء</option>
                              <option value="عدن">عدن</option>
                              <option value="تعز">تعز</option>
                              <option value="حضرموت (المكلا/سيئون)">حضرموت (المكلا/سيئون)</option>
                              <option value="إب">إب</option>
                              <option value="الحديدية">الحديدة</option>
                              <option value="المهرة">المهرة</option>
                              <option value="ذمار">ذمار</option>
                              <option value="الرياض">الرياض</option>
                              <option value="جدة">جدة</option>
                              <option value="مكة المكرمة">مكة المكرمة</option>
                              <option value="الدمام / الخبر">الدمام / الخبر</option>
                              <option value="مدينة أخرى">مدينة أخرى...</option>
                            </select>
                          </div>
                        </div>

                        {config.requireEmail && (
                          <div className="space-y-1">
                            <label className="block text-xs font-extrabold text-slate-700">
                              البريد الإلكتروني <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="email"
                              required
                              value={checkoutForm.email}
                              onChange={(e) => setCheckoutForm({ ...checkoutForm, email: e.target.value })}
                              className="w-full border rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/80 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                            />
                          </div>
                        )}

                        {/* Detailed Address */}
                        <div className="space-y-1">
                          <label className="block text-xs font-extrabold text-slate-700">
                            عنوان التسليم التفصيلي <span className="text-rose-500">*</span>
                          </label>
                          <input 
                            type="text"
                            required
                            placeholder="اسم الشارع، الحي، المعلم الشهير القريب..."
                            value={checkoutForm.address}
                            onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })}
                            className="w-full border rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-slate-50/80 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                          />
                        </div>

                        {/* Delivery Notes */}
                        {config.enableCustomerNotes !== false && (
                        <div className="space-y-1">
                          <label className="block text-xs font-extrabold text-slate-700">
                            ملاحظات اختيارية لمندوب التوصيل
                          </label>
                          <input 
                            type="text"
                            placeholder="مثال: يرجى الاتصال قبل الوصول بـ 15 دقيقة..."
                            value={checkoutForm.notes}
                            onChange={(e) => setCheckoutForm({ ...checkoutForm, notes: e.target.value })}
                            className="w-full border rounded-xl px-3.5 py-2.5 text-xs text-slate-900 bg-slate-50/80 focus:bg-white focus:border-sky-500 focus:outline-none transition"
                          />
                        </div>
                        )}
                      </div>
                    </div>

                    {/* SECTION 2: Payment Method Selection */}
                    <div className={`p-5 md:p-6 rounded-3xl border space-y-4 shadow-sm ${
                      !isElegant ? "bg-white border-slate-200" : "bg-white border-amber-200/80"
                    }`}>
                      <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}>
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">2</div>
                        <div>
                          <h3 className="font-black text-sm text-slate-900">طريقة الدفع المناسبة</h3>
                          <p className="text-[11px] text-slate-500">اختر إما الدفع نقداً عند التوصيل أو عبر إحدى المحافظ الإلكترونية المتاحة.</p>
                        </div>
                      </div>

                      {/* Payment Mode Options (COD vs WALLET) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        
                        {/* Option A: Cash on Delivery */}
                        {codAvailable && (<div
                          onClick={() => setPaymentMethod("cod")}
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition relative space-y-2 ${
                            paymentMethod === "cod"
                              ? "border-sky-500 bg-sky-50/50 ring-2 ring-sky-400/30"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl">💵</span>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              موصى به 🔥
                            </span>
                          </div>
                          <div>
                            <h4 className="font-black text-xs text-slate-900">الدفع عند التوصيل / الاستلام</h4>
                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                              تسليم مبلغ الشحنة نقداً لمندوب التوصيل عند استلام واستكشاف منتجاتك بنفسك.
                            </p>
                          </div>
                        </div>)}

                        {/* Option B: E-Wallets */}
                        {transferAvailable && (<div
                          onClick={() => setPaymentMethod("wallet")}
                          className={`p-4 rounded-2xl border-2 cursor-pointer transition relative space-y-2 ${
                            paymentMethod === "wallet"
                              ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-400/30"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl">📱</span>
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                              محافظ رقمية ⚡
                            </span>
                          </div>
                          <div>
                            <h4 className="font-black text-xs text-slate-900">الدفع عبر المحافظ الإلكترونية</h4>
                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">استخدم فقط الحساب أو المحفظة التي فعّلها هذا المتجر.</p>
                          </div>
                        </div>)}
                      </div>

                      {!codAvailable && !transferAvailable && (
                        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-900">
                          لا توجد وسيلة دفع مفعلة لهذا المتجر حالياً. تواصل مع المتجر قبل إرسال الطلب.
                        </div>
                      )}

                      {/* E-WALLET SELECTION SUB-PANEL */}
                      {paymentMethod === "wallet" && transferAvailable && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 animate-fadeIn">
                          <div className="space-y-1">
                            <h4 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                              <Wallet className="w-4 h-4 text-emerald-600" />
                              <span>اختر المحفظة الإلكترونية لإرسال الحوالة:</span>
                            </h4>
                            <p className="text-[11px] text-slate-500">قم بتحويل المبلغ الموضح في ملخص الطلب إلى إحدى المحافظ التالية:</p>
                          </div>

                          {/* Wallets Selector Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {WALLETS.map((w) => {
                              const isSelected = effectiveWalletId === w.selectionKey;
                              return (
                                <div
                                  key={w.selectionKey}
                                  onClick={() => setSelectedWallet(w.selectionKey)}
                                  className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                                    isSelected 
                                      ? "border-emerald-600 bg-white shadow-xs ring-1 ring-emerald-500" 
                                      : "border-slate-200 bg-white/80 hover:bg-white"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{w.icon}</span>
                                    <div>
                                      <h5 className="font-bold text-xs text-slate-900">{w.name}</h5>
                                      <span className="text-[10px] text-slate-500 block font-mono">{w.accountNumber}</span>
                                    </div>
                                  </div>
                                  {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                                </div>
                              );
                            })}
                          </div>

                          {/* Selected Wallet Information Box */}
                          {(() => {
                            const activeW = WALLETS.find(w => w.selectionKey === effectiveWalletId) || WALLETS[0];
                            if (!activeW) return null;
                            return (
                              <div className={`p-4 rounded-xl border space-y-3 ${activeW.bgColor}`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black">{activeW.name}</span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/80 border border-current">
                                    {activeW.badge}
                                  </span>
                                </div>

                                <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2">
                                  <div>
                                    <span className="text-[10px] text-slate-500 block">رقم الحساب / المحفظة المعتمد:</span>
                                    <strong className="text-sm font-mono text-slate-900 select-all">{activeW.accountNumber}</strong>
                                    <span className="text-[10px] text-slate-500 block">باسم: {activeW.accountName}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyWalletNumber(activeW.accountNumber)}
                                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center gap-1 hover:bg-slate-800 transition shrink-0 cursor-pointer"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>{copiedWalletNum === activeW.accountNumber ? "تم النسخ ✓" : "نسخ الرقم"}</span>
                                  </button>
                                </div>

                                {/* Transaction Ref / Receipt Number Input */}
                                <div className="space-y-1.5 pt-1">
                                  <label className="block text-xs font-bold text-slate-800">
                                    رقم السند المالي / إشعار الحوالة (بعد التحويل)
                                  </label>
                                  <input 
                                    type="text"
                                    required
                                    maxLength={200}
                                    placeholder="رقم مرجع التحويل أو الإيداع"
                                    value={transferRefNumber}
                                    onChange={(e) => setTransferRefNumber(e.target.value)}
                                    className="w-full border rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900 bg-white border-slate-300 focus:outline-none focus:border-emerald-600"
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* LEFT / SIDEBAR COLUMN: Order Summary & Confirmation (5 cols) */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className={`p-5 md:p-6 rounded-3xl border space-y-5 sticky top-20 shadow-md ${
                      !isElegant ? "bg-white border-slate-200" : "bg-white border-amber-200/80"
                    }`}>
                      <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}>
                        <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-sky-600" />
                          <span>ملخص طلب المشتريات</span>
                        </h3>
                        <span className="text-xs font-bold text-slate-500">{totalItems} قطع</span>
                      </div>

                      {/* Items List */}
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 pr-1 space-y-2">
                        {cart.map((item) => (
                          <div key={item.product.id} className="pt-2 flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 bg-slate-100 rounded-lg p-1 shrink-0 overflow-hidden border border-slate-200">
                                <ProductArt keyword={item.product.imageKeyword} primaryColor={primaryColor} imageUrl={item.product.imageUrl} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-slate-900 truncate">{item.product.name}</h4>
                                <span className="text-[11px] text-slate-500">العدد: {item.quantity} × {item.product.price} {config.currency}</span>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-slate-900 shrink-0">
                              {(parseFloat(String(item.product.price)) * item.quantity).toLocaleString()} {config.currency}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Coupon Discount Code Box */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <label className="block text-[11px] font-bold text-slate-600">كود الخصم (كوبون):</label>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="أدخل كود الخصم"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            className="flex-1 border rounded-xl px-3 py-1.5 text-xs uppercase font-mono font-bold text-slate-800 bg-slate-50 focus:bg-white focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleApplyCoupon}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
                          >
                            تطبيق
                          </button>
                        </div>
                        {couponMessage && (
                          <p className={`text-[10px] font-bold ${couponApplied ? "text-emerald-600" : "text-rose-600"}`}>
                            {couponMessage}
                          </p>
                        )}
                      </div>

                      {/* Financial Breakdown */}
                      <div className="space-y-2 pt-3 border-t border-slate-200 text-xs font-bold">
                        {mode === "live" && (
                          <p className="rounded-lg border border-sky-200 bg-sky-50 p-2 text-[11px] text-sky-800">
                            الأرقام النهائية، الخصم، الضريبة والشحن يحسبها الخادم وتظهر في الإيصال بعد الإرسال.
                          </p>
                        )}
                        {mode !== "live" && <>
                        <div className="flex justify-between text-slate-600">
                          <span>المجموع الفرعي:</span>
                          <span className="font-mono">{cartTotal} {config.currency}</span>
                        </div>

                        {tax > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>الضريبة:</span>
                            <span className="font-mono">+ {tax.toFixed(2)} {config.currency}</span>
                          </div>
                        )}

                        {couponDiscount > 0 && (
                          <div className="flex justify-between text-emerald-600">
                            <span>خصم الكوبون:</span>
                            <span className="font-mono">- {couponDiscount} {config.currency}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-slate-600">
                          <span>رسوم الشحن والتوصيل:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {shippingCost === 0 ? "مجاني 🚚" : `${shippingCost} ${config.currency}`}
                          </span>
                        </div>

                        {paymentMethod === "cod" && codFee > 0 && (
                          <div className="flex justify-between text-amber-700">
                            <span>رسوم الدفع عند الاستلام (COD):</span>
                            <span className="font-mono">+{codFee} {config.currency}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                          <span>المجموع الكلي النهائي:</span>
                          <span className="text-sky-700 text-base font-mono">
                            {finalCheckoutTotal.toFixed(2)} {config.currency}
                          </span>
                        </div>
                        </>}
                      </div>

                      {/* Submit Order Button */}
                      <button
                        type="submit"
                        disabled={orderSubmitting || (!codAvailable && !transferAvailable)}
                        className={`w-full py-4 rounded-2xl text-white font-black text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] ${
                          !isElegant ? "bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 font-mono shadow-sky-600/20" : "hover:opacity-90"
                        }`}
                        style={{ backgroundColor: isElegant ? primaryColor : undefined }}
                      >
                        <span>{orderSubmitting ? "جارٍ تثبيت السعر وحجز المخزون..." : mode === "live" ? "تأكيد الطلب بالسعر الخادمي" : "معاينة إرسال الطلب"}</span>
                        <Check className="w-5 h-5 stroke-[3]" />
                      </button>

                      <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        <span>تُعالج بيانات الطلب وفق ضوابط حماية النظام</span>
                      </p>
                    </div>
                  </div>
                </form>
              )}
            </div>
          );
        })()}

      </div>

      {/* Informative footer */}
      <footer className="pt-6 border-t border-slate-300/10 text-center space-y-2 text-slate-500 text-[11px] pb-12 bg-slate-400/5">
        <p>© {new Date().getFullYear()} {config.storeName} - جميع الحقوق محفوظة.</p>
        <p className="text-[10px] text-slate-400">متجر إلكتروني متكامل ومدعوم من منصة مبتكر الذكية لإنشاء المتاجر.</p>
      </footer>

      {/* ----------------- SHOPPING CART DRAWER ----------------- */}
      <AnimatePresence>
        {isCartDrawerOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs">
            {/* Click outside to close */}
            <div className="absolute inset-0" onClick={() => setIsCartDrawerOpen(false)} />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`w-full max-w-md h-full flex flex-col justify-between shadow-2xl relative z-10 text-right ${
                !isElegant ? "bg-white border-r border-slate-200 text-slate-900 font-mono" : ""
              }`}
              style={{ 
                backgroundColor: isElegant ? "#fdfbf7" : undefined,
                color: isElegant ? "#1c1917" : undefined
              }}
            >
              {/* Drawer Header */}
              <div 
                className="p-5 flex items-center justify-between border-b"
                style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-sky-600" />
                  <span className={`font-extrabold text-base ${!isElegant ? "text-slate-900" : ""}`} style={{ color: isElegant ? secondaryColor : undefined }}>
                    {!isElegant ? `سلة المشتريات [CART: ${totalItems}]` : `سلة التسوق (${totalItems} قطع)`}
                  </span>
                </div>
                <button 
                  onClick={() => setIsCartDrawerOpen(false)}
                  className={`p-1.5 rounded-full hover:bg-slate-200/60 ${!isElegant ? "text-slate-600 hover:text-sky-600 hover:bg-sky-50" : ""}`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body - Items list */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {hasOrdered ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 border border-emerald-300 rounded-full flex items-center justify-center shadow-sm">
                      <Check className="w-8 h-8" />
                    </div>
                    <h3 className="font-extrabold text-xl text-emerald-700">ORDER_TRANSMITTED // تم إرسال الطلب بنجاح! 🎉</h3>
                    <p className="text-slate-600 text-xs max-w-xs leading-relaxed">
                      شكراً لتجربتك لمتجرنا! لقد تم إرسال الطلب الوهمي وتفريغ السلة لمحاكاة الشراء الحقيقي لمتجرك الجديد بنجاح.
                    </p>
                  </div>
                ) : cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-70">
                    <ShoppingBag className="w-16 h-16 text-slate-400" />
                    <h4 className="font-bold text-sm text-slate-700">{!isElegant ? "CART_EMPTY // السلة فارغة" : "سلتك فارغة حالياً"}</h4>
                    <p className="text-xs text-slate-500 max-w-xs">أضف المنتجات من المعرض لتجربة دورة الشراء الكاملة والتحقق من حساب التكلفة.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {cart.map((item) => (
                      <div 
                        key={item.product.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                          !isElegant ? "bg-slate-50 border-slate-200" : ""
                        }`}
                        style={{ 
                          backgroundColor: isElegant ? "#ffffff" : undefined,
                          borderColor: isElegant ? "#f2eae1" : undefined
                        }}
                      >
                        {/* Artwork */}
                        <div className="w-12 h-12 bg-white p-1 rounded-lg border shrink-0">
                          <ProductArt keyword={item.product.imageKeyword} primaryColor={primaryColor} imageUrl={item.product.imageUrl} />
                        </div>

                        {/* Name and Price */}
                        <div className="flex-1 min-w-0 text-right">
                          <h4 className={`font-bold text-xs truncate ${!isElegant ? "text-slate-900" : ""}`} style={{ color: isElegant ? secondaryColor : undefined }}>
                            {item.product.name}
                          </h4>
                          <span className={`text-[11px] font-bold ${!isElegant ? "text-sky-700" : ""}`} style={{ color: isElegant ? primaryColor : undefined }}>
                            {item.product.price} {config.currency}
                          </span>
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-2 border rounded-lg bg-white shrink-0"
                             style={{ borderColor: isElegant ? "#f2eae1" : "#cbd5e1" }}>
                          <button 
                            onClick={() => updateQuantity(item.product.id, 1)}
                            aria-label={`زيادة كمية ${item.product.name}`}
                            className="p-1 hover:text-sky-600"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold w-4 text-center text-slate-800">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.product.id, -1)}
                            aria-label={`تقليل كمية ${item.product.name}`}
                            className="p-1 hover:text-rose-600"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              {!hasOrdered && cart.length > 0 && (
                <div 
                  className="p-5 border-t space-y-4"
                  style={{ borderColor: isElegant ? "#f2eae1" : "#e2e8f0" }}
                >
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span className="text-slate-600">المجموع الفرعي:</span>
                    <span className={`text-lg ${!isElegant ? "text-sky-700 font-mono font-black" : ""}`} style={{ color: isElegant ? primaryColor : undefined }}>
                      {cartTotal} {config.currency}
                    </span>
                  </div>

                  <div className={`space-y-2 text-xs p-3 rounded-xl border ${
                    !isElegant ? "bg-sky-50 border-sky-200 text-sky-900 font-mono" : "bg-slate-400/5 text-slate-500"
                  }`}>
                    <p>* الشحن والضريبة: تظهر قيمهما النهائية في صفحة إتمام الطلب.</p>
                    <p>* الدفع: تظهر فقط الوسائل التي فعّلها المتجر ببيانات مكتملة.</p>
                  </div>

                  <button
                    onClick={() => {
                      setIsCartDrawerOpen(false);
                      setStorePage("checkout");
                      const container = document.getElementById("store-preview-scroll-container");
                      if (container && typeof container.scrollTo === "function") {
                        container.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    className={`w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01] ${
                      !isElegant ? "bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 font-mono shadow-sm" : "hover:opacity-90"
                    }`}
                    style={{ backgroundColor: isElegant ? primaryColor : undefined }}
                  >
                    <span>{!isElegant ? "المتابعة لإتمام الطلب والدفع ➔" : "إتمام الطلب وتعبئة البيانات ➔"}</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Mobile Sticky Bottom Dock Navigation Bar */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-2xl border-t py-1.5 px-3 flex items-center justify-around shadow-2xl touch-manipulation"
        style={{
          backgroundColor: cardBgColor,
          borderColor: borderColor
        }}
      >
        {[
          { id: "home", label: "الرئيسية", icon: Home },
          { id: "products", label: "المنتجات", icon: ShoppingBag },
          { id: "about", label: "عن المتجر", icon: Info },
          { id: "contact", label: "الدعم", icon: Phone }
        ].map((item) => {
          const isActive = storePage === item.id;
          const IconComp = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                setStorePage(item.id as any);
                const container = document.getElementById("store-preview-scroll-container");
                if (container) {
                  container.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-h-[48px] rounded-xl transition text-[10px] font-extrabold cursor-pointer active:scale-90 ${
                isActive
                  ? !isElegant ? "text-sky-600 font-black scale-105" : "text-amber-800 font-black scale-105"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <IconComp className={`w-5 h-5 ${isActive ? (!isElegant ? "text-sky-600" : "text-amber-700") : "text-slate-500"}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setIsCartDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 min-h-[48px] rounded-xl text-slate-500 hover:text-slate-900 text-[10px] font-extrabold relative cursor-pointer active:scale-90"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 text-slate-700" />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -left-1.5 bg-sky-600 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-xs">
                {totalItems}
              </span>
            )}
          </div>
          <span>السلة</span>
        </button>
      </nav>
    </div>
  );
}
