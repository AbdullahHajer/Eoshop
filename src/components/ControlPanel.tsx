import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, Trash2, Sparkles, Check, RefreshCw, Smartphone, Monitor, Info, HelpCircle, Upload,
  Download, FileCode, ArrowDownToLine, Copy, CheckCircle2, FileText, Code, Settings, Share2,
  Edit3, ChevronDown, ChevronUp, Package, Search, Tag, CreditCard, Truck, Percent, ShoppingBag,
  ShieldCheck, DollarSign, Gift, Layers, CheckSquare, AlertTriangle, ArrowRight, Save, ToggleLeft, ToggleRight
} from "lucide-react";
import { StoreConfig, Product, Coupon, EWallet } from "../types";
import { useUiAdapters } from "../adapters/UiAdaptersContext";

interface ControlPanelProps {
  config: StoreConfig;
  handleConfigChange: (key: keyof StoreConfig, value: any) => void;
  handleProductChange: (index: number, key: keyof Product, value: any) => void;
  addEmptyProduct: () => void;
  deleteProduct: (id: string) => void;
  activeTab: "branding" | "design" | "products" | "inventory" | "checkout" | "pages" | "ai" | "export";
  setActiveTab: (tab: "branding" | "design" | "products" | "inventory" | "checkout" | "pages" | "ai" | "export") => void;
  previewDevice: "desktop" | "mobile";
  setPreviewDevice: (device: "desktop" | "mobile") => void;
  onOpenCheckoutPreview?: () => void;
  onOpenDomainModal?: () => void;
}

