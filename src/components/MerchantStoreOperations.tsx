import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Boxes,
  Copy,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Palette,
  RefreshCw,
  Settings2,
  ShoppingBag,
  Store,
} from "lucide-react";
import type { StoreSubmission, UserProfile } from "../adapters/uiAdapters";
import { useUiAdapters } from "../adapters/UiAdaptersContext";
import { isUiError, uiErrorMessage } from "../contracts/uiError";
import type { MerchantStoreSection } from "../app/centralNavigation";
import { publicStoreUrl } from "../utils/publicStoreUrl";
import MerchantCatalogPanel from "./MerchantCatalogPanel";
import MerchantInventoryPanel from "./MerchantInventoryPanel";
import MerchantOrdersWorkspace from "./MerchantOrdersWorkspace";
import { deriveMerchantLifecycle } from "../features/merchant/lifecycle";
import SkipLink from "./SkipLink";

interface MerchantStoreOperationsProps {
  user: UserProfile;
  store: StoreSubmission | null;
  section: MerchantStoreSection;
  onBack: () => void;
  onNavigate: (section: MerchantStoreSection) => void;
  onOpenBuilder: (section: Extract<MerchantStoreSection, "products" | "design" | "checkout" | "pages">) => void;
  onPublish: (store: StoreSubmission) => Promise<void>;
  onUnpublish: (store: StoreSubmission) => Promise<void>;
  onCopyPublicUrl: (url: string) => void;
  onLogout: () => void;
  onSessionExpired: () => void;
}

type MetricState = { value: number | null; loading: boolean; error: string | null; unavailable: boolean };
const emptyMetric = (): MetricState => ({ value: null, loading: false, error: null, unavailable: false });

function useOperationsSnapshot(store: StoreSubmission | null, active: boolean, onSessionExpired: () => void) {
  const { catalog, inventory, orders } = useUiAdapters();
  const [products, setProducts] = useState<MetricState>(emptyMetric);
  const [ordersMetric, setOrdersMetric] = useState<MetricState>(emptyMetric);
  const [lowStock, setLowStock] = useState<MetricState>(emptyMetric);
  const sequence = useRef(0);
  const sessionExpired = useRef(onSessionExpired);
  sessionExpired.current = onSessionExpired;

  useEffect(() => {
    const operation = ++sequence.current;
    const controller = new AbortController();
    const exactStore = store;
    setProducts(emptyMetric());
    setOrdersMetric(emptyMetric());
    setLowStock(emptyMetric());
    if (!exactStore || !active) return () => controller.abort();

    const settle = async (
      enabled: boolean,
      setMetric: React.Dispatch<React.SetStateAction<MetricState>>,
      request: () => Promise<number>,
    ) => {
      if (!enabled) {
        setMetric({ value: null, loading: false, error: null, unavailable: true });
        return;
      }
      setMetric({ value: null, loading: true, error: null, unavailable: false });
      try {
        const value = await request();
        if (operation === sequence.current) setMetric({ value, loading: false, error: null, unavailable: false });
      } catch (caught) {
        if (operation !== sequence.current || isUiError(caught, "aborted")) return;
        if (isUiError(caught, "unauthenticated")) {
          sessionExpired.current();
          return;
        }
        setMetric({ value: null, loading: false, error: uiErrorMessage(caught, "البيان غير متاح حاليًا."), unavailable: false });
      }
    };

    void settle(true, setProducts, async () => (await catalog.load(exactStore.id, controller.signal)).products.filter((product) => product.status !== "archived").length);
    void settle(exactStore.capabilities.ordersView, setOrdersMetric, async () => (await orders.list(exactStore.id, controller.signal)).total);
    void settle(exactStore.capabilities.inventoryView, setLowStock, async () => (await inventory.load(exactStore.id, controller.signal)).filter((item) => item.manageStock && (item.available ?? 0) <= item.lowStockThreshold).length);

    return () => { sequence.current += 1; controller.abort(); };
  }, [active, catalog, inventory, orders, store]);

  return { products, orders: ordersMetric, lowStock };
}

function MetricCard({ label, metric, icon: Icon }: { label: string; metric: MetricState; icon: React.ComponentType<{ className?: string }> }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon className="mb-3 h-5 w-5 text-sky-600" /><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{metric.loading ? "…" : metric.value ?? "—"}</p>{metric.unavailable && <p className="mt-1 text-[10px] font-bold text-slate-400">غير متاح لصلاحيات الحساب</p>}{metric.error && <p role="alert" className="mt-1 text-[10px] font-bold text-rose-600">تعذر تحميل البطاقة</p>}</div>;
}