export default function ControlPanel({
  config,
  handleConfigChange,
  handleProductChange,
  addEmptyProduct,
  deleteProduct,
  activeTab,
  setActiveTab,
  previewDevice,
  setPreviewDevice,
  onOpenCheckoutPreview,
  onOpenDomainModal
}: ControlPanelProps) {
  const { assistant } = useUiAdapters();

  // AI assistant states inside control panel
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [copyOutput, setCopyOutput] = useState<{ slogan?: string; banner?: string; productDesc?: string } | null>(null);

  // Product accordion & search & stock filter states
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState<string>("");
  const [stockFilter, setStockFilter] = useState<"all" | "inStock" | "lowStock" | "outOfStock">("all");
  const [productSort, setProductSort] = useState<"default" | "highStock" | "lowStock" | "highPrice" | "lowPrice">("default");
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const prevProductsCountRef = useRef(config.products.length);

  // Inventory tab states
  const [inventorySearch, setInventorySearch] = useState<string>("");
  const [inventoryFilter, setInventoryFilter] = useState<"all" | "inStock" | "lowStock" | "outOfStock" | "unlimited">("all");
  const [bulkStockQuantity, setBulkStockQuantity] = useState<number>(50);

  // Checkout coupon state
  const [newCouponCode, setNewCouponCode] = useState("");
  const [newCouponDiscount, setNewCouponDiscount] = useState<number>(15);

  // Custom E-Wallet states
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletNumber, setNewWalletNumber] = useState("");
  const [newWalletHolder, setNewWalletHolder] = useState("");
  const [newWalletIcon, setNewWalletIcon] = useState("📱");
  const [newWalletBadge, setNewWalletBadge] = useState("إيداع مباشر ⚡");

  // Wallet Inline Edit state
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [editWalletName, setEditWalletName] = useState("");
  const [editWalletNumber, setEditWalletNumber] = useState("");
  const [editWalletHolder, setEditWalletHolder] = useState("");
  const [editWalletBadge, setEditWalletBadge] = useState("");
  const [editWalletIcon, setEditWalletIcon] = useState("📱");

  useEffect(() => {
    if (config.products.length > prevProductsCountRef.current) {
      if (config.products[0]) {
        setExpandedProductId(config.products[0].id);
      }
    }
    prevProductsCountRef.current = config.products.length;
  }, [config.products]);

  const getProductIconEmoji = (keyword?: string) => {
    switch (keyword) {
      case "perfume": return "🧴";
      case "oud-wood": return "🪵";
      case "incense": return "💨";
      case "home-decor": return "🏺";
      case "headphones": return "🎧";
      case "charger": return "⚡";
      case "smartwatch": return "⌚";
      case "lamp": return "💡";
      case "coffee-cup": return "☕";
      default: return "👜";
    }
  };

  const handleHeroBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          handleConfigChange("heroBannerImage", reader.result);
          handleConfigChange("showHeroBanner", true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          handleConfigChange("logoUrl", reader.result);
          handleConfigChange("logoType", "image");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerCopyWrite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assistantPrompt.trim()) return;

    setIsGeneratingCopy(true);
    try {
      const data = await assistant.generateStoreIdeas(
        `اكتب شعارات وعروض دعائية ومحتوى تسويقي بناءً على هذه الفكرة: "${assistantPrompt}"`,
      );
      
      setCopyOutput({
        slogan: data.slogan,
        banner: data.bannerText,
        productDesc: data.products?.[0]?.description || "وصف تسويقي فاخر يناسب عملائك"
      });
    } catch (err) {
      console.error(err);
      setCopyOutput({
        slogan: "التميز يبدأ من الاختيار الصحيح لهويتك",
        banner: "عروض مذهلة بانتظارك بمناسبة الافتتاح الحصري لعملائنا",
        productDesc: "منتج مصنع بحب وعناية فائقة لتلبية كافة التطلعات والاحتياجات"
      });
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const [copiedConfig, setCopiedConfig] = useState(false);

  // Download Config JSON File
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `store_config_${config.storeName || "my_store"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import Config JSON File
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && typeof parsed === "object") {
            Object.keys(parsed).forEach((key) => {
              handleConfigChange(key as keyof StoreConfig, parsed[key]);
            });
            alert("تم استيراد كافة إعدادات وهوية المتجر بنجاح! 🎉");
          }
        } catch (err) {
          alert("الملف المحمل غير صالح. يرجى التأكد من اختيار ملف store_config.json بصيغة JSON صحيح.");
        }
      };
      reader.readAsText(file);
    }
  };

  // Download Standalone Offline HTML File
  const handleDownloadOfflineHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.storeName || 'متجري الإلكتروني'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Cairo', sans-serif; background-color: #f8fafc; }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen">
  <!-- Header Navbar -->
  <header class="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
    <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-xl text-white font-bold">
          ${config.logoIcon || "🛍️"}
        </div>
        <div>
          <h1 class="font-black text-lg text-slate-900">${config.storeName || "اسم المتجر"}</h1>
          <p class="text-xs text-slate-500 font-medium">${config.slogan || ""}</p>
        </div>
      </div>
      <a href="https://wa.me/${((config as any).whatsappNumber || '966500000000').replace(/\+/g, '')}" target="_blank" class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow">
        💬 تواصل واتساب
      </a>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="bg-slate-900 text-white py-12 px-6 text-center border-b border-slate-800">
    <div class="max-w-3xl mx-auto space-y-3">
      <span class="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/30">
        نسخة معاينة معتمدة أوفلاين ⚡
      </span>
      <h2 class="text-2xl sm:text-4xl font-black">${config.storeName || "أهلاً بك في متجرنا"}</h2>
      <p class="text-slate-300 text-sm sm:text-base leading-relaxed font-medium">${config.slogan || ""}</p>
    </div>
  </section>

  <!-- Products Catalog -->
  <main class="max-w-6xl mx-auto px-6 py-10">
    <h3 class="text-xl font-extrabold text-slate-900 mb-6 flex items-center gap-2">
      <span>🛍️ كتالوج المنتجات المعروضة (${config.products?.length || 0})</span>
    </h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      ${config.products?.map(p => `
        <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div class="space-y-2">
            <div class="w-full h-48 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
              ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}" class="w-full h-full object-cover">` : `<span class="text-4xl">📦</span>`}
            </div>
            <h4 class="font-extrabold text-slate-900 text-base">${p.name}</h4>
            <p class="text-xs text-slate-500 line-clamp-2">${p.description || ''}</p>
          </div>
          <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span class="text-lg font-black text-slate-900">${p.price} <span class="text-xs font-bold text-slate-500">${config.currency || "ر.س"}</span></span>
            <span class="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold">متوفر</span>
          </div>
        </div>
      `).join('')}
    </div>
  </main>

  <!-- Footer -->
  <footer class="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
    <p>جميع الحقوق محفوظة © ${config.storeName || 'المتجر'} - تم الإنشاء بواسطة منصة مبتكر للمتاجر الرقمية</p>
  </footer>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", `${config.storeName || "store"}_offline_preview.html`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyJSONToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 3000);
  };

  return (
    <div className="flex flex-col h-full bg-white min-h-0 overflow-hidden">
      {/* 1. TOP HEADER DEVICES TOGGLE */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
        <h3 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">نمط المعاينة</h3>
        <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200/90 shadow-2xs">
          <button
            onClick={() => setPreviewDevice("desktop")}
            className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition touch-manipulation cursor-pointer active:scale-95 ${
              previewDevice === "desktop" ? "bg-amber-500 text-slate-950 shadow-xs font-black" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>كمبيوتر</span>
          </button>
          <button
            onClick={() => setPreviewDevice("mobile")}
            className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition touch-manipulation cursor-pointer active:scale-95 ${
              previewDevice === "mobile" ? "bg-amber-500 text-slate-950 shadow-xs font-black" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>جوال</span>
          </button>
        </div>
      </div>

      {/* 2. TABBED CONTENTS */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* --- BRANDING TAB --- */}
        {activeTab === "branding" && (
          <div className="space-y-5 animate-fadeIn">
            <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 space-y-1">
              <h4 className="font-bold text-sky-800 text-xs flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                <span>المعلومات الأساسية للهوية</span>
              </h4>
              <p className="text-[11px] text-sky-600 leading-relaxed">
                حدد اسم متجرك والشعار الذي سيرسخ في أذهان زوارك. ستظهر هذه التفاصيل تلقائياً في شريط التنقل والواجهة العريضة للمعاينة.
              </p>
            </div>

            {/* Store Name input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">اسم المتجر الإلكتروني</label>
              <input
                type="text"
                value={config.storeName}
                onChange={(e) => handleConfigChange("storeName", e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none transition"
                placeholder="أدخل اسم متجرك المميز"
              />
            </div>



            {/* Logo Customizer */}
            <div className="space-y-3.5 bg-slate-50/70 p-4.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-slate-800">
                  شعار المتجر (اللوجو الرسمي) 🎨
                </label>
                <span className="text-[10px] text-slate-500 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  مدعوم في القالبين ✨
                </span>
              </div>

              {/* Mode Switcher: Image Logo vs Emoji Icon */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl text-xs font-extrabold">
                <button
                  type="button"
                  onClick={() => handleConfigChange("logoType", "image")}
                  className={`py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    (config.logoType === "image" || (!config.logoType && config.logoUrl))
                      ? "bg-white text-sky-700 shadow-xs border border-slate-200 font-black"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>صورة شعار (Image Logo)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleConfigChange("logoType", "icon")}
                  className={`py-2 px-3 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    (config.logoType === "icon" || (!config.logoType && !config.logoUrl))
                      ? "bg-white text-sky-700 shadow-xs border border-slate-200 font-black"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>رمز إيموجي (Emoji Icon)</span>
                </button>
              </div>

              {/* OPTION 1: IMAGE LOGO UPLOADER & URL */}
              {(config.logoType === "image" || (!config.logoType && config.logoUrl)) ? (
                <div className="space-y-3 pt-1 animate-fadeIn">
                  {/* Current Image Logo Preview Box */}
                  <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="w-16 h-16 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0 relative group p-1">
                      {config.logoUrl ? (
                        <img src={config.logoUrl} alt="Store Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold text-center">لا توجد صورة</span>
                      )}
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <span className="block text-[11px] text-slate-600 font-bold">رفع صورة الشعار الخاصة بمتجرك:</span>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5 shadow-2xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>رفع صورة من جهازك</span>
                          <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                        </label>

                        {config.logoUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              handleConfigChange("logoUrl", "");
                              handleConfigChange("logoType", "icon");
                            }}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>إزالة الشعار</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Direct URL Input */}
                  <div className="space-y-1">
                    <label className="block text-[11px] text-slate-600 font-bold">أو أدخل رابط صورة الشعار مباشرة (URL):</label>
                    <input
                      type="url"
                      value={config.logoUrl || ""}
                      onChange={(e) => {
                        handleConfigChange("logoUrl", e.target.value);
                        if (e.target.value) handleConfigChange("logoType", "image");
                      }}
                      className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden transition"
                      placeholder="https://example.com/logo.png"
                    />
                  </div>

                  {/* Logo Size Slider */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-800 flex items-center gap-1">
                        <span>حجم الشعار في المتجر:</span>
                        <span className="text-[10px] text-slate-400 font-normal">(تكبير / تصغير)</span>
                      </span>
                      <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200 text-[11px]">
                        {config.logoSize || 48} بكسل (px)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-400">صغير (20px)</span>
                      <input
                        type="range"
                        min={20}
                        max={120}
                        step={2}
                        value={config.logoSize || 48}
                        onChange={(e) => handleConfigChange("logoSize", Number(e.target.value))}
                        className="w-full accent-sky-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                      />
                      <span className="text-[10px] font-bold text-slate-400">كبير (120px)</span>
                    </div>
                  </div>

                  {/* High Quality Preset Logo Images */}
                  <div className="space-y-2 pt-1 border-t border-slate-200/80">
                    <span className="block text-[10px] text-slate-500 font-extrabold">شعارات جاهزة للاختيار السريع:</span>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { name: "تاج ذهبي", url: "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?w=200&auto=format&fit=crop&q=80" },
                        { name: "درع تقني", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80" },
                        { name: "عطر فاخر", url: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=200&auto=format&fit=crop&q=80" },
                        { name: "رمز قهوة", url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&auto=format&fit=crop&q=80" },
                        { name: "ابتكار سيبراني", url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=200&auto=format&fit=crop&q=80" }
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => {
                            handleConfigChange("logoUrl", preset.url);
                            handleConfigChange("logoType", "image");
                          }}
                          className={`p-1 bg-white hover:bg-slate-50 border rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] transition shadow-2xs cursor-pointer ${
                            config.logoUrl === preset.url ? "border-sky-500 ring-2 ring-sky-500/20 bg-sky-50" : "border-slate-200"
                          }`}
                        >
                          <img src={preset.url} alt={preset.name} className="w-8 h-8 object-cover rounded-lg" referrerPolicy="no-referrer" />
                          <span className="text-[9px] font-bold truncate max-w-full text-slate-700">{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* OPTION 2: EMOJI ICON CUSTOMIZER */
                <div className="space-y-3 pt-1 animate-fadeIn">
                  <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    {/* Active logo icon preview */}
                    <div className="w-14 h-14 bg-slate-50 border border-slate-200 shadow-2xs rounded-xl flex items-center justify-center text-3xl shrink-0 select-none">
                      {config.logoIcon || "🛍️"}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <span className="block text-[11px] text-slate-500 font-bold">أدخل إيموجي أو رمزا مخصصا:</span>
                      <input
                        type="text"
                        maxLength={2}
                        value={config.logoIcon}
                        onChange={(e) => {
                          handleConfigChange("logoIcon", e.target.value);
                          handleConfigChange("logoType", "icon");
                        }}
                        className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-lg px-3 py-1.5 text-center text-slate-800 font-bold text-sm focus:outline-hidden transition"
                        placeholder="مثال: 🌸"
                      />
                    </div>
                  </div>

                  {/* Logo Size Slider for Icon */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-800 flex items-center gap-1">
                        <span>حجم الرمز في المتجر:</span>
                        <span className="text-[10px] text-slate-400 font-normal">(تكبير / تصغير)</span>
                      </span>
                      <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200 text-[11px]">
                        {config.logoSize || 44} بكسل (px)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-400">صغير (20px)</span>
                      <input
                        type="range"
                        min={20}
                        max={90}
                        step={2}
                        value={config.logoSize || 44}
                        onChange={(e) => handleConfigChange("logoSize", Number(e.target.value))}
                        className="w-full accent-sky-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                      />
                      <span className="text-[10px] font-bold text-slate-400">كبير (90px)</span>
                    </div>
                  </div>

                  {/* Presets suggestions */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-200/80">
                    <span className="block text-[10px] text-slate-500 font-extrabold">اقترحات سريعة للشعار حسب مجالك:</span>
                    
                    <div className="space-y-2">
                      {[
                        { label: "✨ عطور ومظهر", items: ["🌸", "💎", "🕯️", "👑", "✨", "🏺", "🌹", "⚜️"] },
                        { label: "⚡ تقنية وأجهزة", items: ["⚡", "📱", "🎧", "💻", "🎮", "💡", "🔋", "⌚"] },
                        { label: "☕ قهوة ومأكولات", items: ["☕", "🥐", "🍪", "🧁", "🍽️", "🍯", "🍔", "🎯"] },
                        { label: "🛍️ خدمات وعامة", items: ["🛍️", "📦", "🚀", "🎨", "🧸", "📚", "❤️", "🔔"] }
                      ].map((group) => (
                        <div key={group.label} className="space-y-1">
                          <span className="block text-[9px] text-slate-400 font-semibold">{group.label}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {group.items.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  handleConfigChange("logoIcon", emoji);
                                  handleConfigChange("logoType", "icon");
                                }}
                                className={`w-7 h-7 bg-white hover:bg-slate-50 border rounded-lg flex items-center justify-center text-sm transition shadow-2xs cursor-pointer ${
                                  config.logoIcon === emoji && config.logoType !== "image" ? "border-sky-500 bg-sky-50 ring-2 ring-sky-500/10" : "border-slate-100"
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Slogan input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">شعار لفظي للمتجر (Slogan)</label>
              <input
                type="text"
                value={config.slogan}
                onChange={(e) => handleConfigChange("slogan", e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none transition"
                placeholder="مثال: شغف الشرق ينبض في تفاصيلنا"
              />
            </div>

            {/* Phone contact input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">رقم الهاتف للتواصل والدعم</label>
              <input
                type="text"
                value={config.phone}
                onChange={(e) => handleConfigChange("phone", e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none transition"
                placeholder="+966 50 000 0000"
              />
            </div>

            {/* Currency switcher input */}
            <div className="space-y-2 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
              <label className="block text-xs font-extrabold text-slate-700">عملة المتجر المعتمدة 💱</label>
              
              {/* Quick Currency Selection Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { name: "ريال سعودي", symbol: "ر.س", flag: "🇸🇦" },
                  { name: "ريال يمني", symbol: "ر.ي", flag: "🇾🇪" },
                  { name: "دولار أمريكي", symbol: "$", flag: "🇺🇸" }
                ].map((curr) => (
                  <button
                    key={curr.symbol}
                    type="button"
                    onClick={() => handleConfigChange("currency", curr.symbol)}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-extrabold transition flex flex-col items-center justify-center gap-1 ${
                      config.currency === curr.symbol
                        ? "bg-sky-500 text-white border-sky-600 shadow-md ring-2 ring-sky-300"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-base">{curr.flag}</span>
                    <span className="text-[11px] whitespace-nowrap">{curr.name}</span>
                    <span className="text-[10px] opacity-80 font-mono">({curr.symbol})</span>
                  </button>
                ))}
              </div>

              <select
                value={config.currency || "ر.س"}
                onChange={(e) => handleConfigChange("currency", e.target.value)}
                className="w-full min-h-[44px] bg-white border border-slate-200/90 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-4 py-2.5 text-slate-800 text-xs sm:text-sm font-bold focus:outline-none transition mt-1 touch-manipulation cursor-pointer shadow-2xs"
              >
                <option value="ر.س">🇸🇦 ريال سعودي (ر.س)</option>
                <option value="ر.ي">🇾🇪 ريال يمني (ر.ي)</option>
                <option value="$">🇺🇸 دولار أمريكي ($)</option>
              </select>
            </div>
          </div>
        )}

        {/* --- DESIGN & IDENTITY TAB --- */}
        {activeTab === "design" && (
          <div className="space-y-5 animate-fadeIn">
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 space-y-1">
              <h4 className="font-bold text-amber-800 text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>التحكم الشامل في نوع الخط والألوان للقالبين</span>
              </h4>
              <p className="text-[11px] text-amber-600 leading-relaxed">
                خصّص نوع الخط العربي ولون العناوين والنصوص وألوان الأزرار بسهولة. تسري هذه التغييرات فورياً على كل من "قالب الأناقة العصرية" و"قالب التكنولوجيا والابتكار".
              </p>
            </div>

            {/* Template select style switcher */}
            <div className="space-y-1.5">
              <label className="block text-xs font-extrabold text-slate-700">نمط القالب الأساسي للمتجر</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleConfigChange("themeStyle", "elegant")}
                  className={`p-3.5 min-h-[44px] rounded-xl border font-black text-xs text-center transition touch-manipulation cursor-pointer active:scale-95 ${
                    config.themeStyle === "elegant" 
                      ? "border-amber-500 bg-amber-50 text-amber-800 shadow-xs ring-2 ring-amber-300/60" 
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  أناقة عصرية (عطور/أزياء) ✨
                </button>
                <button
                  onClick={() => handleConfigChange("themeStyle", "tech")}
                  className={`p-3.5 min-h-[44px] rounded-xl border font-black text-xs text-center transition touch-manipulation cursor-pointer active:scale-95 ${
                    config.themeStyle === "tech" 
                      ? "border-sky-500 bg-sky-50 text-sky-800 shadow-xs ring-2 ring-sky-300/60" 
                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  حيوية وتقنية (إلكترونيات) ⚡
                </button>
              </div>
            </div>

            {/* Font Family Selection */}
            <div className="space-y-2 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-extrabold text-slate-700">نوع الخط العربي (Font Family) 🔤</label>
                <span className="text-[10px] text-slate-500 font-bold">8 خطوط عربية فاخرة</span>
              </div>
              
              <select
                value={config.fontFamily}
                onChange={(e) => handleConfigChange("fontFamily", e.target.value)}
                className="w-full min-h-[44px] bg-white border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-4 py-3 text-slate-800 text-xs sm:text-sm font-bold focus:outline-none transition shadow-2xs touch-manipulation cursor-pointer"
              >
                <option value="Cairo">خط القاهرة الأنيق (Cairo)</option>
                <option value="Tajawal">خط التجوال الحيوي (Tajawal)</option>
                <option value="Almarai">خط المراعي المتوازن (Almarai)</option>
                <option value="Alexandria">خط الإسكندرية الحديث (Alexandria)</option>
                <option value="IBM Plex Sans Arabic">خط بي إم العصري (IBM Plex Sans Arabic)</option>
                <option value="Amiri">خط الأميري الملكي الأصيل (Amiri)</option>
                <option value="Changa">خط شانجا البارز (Changa)</option>
                <option value="Readex Pro">خط ريدكس الهندسي (Readex Pro)</option>
              </select>

              {/* Live Preview Box for Font */}
              <div 
                className="p-3 bg-white rounded-lg border border-slate-200 text-center text-xs space-y-1 mt-2 shadow-2xs"
                style={{
                  fontFamily: config.fontFamily === "Tajawal" ? "'Tajawal', sans-serif" :
                              config.fontFamily === "Almarai" ? "'Almarai', sans-serif" :
                              config.fontFamily === "Alexandria" ? "'Alexandria', sans-serif" :
                              config.fontFamily === "IBM Plex Sans Arabic" ? "'IBM Plex Sans Arabic', sans-serif" :
                              config.fontFamily === "Amiri" ? "'Amiri', serif" :
                              config.fontFamily === "Changa" ? "'Changa', sans-serif" :
                              config.fontFamily === "Readex Pro" ? "'Readex Pro', sans-serif" :
                              "'Cairo', sans-serif"
                }}
              >
                <p className="font-bold text-slate-800">معاينة الخط: أهلاً بكم في متجركم الذكي ✨</p>
                <p className="text-[11px] text-slate-500">سحر النفحات والابتكارات العصرية بلمسة واحدة</p>
              </div>
            </div>

            {/* Colors Picker Controls - Full Spectrum Palette Control */}
            <div className="space-y-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <label className="block text-xs font-extrabold text-slate-800">التحكم في لوحة ألوان القالب بالكامل 🎨</label>
                <span className="text-[10px] text-sky-700 font-extrabold bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">تحكم دقيق 100%</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* 1. Heading Color (secondaryColor) */}
                <div className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-extrabold text-slate-700">1. لون خط العناوين والعلامة (Headings & Titles)</label>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">{config.secondaryColor}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={config.secondaryColor || "#1C1917"}
                      onChange={(e) => handleConfigChange("secondaryColor", e.target.value)}
                      className="w-9 h-9 border border-slate-200 rounded-lg cursor-pointer shrink-0 p-0.5 bg-white"
                    />
                    <input
                      type="text"
                      value={config.secondaryColor || "#1C1917"}
                      onChange={(e) => handleConfigChange("secondaryColor", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 rounded-lg text-xs px-3 py-1.5 focus:outline-none uppercase font-mono font-bold"
                    />
                  </div>
                </div>

                {/* 2. Body Text Color (textColor) */}
                <div className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-extrabold text-slate-700">2. لون خط النصوص والوصف (Body Text)</label>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">{config.textColor || (config.themeStyle === "elegant" ? "#44403C" : "#334155")}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={config.textColor || (config.themeStyle === "elegant" ? "#44403C" : "#334155")}
                      onChange={(e) => handleConfigChange("textColor", e.target.value)}
                      className="w-9 h-9 border border-slate-200 rounded-lg cursor-pointer shrink-0 p-0.5 bg-white"
                    />
                    <input
                      type="text"
                      value={config.textColor || (config.themeStyle === "elegant" ? "#44403C" : "#334155")}
                      onChange={(e) => handleConfigChange("textColor", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 rounded-lg text-xs px-3 py-1.5 focus:outline-none uppercase font-mono font-bold"
                    />
                  </div>
                </div>

                {/* 3. Primary Accent / Button Color (primaryColor) */}
                <div className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-extrabold text-slate-700">3. لون الأزرار والتظليل (Primary Accent)</label>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">{config.primaryColor}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={config.primaryColor || "#D4AF37"}
                      onChange={(e) => handleConfigChange("primaryColor", e.target.value)}
                      className="w-9 h-9 border border-slate-200 rounded-lg cursor-pointer shrink-0 p-0.5 bg-white"
                    />
                    <input
                      type="text"
                      value={config.primaryColor || "#D4AF37"}
                      onChange={(e) => handleConfigChange("primaryColor", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 rounded-lg text-xs px-3 py-1.5 focus:outline-none uppercase font-mono font-bold"
                    />
                  </div>
                </div>

                {/* 4. Store Canvas Background Color (bgColor) */}
                <div className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-extrabold text-slate-700">4. لون خلفية المتجر الرئيسية (Store Background)</label>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">{config.bgColor || (config.themeStyle === "elegant" ? "#FDFBF7" : "#F8FAFC")}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={config.bgColor || (config.themeStyle === "elegant" ? "#FDFBF7" : "#F8FAFC")}
                      onChange={(e) => handleConfigChange("bgColor", e.target.value)}
                      className="w-9 h-9 border border-slate-200 rounded-lg cursor-pointer shrink-0 p-0.5 bg-white"
                    />
                    <input
                      type="text"
                      value={config.bgColor || (config.themeStyle === "elegant" ? "#FDFBF7" : "#F8FAFC")}
                      onChange={(e) => handleConfigChange("bgColor", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 rounded-lg text-xs px-3 py-1.5 focus:outline-none uppercase font-mono font-bold"
                    />
                  </div>
                </div>

                {/* 5. Card & Section Container Background Color (cardBgColor) */}
                <div className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-extrabold text-slate-700">5. لون خلفية البطاقات والأقسام (Card Background)</label>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">{config.cardBgColor || "#FFFFFF"}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={config.cardBgColor || "#FFFFFF"}
                      onChange={(e) => handleConfigChange("cardBgColor", e.target.value)}
                      className="w-9 h-9 border border-slate-200 rounded-lg cursor-pointer shrink-0 p-0.5 bg-white"
                    />
                    <input
                      type="text"
                      value={config.cardBgColor || "#FFFFFF"}
                      onChange={(e) => handleConfigChange("cardBgColor", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 rounded-lg text-xs px-3 py-1.5 focus:outline-none uppercase font-mono font-bold"
                    />
                  </div>
                </div>

                {/* 6. Border & Dividers Color (borderColor) */}
                <div className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-extrabold text-slate-700">6. لون الحدود والخطوط الفاصلة (Borders & Dividers)</label>
                    <span className="text-[9px] text-slate-400 font-mono font-bold">{config.borderColor || (config.themeStyle === "elegant" ? "#F2EAE1" : "#E2E8F0")}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={config.borderColor || (config.themeStyle === "elegant" ? "#F2EAE1" : "#E2E8F0")}
                      onChange={(e) => handleConfigChange("borderColor", e.target.value)}
                      className="w-9 h-9 border border-slate-200 rounded-lg cursor-pointer shrink-0 p-0.5 bg-white"
                    />
                    <input
                      type="text"
                      value={config.borderColor || (config.themeStyle === "elegant" ? "#F2EAE1" : "#E2E8F0")}
                      onChange={(e) => handleConfigChange("borderColor", e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 rounded-lg text-xs px-3 py-1.5 focus:outline-none uppercase font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Ready Color Presets */}
              <div className="pt-3 border-t border-slate-200/80 space-y-2">
                <span className="block text-[10px] font-extrabold text-slate-600">تنسيقات باليتات الألوان بنقرة واحدة (8 نماذج شاملة):</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { name: "✨ الذهبي الملكي", primary: "#D4AF37", secondary: "#1C1917", text: "#44403C", bg: "#FDFBF7", cardBg: "#FFFFFF", border: "#F2EAE1" },
                    { name: "⚡ سماء التكنولوجيا", primary: "#0284C7", secondary: "#0F172A", text: "#334155", bg: "#F8FAFC", cardBg: "#FFFFFF", border: "#E2E8F0" },
                    { name: "🌙 الليلي الفاخر", primary: "#F59E0B", secondary: "#F8FAFC", text: "#CBD5E1", bg: "#0F172A", cardBg: "#1E293B", border: "#334155" },
                    { name: "🌲 الزمرد النبيل", primary: "#059669", secondary: "#064E3B", text: "#115E59", bg: "#F0FDF4", cardBg: "#FFFFFF", border: "#D1FAE5" },
                    { name: "💜 البنفسجي", primary: "#7C3AED", secondary: "#312E81", text: "#4C1D95", bg: "#FAF5FF", cardBg: "#FFFFFF", border: "#E9D5FF" },
                    { name: "🍷 الياقوتي الفاخر", primary: "#BE123C", secondary: "#4C0519", text: "#7F1D1D", bg: "#FFF1F2", cardBg: "#FFFFFF", border: "#FFE4E6" },
                    { name: "☕ القهوة والكلاسيك", primary: "#B45309", secondary: "#451A03", text: "#78350F", bg: "#FFFBEB", cardBg: "#FFFFFF", border: "#FDE68A" },
                    { name: "🌊 الأزرق البحري", primary: "#2563EB", secondary: "#1E3A8A", text: "#1E40AF", bg: "#EFF6FF", cardBg: "#FFFFFF", border: "#DBEAFE" }
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        handleConfigChange("primaryColor", preset.primary);
                        handleConfigChange("secondaryColor", preset.secondary);
                        handleConfigChange("textColor", preset.text);
                        handleConfigChange("bgColor", preset.bg);
                        handleConfigChange("cardBgColor", preset.cardBg);
                        handleConfigChange("borderColor", preset.border);
                      }}
                      className="p-2 bg-white border border-slate-200 hover:border-sky-500 rounded-xl flex flex-col items-center gap-1.5 transition shadow-2xs group text-right"
                    >
                      <div className="flex items-center gap-1">
                        <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs" style={{ backgroundColor: preset.bg }} title="خلفية الصفحة" />
                        <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs" style={{ backgroundColor: preset.cardBg }} title="خلفية البطاقات" />
                        <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs" style={{ backgroundColor: preset.secondary }} title="العناوين" />
                        <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs" style={{ backgroundColor: preset.primary }} title="الأزرار" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-700 group-hover:text-slate-900 truncate max-w-full">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* HERO BANNER IMAGE CUSTOMIZER FOR HOMEPAGE (قالب الأناقة العصرية) */}
            <div className="space-y-4 bg-gradient-to-br from-amber-50/80 to-orange-50/60 p-4 rounded-2xl border border-amber-200 shadow-2xs">
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-amber-500 text-white font-black text-xs shadow-2xs">🖼️</span>
                  <div>
                    <h4 className="font-extrabold text-xs text-amber-950">صورة البنر الرئيسية تحت الهيدر (قالب الأناقة العصرية)</h4>
                    <p className="text-[10px] text-amber-800 font-medium">تظهر في أعلى الصفحة الرئيسية مباشرة تحت الهيدر</p>
                  </div>
                </div>
                
                {/* Toggle Enable/Disable */}
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showHeroBanner !== false}
                    onChange={(e) => handleConfigChange("showHeroBanner", e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-amber-900">
                    {config.showHeroBanner !== false ? "مُفعّل" : "معطّل"}
                  </span>
                </label>
              </div>

              {config.showHeroBanner !== false && (
                <div className="space-y-3 pt-1 animate-fadeIn">
                  {/* Current Hero Image Preview */}
                  <div className="relative w-full h-32 rounded-xl overflow-hidden border border-amber-300 shadow-inner bg-slate-900 group">
                    <img
                      src={config.heroBannerImage || "https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=1600&q=80"}
                      alt="Hero Banner Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 flex flex-col justify-end text-white text-right">
                      {config.heroBannerBadge && (
                        <span className="text-[9px] bg-amber-500 text-slate-900 font-extrabold px-2 py-0.5 rounded-full inline-block w-fit mb-1 shadow-2xs">
                          {config.heroBannerBadge}
                        </span>
                      )}
                      <h5 className="font-black text-xs text-white truncate">{config.heroBannerTitle || config.storeName}</h5>
                      <p className="text-[10px] text-slate-200 truncate">{config.heroBannerSubtitle || config.slogan}</p>
                    </div>
                  </div>

                  {/* Upload Controls */}
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs">
                      <Upload className="w-3.5 h-3.5" />
                      <span>رفع صورة بنر من جهازك</span>
                      <input type="file" accept="image/*" onChange={handleHeroBannerUpload} className="hidden" />
                    </label>

                    {config.heroBannerImage && (
                      <button
                        type="button"
                        onClick={() => handleConfigChange("heroBannerImage", "https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=1600&q=80")}
                        className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                        <span>الصورة الافتراضية</span>
                      </button>
                    )}
                  </div>

                  {/* Image URL Input */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-extrabold text-amber-900">أو أدخل رابط صورة مباشرة (URL):</label>
                    <input
                      type="url"
                      value={config.heroBannerImage || ""}
                      onChange={(e) => handleConfigChange("heroBannerImage", e.target.value)}
                      className="w-full bg-white border border-amber-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none transition shadow-2xs"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>

                  {/* Quick Banner Image Presets */}
                  <div className="space-y-1.5 pt-1">
                    <span className="block text-[10px] font-extrabold text-amber-900">نماذج صور بنر راقية جاهزة للاختيار السريع:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { name: "عطور وزيوت فاخرة", url: "https://images.unsplash.com/photo-1547887537-6158d64c35b3?auto=format&fit=crop&w=1600&q=80" },
                        { name: "عود ومباخر شرقية", url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1600&q=80" },
                        { name: "زهور وعطور فرنسية", url: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=1600&q=80" },
                        { name: "مجوهرات وساعات أنيقة", url: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1600&q=80" },
                        { name: "أزياء وموضة راقية", url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80" },
                        { name: "عناية ومستحضرات جمال", url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1600&q=80" },
                        { name: "قهوة وضيافة ملكية", url: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1600&q=80" },
                        { name: "ديكورات ومنزل فاخر", url: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=80" }
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => handleConfigChange("heroBannerImage", preset.url)}
                          className={`relative h-14 rounded-xl overflow-hidden border transition text-right shadow-2xs group cursor-pointer ${
                            config.heroBannerImage === preset.url ? "ring-2 ring-amber-600 border-amber-600" : "border-amber-200/80 hover:border-amber-400"
                          }`}
                        >
                          <img src={preset.url} alt={preset.name} className="w-full h-full object-cover group-hover:scale-105 transition" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/50 p-1.5 flex items-end">
                            <span className="text-[9px] font-bold text-white truncate max-w-full">{preset.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Banner Overlay Text Customization */}
                  <div className="pt-2 border-t border-amber-200/80 space-y-2">
                    <span className="block text-[11px] font-extrabold text-amber-900">تخصيص العناوين والزر على البنر (اختياري):</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">العنوان الرئيسي</label>
                        <input
                          type="text"
                          value={config.heroBannerTitle || ""}
                          onChange={(e) => handleConfigChange("heroBannerTitle", e.target.value)}
                          className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                          placeholder={config.storeName}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">الشارة الدعائية (Badge)</label>
                        <input
                          type="text"
                          value={config.heroBannerBadge || ""}
                          onChange={(e) => handleConfigChange("heroBannerBadge", e.target.value)}
                          className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                          placeholder="مثال: ✨ العرض الحصري الجديد"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">الوصف / النص الفرعي</label>
                        <input
                          type="text"
                          value={config.heroBannerSubtitle || ""}
                          onChange={(e) => handleConfigChange("heroBannerSubtitle", e.target.value)}
                          className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                          placeholder={config.slogan}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">نص زر التصفح</label>
                        <input
                          type="text"
                          value={config.heroBannerButtonText || ""}
                          onChange={(e) => handleConfigChange("heroBannerButtonText", e.target.value)}
                          className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                          placeholder="تسوق التشكيلة الآن"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Banner announcement text */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">نص شريط الإعلانات بالأعلى</label>
              <textarea
                value={config.bannerText}
                onChange={(e) => handleConfigChange("bannerText", e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-4 py-2.5 text-slate-800 text-xs focus:outline-none transition leading-relaxed"
                placeholder="اكتب العرض الجاري أو الميزة التسويقية..."
              />
            </div>

          </div>
        )}

        {/* --- PRODUCTS MANAGEMENT TAB --- */}
        {activeTab === "products" && (() => {
          const totalProds = config.products.length;
          const totalUnits = config.products.reduce((acc, p) => acc + (p.manageStock !== false ? (p.stockQuantity ?? 10) : 0), 0);
          const outOfStockCount = config.products.filter(p => p.manageStock !== false && (p.stockQuantity ?? 10) <= 0).length;
          const lowStockCount = config.products.filter(p => p.manageStock !== false && (p.stockQuantity ?? 10) > 0 && (p.stockQuantity ?? 10) <= (p.lowStockThreshold ?? 5)).length;
          const inStockCount = config.products.filter(p => p.manageStock === false || (p.stockQuantity ?? 10) > (p.lowStockThreshold ?? 5)).length;

          const filteredProducts = config.products
            .map((product, originalIndex) => ({ product, originalIndex }))
            .filter(({ product }) => {
              // Search Filter
              if (productSearch.trim()) {
                const q = productSearch.toLowerCase();
                const matches = (
                  (product.name || "").toLowerCase().includes(q) ||
                  (product.category || "").toLowerCase().includes(q) ||
                  (product.description || "").toLowerCase().includes(q) ||
                  (product.sku || "").toLowerCase().includes(q)
                );
                if (!matches) return false;
              }

              // Stock Status Filter
              const qty = product.stockQuantity ?? 10;
              const isManaged = product.manageStock !== false;
              if (stockFilter === "inStock") return !isManaged || qty > (product.lowStockThreshold ?? 5);
              if (stockFilter === "lowStock") return isManaged && qty > 0 && qty <= (product.lowStockThreshold ?? 5);
              if (stockFilter === "outOfStock") return isManaged && qty <= 0;

              return true;
            })
            .sort((a, b) => {
              const qtyA = a.product.stockQuantity ?? 10;
              const qtyB = b.product.stockQuantity ?? 10;
              if (productSort === "highStock") return qtyB - qtyA;
              if (productSort === "lowStock") return qtyA - qtyB;
              if (productSort === "highPrice") return b.product.price - a.product.price;
              if (productSort === "lowPrice") return a.product.price - b.product.price;
              return 0;
            });

          return (
            <div className="space-y-4 animate-fadeIn">
              {/* Header & Main Stats Bar */}
              <div className="bg-gradient-to-r from-amber-50/90 via-slate-50 to-amber-50/50 p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-300 flex items-center justify-center text-amber-700 font-bold text-lg shadow-2xs">
                      <Package className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                        <span>إدارة المعروضات والمخزون الذكي 📦</span>
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs px-2 py-0.5 rounded-full font-black">
                          {totalProds} منتج ({totalUnits} قطعة)
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-600 font-medium">تحكم كامل بالكميات، الأسعار، الفلترة، والتحكم السريع بالمخزون</p>
                    </div>
                  </div>

                  <button
                    onClick={addEmptyProduct}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3.5 py-2 rounded-xl transition shadow-xs hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer touch-manipulation min-h-[40px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة منتج جديد ➕</span>
                  </button>
                </div>

                {/* Stock Quick Analytics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200/80 text-xs">
                  <button
                    type="button"
                    onClick={() => setStockFilter("all")}
                    className={`p-2 rounded-xl border text-right transition cursor-pointer touch-manipulation ${
                      stockFilter === "all" ? "bg-amber-500 text-slate-950 border-amber-500 font-extrabold shadow-2xs" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-bold"
                    }`}
                  >
                    <span className={`text-[10px] block font-bold ${stockFilter === "all" ? "text-slate-900" : "text-slate-500"}`}>جميع المنتجات</span>
                    <strong className="text-sm font-black">{totalProds} منتج</strong>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStockFilter("inStock")}
                    className={`p-2 rounded-xl border text-right transition cursor-pointer touch-manipulation ${
                      stockFilter === "inStock" ? "bg-emerald-600 text-white border-emerald-600 font-extrabold shadow-2xs" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-bold"
                    }`}
                  >
                    <span className={`text-[10px] block font-bold ${stockFilter === "inStock" ? "text-white/90" : "text-slate-500"}`}>متوفر بكثرة ✅</span>
                    <strong className="text-sm font-black">{inStockCount}</strong>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStockFilter("lowStock")}
                    className={`p-2 rounded-xl border text-right transition cursor-pointer touch-manipulation ${
                      stockFilter === "lowStock" ? "bg-amber-600 text-white border-amber-600 font-extrabold shadow-2xs" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-bold"
                    }`}
                  >
                    <span className={`text-[10px] block font-bold ${stockFilter === "lowStock" ? "text-white/90" : "text-slate-500"}`}>مخزون منخفض ⚠️</span>
                    <strong className="text-sm font-black">{lowStockCount}</strong>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStockFilter("outOfStock")}
                    className={`p-2 rounded-xl border text-right transition cursor-pointer touch-manipulation ${
                      stockFilter === "outOfStock" ? "bg-rose-600 text-white border-rose-600 font-extrabold shadow-2xs" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-bold"
                    }`}
                  >
                    <span className={`text-[10px] block font-bold ${stockFilter === "outOfStock" ? "text-white/90" : "text-slate-500"}`}>نفذت الكمية ❌</span>
                    <strong className="text-sm font-black">{outOfStockCount}</strong>
                  </button>
                </div>

                {/* Search Bar & Sorting Toolbar */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="ابحث باسم المنتج، التصنيف، الوصف، أو SKU..."
                      className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 rounded-xl pr-9 pl-4 py-2.5 min-h-[44px] text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none transition shadow-2xs"
                    />
                    {productSearch && (
                      <button 
                        onClick={() => setProductSearch("")}
                        className="absolute left-3 top-3 text-slate-400 hover:text-slate-700 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Sort Selector */}
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <span className="text-[10px] text-slate-600 font-bold shrink-0">ترتيب حسب:</span>
                    <select
                      value={productSort}
                      onChange={(e) => setProductSort(e.target.value as any)}
                      className="bg-white border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs sm:text-sm text-slate-900 font-extrabold focus:outline-none cursor-pointer touch-manipulation w-full sm:w-auto shadow-2xs"
                    >
                      <option value="default">الترتيب الافتراضي</option>
                      <option value="highStock">الأعلى مخزوناً 📈</option>
                      <option value="lowStock">الأقل مخزوناً 📉</option>
                      <option value="highPrice">الأعلى سعراً 💰</option>
                      <option value="lowPrice">الأقل سعراً 🏷️</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Vertical List: Product Cards with Quick Stock Controller */}
              <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-2">
                    <Package className="w-10 h-10 mx-auto text-slate-300" />
                    <h5 className="font-bold text-sm text-slate-800">لا توجد منتجات تطابق البحث أو الفلتر المالي</h5>
                    <p className="text-xs text-slate-500">جرب تغيير كلمة البحث أو الضغط على "جميع المنتجات"</p>
                    <button
                      type="button"
                      onClick={() => { setStockFilter("all"); setProductSearch(""); }}
                      className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs rounded-xl transition"
                    >
                      إعادة عرض الكل
                    </button>
                  </div>
                ) : (
                  filteredProducts.map(({ product, originalIndex }) => {
                    const isExpanded = expandedProductId === product.id;
                    const stockQty = product.stockQuantity ?? 10;
                    const isManaged = product.manageStock !== false;
                    const isLow = isManaged && stockQty > 0 && stockQty <= (product.lowStockThreshold ?? 5);
                    const isOut = isManaged && stockQty <= 0;

                    return (
                      <div 
                        key={product.id}
                        className={`bg-white rounded-2xl border transition duration-200 overflow-hidden shadow-2xs ${
                          isExpanded 
                            ? "border-amber-400 ring-2 ring-amber-400/20 shadow-md" 
                            : isOut 
                            ? "border-rose-200 bg-rose-50/20" 
                            : isLow 
                            ? "border-amber-200 bg-amber-50/10" 
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {/* Item Row Header (Summary & Actions) */}
                        <div className="p-3.5 flex items-center justify-between gap-3 bg-white">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Product Thumbnail */}
                            <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs relative">
                              {product.imageUrl ? (
                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-xl">{getProductIconEmoji(product.imageKeyword)}</span>
                              )}
                              {isOut && (
                                <span className="absolute inset-0 bg-rose-950/70 text-white text-[8px] font-black flex items-center justify-center text-center leading-tight">
                                  نفد المخزون
                                </span>
                              )}
                            </div>

                            {/* Product Title, Category, Price & Stock Badge */}
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h5 className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                                  {product.name || "منتج بدون اسم"}
                                </h5>
                                <span className="text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80 shrink-0">
                                  {product.category || "عام"}
                                </span>

                                {/* Stock Status Badge */}
                                {isManaged ? (
                                  isOut ? (
                                    <span className="text-[9px] font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                                      ❌ نفد (0)
                                    </span>
                                  ) : isLow ? (
                                    <span className="text-[9px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                                      ⚠️ منخفض ({stockQty})
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                                      ✅ متوفر ({stockQty})
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[9px] font-extrabold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                    ♾️ كمية مفتوحة
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium flex-wrap">
                                <span className="font-extrabold text-amber-600 font-mono text-xs">
                                  {product.price} {config.currency}
                                </span>
                                {product.sku && (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-[10px] font-mono text-slate-500">SKU: {product.sku}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions: Edit toggle button + Delete button */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                              className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-black transition flex items-center gap-1.5 border cursor-pointer touch-manipulation active:scale-95 ${
                                isExpanded
                                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow-2xs"
                                  : "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100 hover:text-sky-800"
                              }`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{isExpanded ? "إغلاق" : "تعديل"}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => setProductToDelete(product)}
                              className="p-2 min-h-[40px] min-w-[40px] rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer flex items-center justify-center touch-manipulation active:scale-95"
                              title="حذف هذا المنتج"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Edit Form Panel */}
                        {isExpanded && (
                          <div className="border-t border-slate-200/90 bg-slate-50/80 p-4 space-y-4 animate-fadeIn">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                              <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                                <span>📝 تعديل بيانات المنتج:</span>
                                <span className="text-slate-600 font-extrabold">{product.name}</span>
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 font-mono">
                                # {originalIndex + 1}
                              </span>
                            </div>

                          {/* Name & Price & Category Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Product Name */}
                            <div className="space-y-1 sm:col-span-1">
                              <label className="block text-[11px] font-extrabold text-slate-700">اسم المنتج</label>
                              <input
                                type="text"
                                value={product.name}
                                onChange={(e) => handleProductChange(originalIndex, "name", e.target.value)}
                                className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none transition shadow-2xs"
                                placeholder="مثال: عطر مسك الغزال الملكي"
                              />
                            </div>

                            {/* Price */}
                            <div className="space-y-1">
                              <label className="block text-[11px] font-extrabold text-slate-700">السعر ({config.currency})</label>
                              <input
                                type="number"
                                value={product.price}
                                onChange={(e) => handleProductChange(originalIndex, "price", Number(e.target.value))}
                                className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono font-bold focus:outline-none transition shadow-2xs"
                                placeholder="180"
                              />
                            </div>

                            {/* Category */}
                            <div className="space-y-1">
                              <label className="block text-[11px] font-extrabold text-slate-700">التصنيف الفرعي</label>
                              <input
                                type="text"
                                value={product.category}
                                onChange={(e) => handleProductChange(originalIndex, "category", e.target.value)}
                                className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none transition shadow-2xs"
                                placeholder="مثال: عطور شرقية"
                              />
                            </div>
                          </div>

                          {/* Description */}
                          <div className="space-y-1">
                            <label className="block text-[11px] font-extrabold text-slate-700">وصف المنتج التسويقي</label>
                            <textarea
                              value={product.description || ""}
                              onChange={(e) => handleProductChange(originalIndex, "description", e.target.value)}
                              rows={2}
                              className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none leading-relaxed transition shadow-2xs"
                              placeholder="اكتب وصفاً جذاباً ومختصراً يبرز مزايا المنتج وخاماته..."
                            />
                          </div>

                          {/* Inventory Fields for this Product */}
                          <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black text-amber-900 flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-amber-600" />
                                <span>إدارة كمية ومخزون هذا المنتج 📦</span>
                              </span>
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <span className="text-[10px] font-bold text-slate-600">تتبع الكمية</span>
                                <input
                                  type="checkbox"
                                  checked={product.manageStock !== false}
                                  onChange={(e) => handleProductChange(originalIndex, "manageStock", e.target.checked)}
                                  className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                                />
                              </label>
                            </div>

                            {product.manageStock !== false && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">الكمية بالمخزون</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={product.stockQuantity ?? 10}
                                    onChange={(e) => handleProductChange(originalIndex, "stockQuantity", Math.max(0, Number(e.target.value)))}
                                    className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-amber-500/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">رمز المنتج / SKU</label>
                                  <input
                                    type="text"
                                    value={product.sku || ""}
                                    onChange={(e) => handleProductChange(originalIndex, "sku", e.target.value)}
                                    placeholder="SKU-100"
                                    className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-amber-500/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">حد التنبيه بالانخفاض</label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={product.lowStockThreshold ?? 5}
                                    onChange={(e) => handleProductChange(originalIndex, "lowStockThreshold", Number(e.target.value))}
                                    className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-amber-500/20 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-mono"
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Image/Icon Type Selector */}
                          <div className="space-y-2 pt-1 border-t border-slate-200/80">
                            <label className="block text-[11px] font-extrabold text-slate-700">نوع صورة / أسلوب عرض المنتج</label>
                            <div className="grid grid-cols-2 gap-2 bg-slate-200/60 p-1 rounded-xl border border-slate-300/60">
                              <button
                                type="button"
                                onClick={() => {
                                  handleProductChange(originalIndex, "imageUrl", "");
                                  handleProductChange(originalIndex, "imageUrls", []);
                                }}
                                className={`py-2 px-3 rounded-lg text-xs font-bold text-center transition cursor-pointer ${
                                  !product.imageUrl && (!product.imageUrls || product.imageUrls.length === 0)
                                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200" 
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                              >
                                أيقونة رسم متجهة 🎨
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!product.imageUrl && (!product.imageUrls || product.imageUrls.length === 0)) {
                                    handleProductChange(originalIndex, "imageUrl", "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=600&q=80");
                                    handleProductChange(originalIndex, "imageUrls", ["https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=600&q=80"]);
                                  }
                                }}
                                className={`py-2 px-3 rounded-lg text-xs font-bold text-center transition cursor-pointer ${
                                  product.imageUrl || (product.imageUrls && product.imageUrls.length > 0)
                                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200" 
                                    : "text-slate-600 hover:text-slate-900"
                                }`}
                              >
                                صورة منتج حقيقية 📸
                              </button>
                            </div>
                          </div>

                          {/* Render vector icon selector or photo uploader */}
                          {!product.imageUrl && (!product.imageUrls || product.imageUrls.length === 0) ? (
                            <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200">
                              <label className="block text-[11px] font-extrabold text-slate-700">اختر الأيقونة المتجهة المناسبة:</label>
                              <select
                                value={product.imageKeyword}
                                onChange={(e) => handleProductChange(originalIndex, "imageKeyword", e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-amber-500/20 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none"
                              >
                                <option value="perfume">عطور وبخاخات 🧴</option>
                                <option value="oud-wood">كسر عود ودهن 🪵</option>
                                <option value="incense">مباخر وبخور 💨</option>
                                <option value="home-decor">ديكورات وتحف فاخرة 🏺</option>
                                <option value="headphones">سماعات رأس ومكبرات 🎧</option>
                                <option value="charger">شواحن لاسلكية ووصلات ⚡</option>
                                <option value="smartwatch">ساعات ذكية وأساور ⌚</option>
                                <option value="lamp">مصابيح وإضاءات ذكية 💡</option>
                                <option value="coffee-cup">قهوة ومشروبات وأكواب ☕</option>
                                <option value="default">حقيبة تسوق عامة 👜</option>
                              </select>
                            </div>
                          ) : (
                            <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-200 font-sans">
                              {/* File Upload Drag & Drop */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="block text-[11px] font-extrabold text-slate-700">تحميل صور من جهازك (رفع مباشر متعدّد)</label>
                                  <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-extrabold border border-amber-200">رفع متعدّد 📸</span>
                                </div>
                                <div className="relative border-2 border-dashed border-amber-300/80 hover:border-amber-500 transition rounded-xl p-3.5 bg-amber-50/30 hover:bg-amber-50/60 text-center cursor-pointer group/upload">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    onChange={(e) => {
                                      const files = Array.from(e.target.files || []);
                                      if (files.length === 0) return;

                                      let loadedCount = 0;
                                      const newBase64s: string[] = [];

                                      files.forEach((file: any) => {
                                        if (file.size > 2 * 1024 * 1024) {
                                          alert(`حجم الصورة "${file.name}" كبير جداً! يرجى اختيار ملفات أقل من 2 ميجابايت لضمان السرعة الأفضل.`);
                                          return;
                                        }
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                          if (typeof reader.result === "string") {
                                            newBase64s.push(reader.result);
                                          }
                                          loadedCount++;
                                          if (loadedCount === files.length) {
                                            const currentUrls = product.imageUrls || [];
                                            const combined = [...currentUrls, ...newBase64s];
                                            handleProductChange(originalIndex, "imageUrls", combined);
                                            if (!product.imageUrl && newBase64s.length > 0) {
                                              handleProductChange(originalIndex, "imageUrl", newBase64s[0]);
                                            }
                                          }
                                        };
                                        reader.readAsDataURL(file);
                                      });
                                    }}
                                  />
                                  <div className="flex flex-col items-center justify-center gap-1">
                                    <Upload className="w-5 h-5 text-amber-600 group-hover/upload:scale-110 transition" />
                                    <span className="text-xs font-extrabold text-slate-700 group-hover/upload:text-amber-900 transition">
                                      اسحب صورة أو صور متعددة هنا أو اضغط للتصفح 📤
                                    </span>
                                    <span className="text-[10px] text-slate-400">يمكنك تحديد عدة صور معاً من الاستوديو</span>
                                  </div>
                                </div>
                              </div>

                              {/* URL Input Helper */}
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500">أو إضافة صورة عبر رابط ويب مباشر (URL)</label>
                                <div className="flex gap-1.5">
                                  <input
                                    type="text"
                                    placeholder="https://example.com/image.jpg"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        const val = e.currentTarget.value.trim();
                                        if (val) {
                                          const currentUrls = product.imageUrls || [];
                                          if (!currentUrls.includes(val)) {
                                            handleProductChange(originalIndex, "imageUrls", [...currentUrls, val]);
                                            if (!product.imageUrl) {
                                              handleProductChange(originalIndex, "imageUrl", val);
                                            }
                                          }
                                          e.currentTarget.value = "";
                                        }
                                      }
                                    }}
                                    className="flex-1 bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-amber-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-mono focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      const input = e.currentTarget.previousSibling as HTMLInputElement;
                                      const val = input.value.trim();
                                      if (val) {
                                        const currentUrls = product.imageUrls || [];
                                        if (!currentUrls.includes(val)) {
                                          handleProductChange(originalIndex, "imageUrls", [...currentUrls, val]);
                                          if (!product.imageUrl) {
                                            handleProductChange(originalIndex, "imageUrl", val);
                                          }
                                        }
                                        input.value = "";
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                                  >
                                    إضافة ➕
                                  </button>
                                </div>
                              </div>

                              {/* Display Uploaded Gallery */}
                              {(() => {
                                const list: string[] = [];
                                if (product.imageUrl) list.push(product.imageUrl);
                                if (product.imageUrls) {
                                  product.imageUrls.forEach(url => {
                                    if (url && !list.includes(url)) list.push(url);
                                  });
                                }

                                if (list.length > 0) {
                                  return (
                                    <div className="space-y-1.5 border-t border-slate-100 pt-2">
                                      <label className="block text-[10px] font-extrabold text-slate-700">معرض صور المنتج الحالي ({list.length} صور):</label>
                                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                        {list.map((url, imgIdx) => {
                                          const isMain = product.imageUrl === url;
                                          return (
                                            <div 
                                              key={imgIdx} 
                                              onClick={() => handleProductChange(originalIndex, "imageUrl", url)}
                                              className={`relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer group/itemimg transition shadow-2xs ${
                                                isMain ? "border-amber-500 ring-2 ring-amber-500/30" : "border-slate-200 hover:border-slate-300"
                                              }`}
                                              title={isMain ? "الصورة الأساسية" : "انقر لجعلها الصورة الأساسية"}
                                            >
                                              <img src={url} className="w-full h-full object-cover bg-white" referrerPolicy="no-referrer" />
                                              {isMain && (
                                                <span className="absolute top-0 right-0 bg-amber-500 text-slate-950 text-[8px] px-1 py-0.5 rounded-bl font-black z-10">
                                                  رئيسية ⭐
                                                </span>
                                              )}
                                              
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  const currentUrls = product.imageUrls || [];
                                                  const filteredUrls = currentUrls.filter(u => u !== url);
                                                  handleProductChange(originalIndex, "imageUrls", filteredUrls);
                                                  if (isMain) {
                                                    handleProductChange(originalIndex, "imageUrl", filteredUrls[0] || "");
                                                  }
                                                }}
                                                className="absolute bottom-0 inset-x-0 bg-rose-600 text-white text-[9px] py-0.5 text-center font-bold opacity-0 group-hover/itemimg:opacity-100 transition duration-150 z-10"
                                              >
                                                حذف 🗑️
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              {/* Preset Library Grid */}
                              <div className="space-y-1.5 border-t border-slate-100 pt-2">
                                <label className="block text-[10px] font-extrabold text-slate-700">أو اختر للبدء من مكتبة الصور الجاهزة:</label>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                  {[
                                    { name: "عطر زجاجي", url: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=600&q=80" },
                                    { name: "عطر فرنسي", url: "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=600&q=80" },
                                    { name: "دهن عود/أقراص", url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80" },
                                    { name: "بخور/مبخرة", url: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80" },
                                    { name: "ساعة ذكية", url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80" },
                                    { name: "سماعة رأس", url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80" },
                                    { name: "شاحن ذكي", url: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80" },
                                    { name: "تحف وفازات", url: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80" },
                                    { name: "ديكور غرفة", url: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=80" },
                                    { name: "إضاءة ذكية", url: "https://images.unsplash.com/photo-1507646227500-4d389b0012be?auto=format&fit=crop&w=600&q=80" },
                                    { name: "فنجان قهوة", url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80" },
                                    { name: "كوب سيراميك", url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80" }
                                  ].map((preset) => {
                                    const isSelected = product.imageUrl === preset.url || (product.imageUrls && product.imageUrls.includes(preset.url));
                                    return (
                                      <button
                                        key={preset.url}
                                        type="button"
                                        onClick={() => {
                                          const currentUrls = product.imageUrls || [];
                                          if (!currentUrls.includes(preset.url)) {
                                            handleProductChange(originalIndex, "imageUrls", [...currentUrls, preset.url]);
                                            if (!product.imageUrl) {
                                              handleProductChange(originalIndex, "imageUrl", preset.url);
                                            }
                                          } else {
                                            handleProductChange(originalIndex, "imageUrl", preset.url);
                                          }
                                        }}
                                        className={`p-1.5 rounded-lg text-[9px] font-bold border truncate transition cursor-pointer ${
                                          isSelected 
                                            ? "bg-amber-100 border-amber-400 text-amber-950 font-black shadow-2xs" 
                                            : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                                        }`}
                                        title={preset.name}
                                      >
                                        {preset.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Actions Bar (Delete & Save) */}
                          <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setProductToDelete(product)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-extrabold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف هذا المنتج 🗑️</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setExpandedProductId(null)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>إنهاء وحفظ التعديل</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }))}

              {config.products.length === 0 && (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 space-y-2">
                  <Package className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-extrabold text-slate-500">لا يوجد أي منتجات معروضة في المتجر حالياً.</p>
                  <button
                    type="button"
                    onClick={addEmptyProduct}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-500 transition cursor-pointer"
                  >
                    إضافة أول منتج الآن ➕
                  </button>
                </div>
              )}
            </div>

            {/* --- DELETE PRODUCT CONFIRMATION MODAL --- */}
            {productToDelete && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
                <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-rose-100 shadow-2xl space-y-5 text-right font-sans">
                  <div className="flex items-center gap-3 text-rose-600">
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                      <Trash2 className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900">تأكيد حذف المنتج</h3>
                      <p className="text-xs text-slate-500 font-medium">سيتم إزالة هذا المنتج نهائياً من المتجر</p>
                    </div>
                  </div>

                  <div className="bg-rose-50/80 border border-rose-200/80 rounded-2xl p-4 space-y-2.5">
                    <p className="text-xs text-slate-800 font-bold leading-relaxed">
                      هل أنت متأكد من رغبتك في حذف هذا المنتج من قائمة المعروضات؟
                    </p>
                    <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-rose-200 shadow-2xs">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                        {productToDelete.imageUrl ? (
                          <img src={productToDelete.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg">{getProductIconEmoji(productToDelete.imageKeyword)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h5 className="font-black text-xs text-slate-900 truncate">{productToDelete.name || "منتج بدون اسم"}</h5>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-mono font-extrabold text-amber-700">{productToDelete.price} {config.currency}</span>
                          <span>•</span>
                          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold">{productToDelete.category || "عام"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setProductToDelete(null)}
                      className="px-4 py-2.5 rounded-xl text-xs font-black text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                    >
                      إلغاء الأمر
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (productToDelete) {
                          deleteProduct(productToDelete.id);
                          if (expandedProductId === productToDelete.id) {
                            setExpandedProductId(null);
                          }
                          setProductToDelete(null);
                        }
                      }}
                      className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-700 transition shadow-md hover:shadow-rose-600/30 flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>تأكيد الحذف النهائي</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

        {/* --- INVENTORY MANAGEMENT TAB (إدارة المخزون والمستودع) --- */}
        {activeTab === "inventory" && (() => {
          const products = config.products || [];
          const defaultThreshold = config.lowStockWarningThreshold ?? 5;

          const totalProducts = products.length;
          const totalUnitsInWarehouse = products.reduce((acc, p) => acc + (p.manageStock !== false ? (p.stockQuantity ?? 10) : 0), 0);
          const outOfStockCount = products.filter(p => p.manageStock !== false && (p.stockQuantity ?? 10) <= 0).length;
          const lowStockCount = products.filter(p => p.manageStock !== false && (p.stockQuantity ?? 10) > 0 && (p.stockQuantity ?? 10) <= (p.lowStockThreshold ?? defaultThreshold)).length;
          const inStockCount = products.filter(p => p.manageStock !== false && (p.stockQuantity ?? 10) > (p.lowStockThreshold ?? defaultThreshold)).length;
          const unlimitedCount = products.filter(p => p.manageStock === false).length;

          // Search and filter products for inventory view
          const filteredInventory = products
            .map((product, originalIndex) => ({ product, originalIndex }))
            .filter(({ product }) => {
              // Search
              if (inventorySearch.trim()) {
                const q = inventorySearch.toLowerCase();
                const matches = (
                  (product.name || "").toLowerCase().includes(q) ||
                  (product.sku || "").toLowerCase().includes(q) ||
                  (product.category || "").toLowerCase().includes(q)
                );
                if (!matches) return false;
              }

              // Filter
              const qty = product.stockQuantity ?? 10;
              const isManaged = product.manageStock !== false;
              if (inventoryFilter === "inStock") return isManaged && qty > (product.lowStockThreshold ?? defaultThreshold);
              if (inventoryFilter === "lowStock") return isManaged && qty > 0 && qty <= (product.lowStockThreshold ?? defaultThreshold);
              if (inventoryFilter === "outOfStock") return isManaged && qty <= 0;
              if (inventoryFilter === "unlimited") return !isManaged;

              return true;
            });

          return (
            <div className="space-y-6 animate-fadeIn text-right">
              {/* Header Hero Banner */}
              <div className="bg-gradient-to-r from-amber-50/90 via-slate-50 to-amber-50/50 p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-300 flex items-center justify-center text-amber-700 font-bold text-xl shadow-2xs">
                      <Package className="w-6 h-6 text-amber-700" />
                    </div>
                    <div>
                      <h4 className="font-black text-base text-slate-900 flex items-center gap-2">
                        <span>إدارة المخزون والرموز (SKU)</span>
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs px-2.5 py-0.5 rounded-full font-black">
                          {totalUnitsInWarehouse} قطعة متبقية
                        </span>
                      </h4>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">
                        تحكم يدوياً ومباشراً بالرمز (SKU)، عدد القطع المتاحة، وحدود التنبيه لكل منتج بمرونة كاملة
                      </p>
                    </div>
                  </div>

                  {/* Bulk Quick Batch Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        products.forEach((p, idx) => {
                          if (!p.sku) {
                            handleProductChange(idx, "sku", `SKU-${100 + idx}`);
                          }
                        });
                        alert("تم توليد وتوزيع رموز SKU تلقائياً للمنتجات التي لا تملك رمزا! 🏷️✨");
                      }}
                      className="bg-white hover:bg-slate-50 text-amber-900 border border-amber-300 font-extrabold text-xs px-3.5 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-2xs touch-manipulation min-h-[40px]"
                      title="توليد رموز SKU للمنتجات التي بدون رمز"
                    >
                      <Tag className="w-3.5 h-3.5 text-amber-600" />
                      <span>توليد رموز SKU تلقائياً</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const val = prompt("أدخل عدد القطع الموحد المراد تعيينه لجميع المنتجات في المستودع:", "50");
                        if (val !== null && !isNaN(Number(val))) {
                          const num = Math.max(0, Number(val));
                          products.forEach((_, idx) => {
                            handleProductChange(idx, "stockQuantity", num);
                            handleProductChange(idx, "manageStock", true);
                          });
                          alert(`تم تعيين الكمية المتاحة لجميع المنتجات إلى ${num} قطعة بنجاح! 📦🎉`);
                        }
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-3.5 py-2.5 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer touch-manipulation min-h-[40px]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>تحديث عدد الكمية للكل</span>
                    </button>
                  </div>
                </div>

                {/* Real-time Interactive Stock Counters */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-200/80 text-xs">
                  <button
                    type="button"
                    onClick={() => setInventoryFilter("all")}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer touch-manipulation ${
                      inventoryFilter === "all" ? "bg-amber-500 text-slate-950 border-amber-500 font-extrabold shadow-2xs" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-bold"
                    }`}
                  >
                    <span className={`text-[10px] block font-bold ${inventoryFilter === "all" ? "text-slate-900" : "text-slate-500"}`}>جميع المنتجات</span>
                    <strong className="text-sm font-black">{totalProducts} منتج</strong>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInventoryFilter("inStock")}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer touch-manipulation ${
                      inventoryFilter === "inStock" ? "bg-emerald-600 text-white border-emerald-600 font-extrabold shadow-2xs" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-bold"
                    }`}
                  >
                    <span className={`text-[10px] block font-bold ${inventoryFilter === "inStock" ? "text-white/90" : "text-slate-500"}`}>متوفر بكثرة ✅</span>
                    <strong className="text-sm font-black">{inStockCount} منتج</strong>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInventoryFilter("lowStock")}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer touch-manipulation ${
                      inventoryFilter === "lowStock" ? "bg-amber-600 text-white border-amber-600 font-extrabold shadow-2xs" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-bold"
                    }`}
                  >
                    <span className={`text-[10px] block font-bold ${inventoryFilter === "lowStock" ? "text-white/90" : "text-slate-500"}`}>مخزون منخفض ⚠️</span>
                    <strong className="text-sm font-black">{lowStockCount} منتج</strong>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInventoryFilter("outOfStock")}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer touch-manipulation ${
                      inventoryFilter === "outOfStock" ? "bg-rose-600 text-white border-rose-600 font-extrabold shadow-2xs" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-bold"
                    }`}
                  >
                    <span className={`text-[10px] block font-bold ${inventoryFilter === "outOfStock" ? "text-white/90" : "text-slate-500"}`}>نفد المخزون ❌</span>
                    <strong className="text-sm font-black">{outOfStockCount} منتج</strong>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInventoryFilter("unlimited")}
                    className={`p-2.5 rounded-xl border text-right transition cursor-pointer touch-manipulation ${
                      inventoryFilter === "unlimited" ? "bg-sky-600 text-white border-sky-600 font-extrabold shadow-2xs" : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-bold"
                    }`}
                  >
                    <span className={`text-[10px] block font-bold ${inventoryFilter === "unlimited" ? "text-white/90" : "text-slate-500"}`}>كمية مفتوحة ♾️</span>
                    <strong className="text-sm font-black">{unlimitedCount} منتج</strong>
                  </button>
                </div>
              </div>

              {/* Global General Inventory Settings */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                <h5 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Settings className="w-4 h-4 text-amber-600" />
                  <span>إعدادات وقواعد المخزون العامة بالمتجر</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Enable Stock Management */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 block">تفعيل نظام المخزون التلقائي</span>
                      <span className="text-[10px] text-slate-500">خصم القطع تلقائياً عند إتمام الطلبات</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.enableStockManagement !== false}
                      onChange={(e) => handleConfigChange("enableStockManagement", e.target.checked)}
                      className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
                    />
                  </div>

                  {/* Allow Order When Out of Stock */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 block">السماح بالطلب عند نفاد المخزون</span>
                      <span className="text-[10px] text-slate-500">تمكين الشراء المسبق حتى لو كانت الكمية 0</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.allowOrdersWhenOutOfStock === true}
                      onChange={(e) => handleConfigChange("allowOrdersWhenOutOfStock", e.target.checked)}
                      className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
                    />
                  </div>

                  {/* Show Stock Badges to Customers */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 block">إظهار عداد الكمية للعملاء بالمتجر</span>
                      <span className="text-[10px] text-slate-500">عرض "متبقي 3 قطع فقط 🔥" بصفحة المنتج</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.showStockBadge !== false}
                      onChange={(e) => handleConfigChange("showStockBadge", e.target.checked)}
                      className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
                    />
                  </div>

                  {/* Warning Threshold */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 block">حد التنبيه الافتراضي لانخفاض المخزون</span>
                      <span className="text-[10px] text-slate-500">عدد القطع الذي يظهر عنده الشعار الأصفر</span>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={config.lowStockWarningThreshold ?? 5}
                      onChange={(e) => handleConfigChange("lowStockWarningThreshold", Number(e.target.value))}
                      className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-center font-bold font-mono text-xs text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Inventory Management Table / Product Stock Cards */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4 shadow-xs">
                {/* Search Bar Toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-amber-600" />
                    <h5 className="font-extrabold text-sm text-slate-900">جدول التحكم اليدوي المباشر بالمخزون والرموز (SKU)</h5>
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      placeholder="ابحث باسم المنتج، التصنيف، أو SKU..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition"
                    />
                    {inventorySearch && (
                      <button
                        onClick={() => setInventorySearch("")}
                        className="absolute left-3 top-2 text-slate-400 hover:text-slate-700 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Product Inventory Items List */}
                <div className="space-y-3.5 max-h-[600px] overflow-y-auto pr-1">
                  {filteredInventory.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 space-y-2">
                      <Package className="w-10 h-10 mx-auto text-slate-300" />
                      <h5 className="font-bold text-sm text-slate-800">لا توجد منتجات تطابق الفلتر أو كلمة البحث</h5>
                      <p className="text-xs text-slate-500">جرب مسح البحث أو تغيير تصفية الفلتر</p>
                      <button
                        type="button"
                        onClick={() => { setInventoryFilter("all"); setInventorySearch(""); }}
                        className="px-3.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs rounded-xl transition"
                      >
                        إعادة عرض الكل
                      </button>
                    </div>
                  ) : (
                    filteredInventory.map(({ product, originalIndex }) => {
                      const qty = product.stockQuantity ?? 10;
                      const isManaged = product.manageStock !== false;
                      const threshold = product.lowStockThreshold ?? defaultThreshold;
                      const isOut = isManaged && qty <= 0;
                      const isLow = isManaged && qty > 0 && qty <= threshold;

                      return (
                        <div
                          key={product.id}
                          className={`p-4 rounded-2xl border transition duration-200 space-y-3.5 ${
                            isOut
                              ? "bg-rose-50/40 border-rose-200 shadow-2xs"
                              : isLow
                              ? "bg-amber-50/30 border-amber-200 shadow-2xs"
                              : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                          }`}
                        >
                          {/* Row Top: Product Info & Live Status Badge */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xl">{getProductIconEmoji(product.imageKeyword)}</span>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h6 className="font-black text-xs sm:text-sm text-slate-900 truncate">{product.name || "منتج بدون اسم"}</h6>
                                  <span className="text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                    {product.category || "عام"}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                                  <span className="font-mono font-bold text-slate-800">{product.price} {config.currency}</span>
                                  <span>•</span>
                                  <span className="text-[10px] text-slate-400 font-mono">الترتيب بالممتلكات: #{originalIndex + 1}</span>
                                </div>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div className="shrink-0 self-end sm:self-center">
                              {!isManaged ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-sky-800 bg-sky-100 px-2.5 py-1 rounded-full border border-sky-200">
                                  <span>♾️ كمية مفتوحة غير محددة</span>
                                </span>
                              ) : isOut ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-800 bg-rose-100 px-2.5 py-1 rounded-full border border-rose-200 animate-pulse">
                                  <span>❌ نفد المخزون (0 قطعة)</span>
                                </span>
                              ) : isLow ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-900 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200">
                                  <span>⚠️ مخزون منخفض ({qty} متبقية)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                                  <span>✅ متوفر بنجاح ({qty} قطعة)</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Row Bottom: Manual Control Inputs Grid (Manual SKU + Mode + Threshold) */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
                            {/* 1. MANUAL SKU Symbol / Code Input */}
                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-700 mb-1 flex items-center gap-1">
                                <Tag className="w-3.5 h-3.5 text-amber-600" />
                                <span>رمز / كود المنتج (SKU) يدوي:</span>
                              </label>
                              <input
                                type="text"
                                value={product.sku || ""}
                                onChange={(e) => handleProductChange(originalIndex, "sku", e.target.value)}
                                placeholder="مثال: SKU-101 / PERF-01"
                                className="w-full min-h-[44px] bg-white border border-slate-300 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none transition touch-manipulation"
                              />
                            </div>

                            {/* 2. MANUAL Stock Tracking Mode Toggle */}
                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-700 mb-1">
                                طبيعة تتبع المخزون:
                              </label>
                              <select
                                value={isManaged ? "managed" : "unlimited"}
                                onChange={(e) => handleProductChange(originalIndex, "manageStock", e.target.value === "managed")}
                                className="w-full min-h-[44px] bg-white border border-slate-300 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none transition cursor-pointer touch-manipulation shadow-2xs"
                              >
                                <option value="managed">📦 محدودة بعدد قطع محدد</option>
                                <option value="unlimited">♾️ غير محددة / مفتوحة دائماً</option>
                              </select>
                            </div>

                            {/* 4. MANUAL Low Stock Alert Threshold for this product */}
                            <div>
                              <label className="block text-[10px] font-extrabold text-slate-700 mb-1">
                                حد التنبيه بالانخفاض:
                              </label>
                              <input
                                type="number"
                                min={1}
                                disabled={!isManaged}
                                value={product.lowStockThreshold ?? defaultThreshold}
                                onChange={(e) => handleProductChange(originalIndex, "lowStockThreshold", Math.max(1, Number(e.target.value)))}
                                className="w-full min-h-[44px] bg-white border border-slate-300 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-mono font-bold text-slate-800 text-center focus:outline-none transition disabled:opacity-50 touch-manipulation"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* --- CHECKOUT & PAYMENT CUSTOMIZATION TAB (تعديل إتمام الطلب والدفع) --- */}
        {activeTab === "checkout" && (() => {
          const coupons: Coupon[] = config.customCoupons || [
            { code: "WELCOME10", discountPercent: 10, active: true },
            { code: "SUMMER20", discountPercent: 20, active: true }
          ];

          const handleAddCoupon = (e: React.FormEvent) => {
            e.preventDefault();
            if (!newCouponCode.trim()) return;
            const codeClean = newCouponCode.trim().toUpperCase();
            const updated = [...coupons, { code: codeClean, discountPercent: Number(newCouponDiscount), active: true }];
            handleConfigChange("customCoupons", updated);
            setNewCouponCode("");
            setNewCouponDiscount(15);
          };

          const handleToggleCoupon = (index: number) => {
            const updated = [...coupons];
            updated[index].active = !updated[index].active;
            handleConfigChange("customCoupons", updated);
          };

          const handleDeleteCoupon = (index: number) => {
            const updated = coupons.filter((_, idx) => idx !== index);
            handleConfigChange("customCoupons", updated);
          };

          return (
            <div className="space-y-6 animate-fadeIn text-right">
              {/* Info Header */}
              <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-900 p-4.5 rounded-2xl text-white shadow-md space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-emerald-300 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-emerald-400" />
                      <span>تعديل وتخصيص صفحة إتمام الطلب ووسائل الدفع 💳</span>
                    </h4>
                    <p className="text-[11px] text-emerald-100/80 leading-relaxed max-w-xl">
                      خصص نصوص وملاحظات صفحة إتمام الطلب، حدد وسائل الدفع المتاحة، ورسوم الشحن والضرائب، بالإضافة لإدارة كوبونات الخصم ورسالة الشكر المخصصة.
                    </p>
                  </div>

                  {onOpenCheckoutPreview && (
                    <button
                      type="button"
                      onClick={onOpenCheckoutPreview}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer shrink-0"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>معاينة وتجربة نافذة الدفع مباشرة 🛒</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 1. Page Title & Notice Banner */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h5 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>عناوين وتنبيهات صفحة الدفع</span>
                </h5>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">عنوان صفحة الشراء والدفع الرئيسي</label>
                    <input
                      type="text"
                      value={config.checkoutTitle || "إتمام الطلب الشراء والدفع"}
                      onChange={(e) => handleConfigChange("checkoutTitle", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">الوصف الفرعي</label>
                    <input
                      type="text"
                      value={config.checkoutSubtitle || "أدخل بيانات التوصيل واختر طريقة الدفع المناسبة لك"}
                      onChange={(e) => handleConfigChange("checkoutSubtitle", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">شريط التنبيه والمميزات أعلى صفحة الدفع</label>
                    <input
                      type="text"
                      value={config.checkoutNotice || "توصيل سريع وآمن لجميع مناطق المملكة والخليج العربي 🚚⚡"}
                      onChange={(e) => handleConfigChange("checkoutNotice", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Shipping, Taxes & Minimum Order */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h5 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span>رسوم الشحن، الضرائب، والحد الأدنى للطلب</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">رسوم الشحن القياسية ({config.currency})</label>
                    <input
                      type="number"
                      min={0}
                      value={config.shippingFee ?? 0}
                      onChange={(e) => handleConfigChange("shippingFee", Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                      placeholder="0 (شحن مجاني)"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">الحد الأدنى للشحن المجاني ({config.currency})</label>
                    <input
                      type="number"
                      min={0}
                      value={config.freeShippingThreshold ?? 250}
                      onChange={(e) => handleConfigChange("freeShippingThreshold", Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">نسبة ضريبة القيمة المضافة (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={config.taxRate ?? 15}
                      onChange={(e) => handleConfigChange("taxRate", Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">الحد الأدنى لقيمة الطلب ({config.currency})</label>
                    <input
                      type="number"
                      min={0}
                      value={config.minOrderAmount ?? 0}
                      onChange={(e) => handleConfigChange("minOrderAmount", Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Payment Methods Control */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5">
                <h5 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <span>تفعيل وتخصيص وسائل الدفع المتاحة</span>
                </h5>

                <div className="space-y-3 text-xs">
                  {/* Cash on Delivery */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">💵</span>
                        <div>
                          <span className="font-bold text-slate-900 block">الدفع عند الاستلام (Cash on Delivery)</span>
                          <span className="text-[10px] text-slate-500">يدفع الزبون نقداً لمندوب الشحن فور التوصيل</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.enableCashOnDelivery !== false}
                        onChange={(e) => handleConfigChange("enableCashOnDelivery", e.target.checked)}
                        className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                      />
                    </div>

                    {config.enableCashOnDelivery !== false && (
                      <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-600">رسوم إضافية للدفع عند الاستلام:</label>
                        <input
                          type="number"
                          min={0}
                          value={config.cashOnDeliveryFee ?? 10}
                          onChange={(e) => handleConfigChange("cashOnDeliveryFee", Number(e.target.value))}
                          className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold"
                        />
                        <span className="text-[10px] text-slate-400">{config.currency}</span>
                      </div>
                    )}
                  </div>

                  {/* Bank Transfer & Wallets */}
                  <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🏦</span>
                        <div>
                          <span className="font-bold text-slate-900 block">التحويل البنكي / المحافظ المباشرة</span>
                          <span className="text-[10px] text-slate-500">عرض الحسابات البنكية والآيبان لإيداع الزبون مباشرة</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.enableBankTransfer !== false}
                        onChange={(e) => handleConfigChange("enableBankTransfer", e.target.checked)}
                        className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                      />
                    </div>

                    {config.enableBankTransfer !== false && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">اسم البنك / المحفظة</label>
                          <input
                            type="text"
                            value={config.bankName || "بنك الراجحي"}
                            onChange={(e) => handleConfigChange("bankName", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">اسم صاحب الحساب الرسمي</label>
                          <input
                            type="text"
                            value={config.bankAccountName || config.storeName}
                            onChange={(e) => handleConfigChange("bankAccountName", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">رقم الحساب البنكي / رقم المحفظة</label>
                          <input
                            type="text"
                            value={config.bankAccountNumber || "123456789012"}
                            onChange={(e) => handleConfigChange("bankAccountNumber", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">رقم الآيبان (IBAN)</label>
                          <input
                            type="text"
                            value={config.bankIban || "SA9480000000123456789012"}
                            onChange={(e) => handleConfigChange("bankIban", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cards, Apple Pay & STC Pay */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">مدى وفيزا 💳</span>
                      <input
                        type="checkbox"
                        checked={config.enableOnlineCard !== false}
                        onChange={(e) => handleConfigChange("enableOnlineCard", e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                      />
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">أبل باي Apple Pay 🍏</span>
                      <input
                        type="checkbox"
                        checked={config.enableApplePay !== false}
                        onChange={(e) => handleConfigChange("enableApplePay", e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                      />
                    </div>

                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-[11px]">STC Pay 📲</span>
                      <input
                        type="checkbox"
                        checked={config.enableStcPay !== false}
                        onChange={(e) => handleConfigChange("enableStcPay", e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3.5. Custom Electronic Wallets Management (إدارة المحافظ الإلكترونية) */}
              {(() => {
                const walletsList: EWallet[] = config.customWallets || [
                  {
                    id: "w-stc",
                    name: "محفظة STC Pay / urpay",
                    accountNumber: "0501234567",
                    accountName: config.storeName || "المتجر الرسمي",
                    icon: "📱",
                    badge: "دفع فوري ⚡",
                    active: true,
                    bgColor: "bg-purple-50/80 border-purple-200/90 text-purple-900"
                  },
                  {
                    id: "w-kuraimi",
                    name: "محفظة الكريمي إكسبرس (Kuraimi)",
                    accountNumber: "30678912",
                    accountName: config.storeName || "المتجر الرسمي",
                    icon: "🏦",
                    badge: "الأكثر شيوعاً واستخداماً 🔥",
                    active: true,
                    bgColor: "bg-blue-50/80 border-blue-200/90 text-blue-900"
                  },
                  {
                    id: "w-jawali",
                    name: "محفظة جوالي (Jawali Wallet)",
                    accountNumber: "770123456",
                    accountName: config.storeName || "المتجر الرسمي",
                    icon: "📱",
                    badge: "إيداع فوري ⚡",
                    active: true,
                    bgColor: "bg-emerald-50/80 border-emerald-200/90 text-emerald-900"
                  },
                  {
                    id: "w-onecash",
                    name: "محفظة ون كاش (OneCash)",
                    accountNumber: "779876543",
                    accountName: config.storeName || "المتجر الرسمي",
                    icon: "💸",
                    badge: "تحويل مباشر وآمن 🔒",
                    active: true,
                    bgColor: "bg-purple-50/80 border-purple-200/90 text-purple-900"
                  },
                  {
                    id: "w-floos",
                    name: "محفظة فلوس / جيب (Floos / Pocket)",
                    accountNumber: "771122334",
                    accountName: config.storeName || "المتجر الرسمي",
                    icon: "👛",
                    badge: "سريع ومباشر 🚀",
                    active: true,
                    bgColor: "bg-amber-50/80 border-amber-200/90 text-amber-900"
                  }
                ];

                const handleAddWallet = (e: React.FormEvent) => {
                  e.preventDefault();
                  if (!newWalletName.trim() || !newWalletNumber.trim()) return;

                  const newWalletObj: EWallet = {
                    id: `w-${Date.now()}`,
                    name: newWalletName.trim(),
                    accountNumber: newWalletNumber.trim(),
                    accountName: newWalletHolder.trim() || config.storeName || "المتجر الرسمي",
                    icon: newWalletIcon || "📱",
                    badge: newWalletBadge.trim() || "إيداع مباشر ⚡",
                    active: true,
                    bgColor: "bg-slate-50 border-slate-200 text-slate-800"
                  };

                  const updated = [...walletsList, newWalletObj];
                  handleConfigChange("customWallets", updated);
                  setNewWalletName("");
                  setNewWalletNumber("");
                  setNewWalletHolder("");
                };

                const handleToggleWallet = (id: string) => {
                  const updated = walletsList.map(w => w.id === id ? { ...w, active: !w.active } : w);
                  handleConfigChange("customWallets", updated);
                };

                const handleDeleteWallet = (id: string) => {
                  const updated = walletsList.filter(w => w.id !== id);
                  handleConfigChange("customWallets", updated);
                };

                const handleStartEditWallet = (wallet: EWallet) => {
                  setEditingWalletId(wallet.id);
                  setEditWalletName(wallet.name);
                  setEditWalletNumber(wallet.accountNumber);
                  setEditWalletHolder(wallet.accountName || "");
                  setEditWalletBadge(wallet.badge || "");
                  setEditWalletIcon(wallet.icon || "📱");
                };

                const handleSaveEditWallet = (id: string) => {
                  if (!editWalletName.trim() || !editWalletNumber.trim()) return;
                  const updated = walletsList.map(w => w.id === id ? {
                    ...w,
                    name: editWalletName.trim(),
                    accountNumber: editWalletNumber.trim(),
                    accountName: editWalletHolder.trim() || config.storeName || "المتجر الرسمي",
                    badge: editWalletBadge.trim(),
                    icon: editWalletIcon || "📱"
                  } : w);
                  handleConfigChange("customWallets", updated);
                  setEditingWalletId(null);
                };

                return (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <h5 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-emerald-600" />
                        <span>إدارة المحافظ الإلكترونية والتطبيقات المالية 📲💸</span>
                      </h5>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <span className="text-[10px] font-bold text-slate-600">تفعيل خيار المحافظ</span>
                        <input
                          type="checkbox"
                          checked={config.enableEWallets !== false}
                          onChange={(e) => handleConfigChange("enableEWallets", e.target.checked)}
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                        />
                      </label>
                    </div>

                    {config.enableEWallets !== false && (
                      <div className="space-y-4 text-xs">
                        {/* Form to add a new custom wallet */}
                        <form onSubmit={handleAddWallet} className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                          <h6 className="font-extrabold text-[11px] text-slate-800 flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5 text-emerald-600" />
                            <span>إضافة محفظة إلكترونية جديدة</span>
                          </h6>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">اسم المحفظة / التطبيق *</label>
                              <input
                                type="text"
                                placeholder="مثال: محفظة STC Pay / الكريمي / Instapay"
                                value={newWalletName}
                                onChange={(e) => setNewWalletName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">رقم الحساب / الجوال للإيداع *</label>
                              <input
                                type="text"
                                placeholder="مثال: 0501234567 أو 30678912"
                                value={newWalletNumber}
                                onChange={(e) => setNewWalletNumber(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800"
                                required
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">اسم صاحب المحفظة / المتجر</label>
                              <input
                                type="text"
                                placeholder={config.storeName || "اسم المستفيد"}
                                value={newWalletHolder}
                                onChange={(e) => setNewWalletHolder(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">الشعار / العبارة الترويجية</label>
                              <input
                                type="text"
                                placeholder="مثال: تحويل فوري ⚡"
                                value={newWalletBadge}
                                onChange={(e) => setNewWalletBadge(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                              />
                            </div>
                          </div>

                          {/* Icon Selector */}
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[10px] font-bold text-slate-600 shrink-0">أيقونة المحفظة:</span>
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                              {["📱", "🏦", "💸", "👛", "💳", "⚡", "📲", "💎", "🏛️"].map((ic) => (
                                <button
                                  type="button"
                                  key={ic}
                                  onClick={() => setNewWalletIcon(ic)}
                                  className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition cursor-pointer border ${
                                    newWalletIcon === ic ? "bg-emerald-100 border-emerald-500 scale-110 shadow-2xs" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  {ic}
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={!newWalletName.trim() || !newWalletNumber.trim()}
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Plus className="w-4 h-4" />
                            <span>حفظ وإضافة المحفظة إلى وسائل الدفع ➕</span>
                          </button>
                        </form>

                        {/* List of custom wallets */}
                        <div className="space-y-2">
                          <h6 className="font-bold text-[11px] text-slate-700">المحافظ المتاحة حالياً ({walletsList.length}):</h6>
                          <div className="space-y-2 max-h-80 overflow-y-auto pl-1">
                            {walletsList.map((wallet) => {
                              const isEditingThis = editingWalletId === wallet.id;

                              if (isEditingThis) {
                                return (
                                  <div key={wallet.id} className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2.5 text-[11px] animate-fadeIn">
                                    <div className="flex items-center justify-between font-bold text-amber-900 border-b border-amber-200/80 pb-1.5">
                                      <span>تعديل بيانات المحفظة ✏️</span>
                                      <button
                                        type="button"
                                        onClick={() => setEditingWalletId(null)}
                                        className="text-[10px] text-slate-500 hover:text-slate-800"
                                      >
                                        إلغاء ✖️
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">اسم المحفظة / التطبيق *</label>
                                        <input
                                          type="text"
                                          value={editWalletName}
                                          onChange={(e) => setEditWalletName(e.target.value)}
                                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                                          required
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">رقم الحساب / الجوال للإيداع *</label>
                                        <input
                                          type="text"
                                          value={editWalletNumber}
                                          onChange={(e) => setEditWalletNumber(e.target.value)}
                                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800"
                                          required
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">اسم صاحب المحفظة / المستفيد</label>
                                        <input
                                          type="text"
                                          value={editWalletHolder}
                                          onChange={(e) => setEditWalletHolder(e.target.value)}
                                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                                        />
                                      </div>

                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">العبارة الترويجية / الشعار</label>
                                        <input
                                          type="text"
                                          value={editWalletBadge}
                                          onChange={(e) => setEditWalletBadge(e.target.value)}
                                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                                        />
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-1">
                                      <span className="text-[10px] font-bold text-slate-600 shrink-0">الأيقونة:</span>
                                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                                        {["📱", "🏦", "💸", "👛", "💳", "⚡", "📲", "💎", "🏛️"].map((ic) => (
                                          <button
                                            type="button"
                                            key={ic}
                                            onClick={() => setEditWalletIcon(ic)}
                                            className={`w-6 h-6 rounded text-xs flex items-center justify-center transition border ${
                                              editWalletIcon === ic ? "bg-amber-200 border-amber-500 scale-105" : "bg-white border-slate-200"
                                            }`}
                                          >
                                            {ic}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/80">
                                      <button
                                        type="button"
                                        onClick={() => setEditingWalletId(null)}
                                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] rounded-lg transition"
                                      >
                                        إلغاء
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditWallet(wallet.id)}
                                        className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded-lg transition flex items-center gap-1 shadow-xs cursor-pointer"
                                      >
                                        <Save className="w-3.5 h-3.5" />
                                        <span>حفظ التعديلات ✅</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={wallet.id}
                                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                                    wallet.active !== false ? "bg-white border-slate-200 shadow-2xs" : "bg-slate-100/70 border-slate-200 opacity-60"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-xl shrink-0">{wallet.icon || "📱"}</span>
                                    <div className="min-w-0 text-right">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-black text-xs text-slate-900 truncate">{wallet.name}</span>
                                        {wallet.badge && (
                                          <span className="bg-amber-100 text-amber-900 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-amber-200">
                                            {wallet.badge}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                        <span>رقم الإيداع: <strong className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">{wallet.accountNumber}</strong></span>
                                        {wallet.accountName && <span>• المستفيد: <span className="text-slate-700">{wallet.accountName}</span></span>}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditWallet(wallet)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 border border-blue-200/60 rounded-lg transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                                      title="تعديل رقم الحساب أو المحفظة"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">تعديل</span>
                                    </button>

                                    <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold text-slate-600 px-1">
                                      <input
                                        type="checkbox"
                                        checked={wallet.active !== false}
                                        onChange={() => handleToggleWallet(wallet.id)}
                                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                                      />
                                      <span>{wallet.active !== false ? "مفعلة" : "معطلة"}</span>
                                    </label>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteWallet(wallet.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                      title="حذف المحفظة"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 4. Custom Coupons Management */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h5 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-emerald-600" />
                    <span>إدارة كوبونات الخصم والتخفيضات 🎟️</span>
                  </h5>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <span className="text-[10px] font-bold text-slate-600">تفعيل الكوبونات</span>
                    <input
                      type="checkbox"
                      checked={config.enableCoupons !== false}
                      onChange={(e) => handleConfigChange("enableCoupons", e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </label>
                </div>

                {config.enableCoupons !== false && (
                  <div className="space-y-3 text-xs">
                    {/* Add Coupon Form */}
                    <form onSubmit={handleAddCoupon} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                      <input
                        type="text"
                        placeholder="رمز الكود (مثال: PROMO20)"
                        value={newCouponCode}
                        onChange={(e) => setNewCouponCode(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono uppercase font-bold text-xs"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={newCouponDiscount}
                          onChange={(e) => setNewCouponDiscount(Number(e.target.value))}
                          className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-center font-bold font-mono text-xs"
                        />
                        <span className="font-bold text-slate-500">%</span>
                      </div>
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg transition shadow-xs text-xs flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة كود</span>
                      </button>
                    </form>

                    {/* Active Coupons List */}
                    <div className="space-y-1.5">
                      {coupons.map((coupon, idx) => (
                        <div key={coupon.code + idx} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                              {coupon.code}
                            </span>
                            <span className="font-bold text-slate-700">خصم {coupon.discountPercent}%</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleCoupon(idx)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                coupon.active ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}
                            >
                              {coupon.active ? "مفعل ✅" : "معطل ⏸️"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCoupon(idx)}
                              className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Post-Purchase Customization */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h5 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Gift className="w-4 h-4 text-emerald-600" />
                  <span>رسالة الشكر المخصصة بعد النجاح وإشعار الواتساب</span>
                </h5>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">عنوان شاشة الشكر والتأكيد</label>
                    <input
                      type="text"
                      value={config.thankYouTitle || "شكراً لطلبك! تم استلام طلبك بنجاح 🎉"}
                      onChange={(e) => handleConfigChange("thankYouTitle", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">رسالة التفاصيل للشاشة الأخيرة</label>
                    <textarea
                      rows={2}
                      value={config.thankYouMessage || "سنقوم بتجهيز طلبك وشحنه فوراً، ويمكنك متابعة الطلب أو إرسال الفاتورة عبر الواتساب."}
                      onChange={(e) => handleConfigChange("thankYouMessage", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-800 text-[11px]">إتاحة زر إرسال فاتورة الطلب المباشرة عبر الواتساب 💬</span>
                    <input
                      type="checkbox"
                      checked={config.enableWhatsAppNotification !== false}
                      onChange={(e) => handleConfigChange("enableWhatsAppNotification", e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* --- PAGES CUSTOMIZATION TAB --- */}
        {activeTab === "pages" && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-1">
              <h4 className="font-bold text-indigo-900 text-xs flex items-center gap-1.5">
                <Info className="w-4 h-4 text-indigo-600" />
                <span>تعديل نصوص وصفحات المتجر (من نحن & تواصل معنا)</span>
              </h4>
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                يمكنك تخصيص كل كلمة وصفحة في قالبك! عدّل قصة متجرك ورؤيتك، وكذلك جميع وسائل الاتصال والعناوين وساعات العمل لترسخ ثقة عملائك.
              </p>
            </div>

            {/* SECTION 1: ABOUT US CUSTOMIZATION */}
            <div className="space-y-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                <span className="text-base">📖</span>
                <h5 className="text-xs font-black text-slate-800">تخصيص صفحة (من نحن / عن المتجر)</h5>
              </div>

              {/* About Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">عنوان الصفحة أو الفقرة الرئيسية</label>
                <input
                  type="text"
                  value={config.aboutTitle || ""}
                  onChange={(e) => handleConfigChange("aboutTitle", e.target.value)}
                  placeholder="مثال: قصة لورين للعطور - فخامة العبق الشرقي"
                  className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              {/* About Text */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">قصة وشغف المتجر (الوصف التفصيلي)</label>
                <textarea
                  rows={3}
                  value={config.aboutText || ""}
                  onChange={(e) => handleConfigChange("aboutText", e.target.value)}
                  placeholder="اكتب هنا قصة تأسيس متجرك، ماذا يميزكم وما القيمة التي تقدمونها للعملاء..."
                  className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none leading-relaxed"
                />
              </div>

              {/* About Vision */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">الرؤية والرسالة والهدف</label>
                <textarea
                  rows={2}
                  value={config.aboutVision || ""}
                  onChange={(e) => handleConfigChange("aboutVision", e.target.value)}
                  placeholder="مثال: نسعى لنكون الخيار الأول لعشاق الأناقة والابتكار في الخليج..."
                  className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none leading-relaxed"
                />
              </div>

              {/* About Image Uploader / URL */}
              <div className="space-y-2 pt-2 border-t border-slate-200/60">
                <label className="block text-xs font-bold text-slate-700">صورة صفحة (من نحن) الرسمية 🖼️</label>
                
                {/* File Uploader */}
                <div className="relative border-2 border-dashed border-slate-200 hover:border-indigo-400 transition rounded-xl p-3 bg-white text-center cursor-pointer group/aboutimg">
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          alert("حجم الصورة كبير! يرجى اختيار ملف أصغر من 2 ميجابايت.");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === "string") {
                            handleConfigChange("aboutImage", reader.result);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Upload className="w-5 h-5 text-indigo-500 group-hover/aboutimg:scale-110 transition" />
                    <span className="text-[11px] font-extrabold text-slate-600 group-hover/aboutimg:text-indigo-700">رفع صورة خاصة من جهازك</span>
                    <span className="text-[9px] text-slate-400">تدعم JPG, PNG, WEBP</span>
                  </div>
                </div>

                {/* Direct Image URL input */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">أو أدخل رابط صورة مباشر (URL):</span>
                  <input
                    type="text"
                    value={config.aboutImage?.startsWith("data:") ? "صورة مخصصة مرفوعة محلياً 📂" : (config.aboutImage || "")}
                    disabled={config.aboutImage?.startsWith("data:")}
                    onChange={(e) => handleConfigChange("aboutImage", e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                {/* Image Presets */}
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-400 font-bold block">أو اختر صورة جاهزة تناسب متجرك:</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { name: "عطور وفاخر", url: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?auto=format&fit=crop&w=800&q=80" },
                      { name: "تقنية وعملي", url: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80" },
                      { name: "متجر وأثاث", url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80" }
                    ].map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() => handleConfigChange("aboutImage", preset.url)}
                        className={`p-1.5 rounded-lg border text-[10px] font-bold text-center transition ${
                          config.aboutImage === preset.url
                            ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: CONTACT US CUSTOMIZATION */}
            <div className="space-y-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                <span className="text-base">📞</span>
                <h5 className="text-xs font-black text-slate-800">تخصيص بيانات صفحة (تواصل معنا)</h5>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">البريد الإلكتروني المباشر</label>
                <input
                  type="email"
                  value={config.email || ""}
                  onChange={(e) => handleConfigChange("email", e.target.value)}
                  placeholder="support@yourdomain.com"
                  className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              {/* WhatsApp number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">رقم الواتساب المباشر (مع الرمز الدولي)</label>
                <input
                  type="text"
                  value={config.whatsapp || ""}
                  onChange={(e) => handleConfigChange("whatsapp", e.target.value)}
                  placeholder="+966500000000"
                  className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">العنوان والموقع الجغرافي للمقر أو المستودع</label>
                <input
                  type="text"
                  value={config.address || ""}
                  onChange={(e) => handleConfigChange("address", e.target.value)}
                  placeholder="الرياض، طريق الملك فهد - المملكة العربية السعودية"
                  className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>

              {/* Working Hours */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">أوقات وساعات العمل والرد على الاستفسارات</label>
                <input
                  type="text"
                  value={config.workingHours || ""}
                  onChange={(e) => handleConfigChange("workingHours", e.target.value)}
                  placeholder="السبت - الخميس: 9:00 صباحاً - 11:00 مساءً"
                  className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            {/* SECTION 3: SOCIAL MEDIA HANDLES */}
            <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                <span className="text-base">🌐</span>
                <h5 className="text-xs font-black text-slate-800">حسابات التواصل الاجتماعي (تظهر في التذييل)</h5>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">انستغرام (Instagram)</label>
                  <input
                    type="text"
                    value={config.instagram || ""}
                    onChange={(e) => handleConfigChange("instagram", e.target.value)}
                    placeholder="اسم الحساب"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">تويتر / X</label>
                  <input
                    type="text"
                    value={config.twitter || ""}
                    onChange={(e) => handleConfigChange("twitter", e.target.value)}
                    placeholder="اسم الحساب"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">تيك توك (TikTok)</label>
                  <input
                    type="text"
                    value={config.tiktok || ""}
                    onChange={(e) => handleConfigChange("tiktok", e.target.value)}
                    placeholder="اسم الحساب"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">سناب شات (Snapchat)</label>
                  <input
                    type="text"
                    value={config.snapchat || ""}
                    onChange={(e) => handleConfigChange("snapchat", e.target.value)}
                    placeholder="اسم الحساب"
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- AI ASSISTANT / COPYWRITER TAB --- */}
        {activeTab === "ai" && (
          <div className="space-y-5 animate-fadeIn">
            <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 space-y-1">
              <h4 className="font-bold text-sky-800 text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>مساعد المحتوى والكتابة الإبداعية</span>
              </h4>
              <p className="text-[11px] text-sky-600 leading-relaxed">
                هل تواجه صعوبة في كتابة شعارات تسويقية أو عروض إعلانية جذابة؟ اكتب فكرتك أو المنتج، وسيقوم مساعدنا الذكي باقتراح أفكار فورية لتستعملها فوراً!
              </p>
            </div>

            <form onSubmit={triggerCopyWrite} className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">عن ماذا تود الكتابة؟</label>
                <input
                  type="text"
                  value={assistantPrompt}
                  onChange={(e) => setAssistantPrompt(e.target.value)}
                  placeholder="مثال: بخور العود الأزرق الملكي الفاخر..."
                  className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 rounded-xl px-4 py-3 text-sm focus:outline-none transition text-slate-800"
                />
              </div>
              <button
                type="submit"
                disabled={isGeneratingCopy || !assistantPrompt.trim()}
                className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black py-3 min-h-[44px] rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer touch-manipulation disabled:opacity-50"
              >
                {isGeneratingCopy ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري تفعيل الإبداع...</span>
                  </>
                ) : (
                  <>
                    <span>اقترح لي نصوصاً إبداعية ✨</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {copyOutput && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 text-xs animate-fadeIn">
                <div className="space-y-1">
                  <span className="font-extrabold text-[10px] text-sky-600 uppercase block">اقتراح الشعار (Slogan):</span>
                  <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-100 font-semibold leading-relaxed">
                    "{copyOutput.slogan}"
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="font-extrabold text-[10px] text-sky-600 uppercase block">عرض ترويجي للإعلان:</span>
                  <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed">
                    "{copyOutput.banner}"
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="font-extrabold text-[10px] text-sky-600 uppercase block">وصف تسويقي للمنتج الأول:</span>
                  <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed text-[11px]">
                    "{copyOutput.productDesc}"
                  </p>
                </div>

                <p className="text-[10px] text-slate-400 text-center">
                  * انسخ أي نص وألصقه في علامات تبويب "معلومات المتجر" أو "المنتجات" لتراه يظهر فوراً!
                </p>
              </div>
            )}
          </div>
        )}

        {/* --- STORE ACTIVATION & SUBDOMAIN REQUEST TAB --- */}
        {activeTab === "export" && (
          <div className="space-y-5 animate-fadeIn">
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-l from-indigo-50 to-sky-50 p-5">
              <h4 className="flex items-center gap-2 text-sm font-black text-indigo-950"><Sparkles className="h-5 w-5 text-indigo-600" /> إرسال طلب المتجر الحقيقي</h4>
              <p className="mt-2 text-xs leading-relaxed text-indigo-800">ستفتح نافذة متصلة بالخادم لاختيار عنوان متاح وباقة فعلية. إرسال الطلب يحجز العنوان ويضع المتجر للمراجعة فقط؛ تجهيز قاعدة البيانات والنشر عمليتان لاحقتان محميتان.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">ملخص التصميم الحالي</span>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <h5 className="text-sm font-extrabold text-slate-900">{config.storeName}</h5>
                  <p className="text-xs text-slate-500">{config.slogan}</p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{config.products.length} منتج</span>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">رفع مستندات التحقق، الدفع الإلكتروني، والنطاقات الخارجية ليست مفعلة في هذه المرحلة ولن تدّعي الواجهة نجاحها.</div>
            <button type="button" onClick={() => onOpenDomainModal?.()} disabled={!onOpenDomainModal} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-600 via-sky-600 to-indigo-600 px-6 py-4 text-sm font-extrabold text-white shadow-lg disabled:opacity-50">
              <Sparkles className="h-5 w-5" /> اختيار العنوان والباقة وإرسال الطلب
            </button>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar for Finishing Customization */}
      {activeTab !== "export" && (
        <div className="p-3 bg-slate-50/90 backdrop-blur-xs border-t border-slate-200 shrink-0 shadow-lg flex items-center justify-between gap-2">
          <div className="text-[11px] text-slate-600 font-bold flex items-center gap-1.5 min-w-0 truncate">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">هل انتهيت من تعديل القالب والمنتجات؟</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onOpenDomainModal) {
                onOpenDomainModal();
              } else {
                setActiveTab("export");
              }
            }}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md hover:shadow-emerald-600/30 transition flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
          >
            <span>تم الانتهاء من التخصيص 🚀</span>
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