export default function MerchantStoreOperations({
  user,
  store,
  section,
  onBack,
  onNavigate,
  onOpenBuilder,
  onPublish,
  onUnpublish,
  onCopyPublicUrl,
  onLogout,
  onSessionExpired,
}: MerchantStoreOperationsProps) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const operational = store?.verificationStatus === "approved" && store.provisioningStatus === "active";
  const metrics = useOperationsSnapshot(store, Boolean(operational) && section === "overview", onSessionExpired);
  const lifecycle = store ? deriveMerchantLifecycle(store) : null;
  const publicUrl = useMemo(() => {
    if (!store?.publicDomain || store.publicationStatus !== "published") return null;
    try { return publicStoreUrl(store.publicDomain); } catch { return null; }
  }, [store]);

  if (!store) {
    return <div dir="rtl" className="min-h-screen bg-slate-50 p-6"><div className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm"><Store className="mx-auto mb-4 h-10 w-10 text-rose-500" /><h1 className="text-xl font-black">المتجر غير متاح لهذا الحساب</h1><p className="mt-2 text-sm leading-7 text-slate-500">قد يكون الرابط غير صحيح أو لم تعد عضويتك في هذا المتجر فعالة.</p><button type="button" onClick={onBack} className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">العودة إلى متاجري</button></div></div>;
  }

  const modules: Array<{ section: MerchantStoreSection; label: string; description: string; icon: typeof Store; enabled: boolean; builder?: boolean }> = [
    { section: "overview", label: "نظرة عامة", description: "حالة المتجر والملخص التشغيلي", icon: LayoutDashboard, enabled: true },
    { section: "products", label: "المنتجات", description: "الكتالوج والأسعار وحالة النشر", icon: Package, enabled: Boolean(operational) },
    { section: "orders", label: "الطلبات", description: "الطلبات وانتقالاتها المسموحة", icon: ShoppingBag, enabled: Boolean(operational && store.capabilities.ordersView) },
    { section: "inventory", label: "المخزون", description: "الرصيد والحجوزات وحركات التسوية", icon: Boxes, enabled: Boolean(operational && store.capabilities.inventoryView) },
    { section: "design", label: "التصميم والهوية", description: "الشعار والألوان وواجهة المتجر", icon: Palette, enabled: Boolean(operational && store.capabilities.workspaceManage), builder: true },
    { section: "checkout", label: "الدفع والطلب", description: "الشحن والضرائب ووسائل الدفع", icon: Settings2, enabled: Boolean(operational && store.capabilities.workspaceManage), builder: true },
    { section: "pages", label: "صفحات المتجر", description: "من نحن والتواصل ومحتوى الصفحات", icon: FileText, enabled: Boolean(operational && store.capabilities.workspaceManage), builder: true },
  ];

  const navigate = (module: typeof modules[number]) => {
    if (!module.enabled) return;
    if (module.builder && module.section !== "overview" && module.section !== "orders" && module.section !== "inventory") {
      onOpenBuilder(module.section as "products" | "design" | "checkout" | "pages");
      return;
    }
    onNavigate(module.section);
  };

  const publicationAction = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setActionError(null);
    try {
      await action();
    } catch (caught) {
      if (isUiError(caught, "unauthenticated")) {
        onSessionExpired();
        return;
      }
      setActionError(uiErrorMessage(caught, "تعذر تنفيذ الإجراء."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <SkipLink targetId="merchant-operations-main" />
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={onBack} className="rounded-xl border border-slate-200 p-2 text-slate-600" aria-label="العودة إلى متاجري"><ArrowRight className="h-4 w-4" /></button><div className="min-w-0"><p className="truncate font-black">{store.storeName}</p><p className="truncate text-[11px] text-slate-500">مركز تشغيل المتجر · {user.fullName}</p></div></div><button type="button" onClick={onLogout} aria-label="تسجيل الخروج" className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">خروج</span></button></div></header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-2 shadow-sm sm:p-4 lg:sticky lg:top-24"><div className="mb-4 hidden rounded-2xl bg-slate-950 p-4 text-white lg:block"><p className="text-xs font-bold text-sky-300">المتجر المحدد</p><p className="mt-1 truncate font-black">{store.storeName}</p><p className="mt-1 truncate text-[11px] text-slate-300">{store.requestedDomain || store.internalDomain || "العنوان قيد التجهيز"}</p></div><nav aria-label="وحدات تشغيل المتجر" className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1.5 lg:overflow-visible lg:pb-0">{modules.map((module) => <button key={module.section} type="button" disabled={!module.enabled} onClick={() => navigate(module)} aria-current={section === module.section ? "page" : undefined} className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-right text-sm transition disabled:cursor-not-allowed disabled:opacity-40 lg:w-full ${section === module.section ? "bg-sky-50 font-black text-sky-800" : "font-bold text-slate-600 hover:bg-slate-50"}`}><module.icon className="h-4 w-4" /><span>{module.label}</span></button>)}</nav></aside>

        <main id="merchant-operations-main" tabIndex={-1} className="min-w-0 space-y-6">
          <section className="rounded-3xl bg-gradient-to-l from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-xl"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-black">{store.storeName}</h1><span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black">{lifecycle?.label}</span></div><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">{lifecycle?.headline} — {lifecycle?.nextAction}</p></div><div className="flex flex-wrap gap-2">{publicUrl && <><button type="button" onClick={() => onCopyPublicUrl(publicUrl)} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black"><Copy className="h-4 w-4" /> نسخ الرابط</button><a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-sky-400 px-3 py-2 text-xs font-black text-slate-950"><ExternalLink className="h-4 w-4" /> فتح المتجر</a></>}{store.capabilities.publish && <button type="button" disabled={busy} onClick={() => void publicationAction(() => onPublish(store))} className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-emerald-950 disabled:opacity-50">نشر المتجر</button>}{store.capabilities.unpublish && <button type="button" disabled={busy} onClick={() => void publicationAction(() => onUnpublish(store))} className="rounded-xl bg-amber-300 px-4 py-2 text-xs font-black text-amber-950 disabled:opacity-50">إلغاء النشر</button>}</div></div>{actionError && <p role="alert" className="mt-4 rounded-xl bg-rose-500/20 p-3 text-xs font-bold text-rose-100">{actionError}</p>}</section>

          {!operational && section !== "overview" && <div role="alert" className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-black text-amber-900">الوحدة غير جاهزة بعد</h2><p className="mt-2 text-sm leading-7 text-amber-800">تابع حالة المراجعة والتجهيز من النظرة العامة. لن نحاول قراءة قاعدة المتجر قبل أن يؤكد الخادم جاهزيتها.</p><button type="button" onClick={() => onNavigate("overview")} className="mt-4 rounded-xl bg-white px-4 py-2 text-xs font-black text-amber-900 shadow-sm">عرض حالة المتجر</button></div>}

          {section === "overview" && <><div className="grid gap-3 sm:grid-cols-3"><MetricCard label="المنتجات الفعالة" metric={metrics.products} icon={Package} /><MetricCard label="إجمالي الطلبات" metric={metrics.orders} icon={ShoppingBag} /><MetricCard label="منتجات منخفضة" metric={metrics.lowStock} icon={Boxes} /></div><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black">أدوات المتجر</h2><p className="mt-1 text-sm text-slate-500">اختر المهمة التي تريد تنفيذها الآن.</p></div><RefreshCw className="h-5 w-5 text-slate-400" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{modules.filter((module) => module.section !== "overview").map((module) => <button key={module.section} type="button" disabled={!module.enabled} onClick={() => navigate(module)} className="rounded-2xl border border-slate-200 p-4 text-right transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50"><module.icon className="mb-3 h-5 w-5 text-sky-600" /><p className="font-black">{module.label}</p><p className="mt-1 text-xs leading-6 text-slate-500">{module.enabled ? module.description : "غير متاحة في حالة المتجر أو صلاحيات الحساب الحالية"}</p></button>)}</div></section></>}
          {operational && section === "products" && <MerchantCatalogPanel tenantId={store.id} canEditInBuilder={store.capabilities.catalogManage && store.capabilities.workspaceManage} onEdit={() => onOpenBuilder("products")} onSessionExpired={onSessionExpired} />}
          {operational && section === "orders" && <MerchantOrdersWorkspace tenantId={store.id} canView={store.capabilities.ordersView} onSessionExpired={onSessionExpired} />}
          {operational && section === "inventory" && <MerchantInventoryPanel tenantId={store.id} canView={store.capabilities.inventoryView} canManage={store.capabilities.inventoryManage} onSessionExpired={onSessionExpired} />}
        </main>
      </div>
    </div>
  );
}
