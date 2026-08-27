import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  CheckCircle2,
  Clock3,
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
  TrendingUp,
} from "lucide-react";
import type { MerchantDashboardSnapshot, StoreSubmission, UserProfile } from "../adapters/uiAdapters";
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

type DashboardState = { data: MerchantDashboardSnapshot | null; loading: boolean; error: string | null };

function useOperationsSnapshot(store: StoreSubmission | null, active: boolean, reloadToken: number, onSessionExpired: () => void) {
  const { merchantDashboard } = useUiAdapters();
  const [state, setState] = useState<DashboardState>({ data: null, loading: false, error: null });
  const sequence = useRef(0);
  const sessionExpired = useRef(onSessionExpired);
  sessionExpired.current = onSessionExpired;

  useEffect(() => {
    const operation = ++sequence.current;
    const controller = new AbortController();
    const exactStore = store;
    setState({ data: null, loading: Boolean(exactStore && active), error: null });
    if (!exactStore || !active) return () => controller.abort();
    void merchantDashboard.load(exactStore.id, controller.signal).then((data) => {
      if (operation === sequence.current) setState({ data, loading: false, error: null });
    }).catch((caught) => {
      if (operation !== sequence.current || isUiError(caught, "aborted")) return;
      if (isUiError(caught, "unauthenticated")) {
        sessionExpired.current();
        return;
      }
      setState({ data: null, loading: false, error: uiErrorMessage(caught, "تعذر تحميل ملخص المتجر التشغيلي.") });
    });

    return () => { sequence.current += 1; controller.abort(); };
  }, [active, merchantDashboard, reloadToken, store]);

  return state;
}

function formatMoneyMinor(value: number, currencyCode: string): string {
  return new Intl.NumberFormat("ar-YE", { style: "currency", currency: currencyCode, maximumFractionDigits: 2 }).format(value / 100);
}

function MetricCard({ label, value, detail, unavailable, icon: Icon }: { label: string; value: string; detail: string; unavailable?: boolean; icon: React.ComponentType<{ className?: string }> }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon className="mb-3 h-5 w-5 text-sky-600" /><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{unavailable ? "—" : value}</p><p className="mt-1 text-[10px] font-bold text-slate-400">{unavailable ? "غير متاح لصلاحيات الحساب" : detail}</p></div>;
}

const orderStatusLabels: Record<MerchantDashboardSnapshot["recentOrders"][number]["status"], string> = {
  submitted: "جديد",
  accepted: "مقبول",
  processing: "قيد التجهيز",
  completed: "مكتمل",
  cancelled: "ملغي",
  expired: "منتهي",
};

function taskPresentation(task: MerchantDashboardSnapshot["tasks"][number]): { title: string; detail: string; action: string } {
  switch (task.code) {
    case "orders_new":
      return { title: `راجع ${task.count} طلبات جديدة`, detail: "طلبات عملاء تنتظر أول إجراء منك.", action: "فتح الطلبات" };
    case "inventory_low":
      return { title: `حدّث مخزون ${task.count} منتجات`, detail: "وصل رصيدها المتاح إلى حد التنبيه.", action: "فتح المخزون" };
    case "products_draft":
      return { title: `${task.count} منتجات ما زالت مسودة`, detail: "راجع بياناتها وانشر الجاهز منها.", action: "فتح المنتجات" };
    case "store_contact_missing":
      return { title: "أكمل وسيلة تواصل المتجر", detail: "أضف الهاتف أو واتساب أو البريد لخدمة العملاء.", action: "فتح المحتوى" };
  }
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
  const [dashboardReloadToken, setDashboardReloadToken] = useState(0);
  const operational = store?.verificationStatus === "approved" && store.provisioningStatus === "active";
  const dashboard = useOperationsSnapshot(store, Boolean(operational) && section === "overview", dashboardReloadToken, onSessionExpired);
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
  const dashboardData = dashboard.data;
  const highestSalesPoint = Math.max(1, ...(dashboardData?.salesSeries.map((point) => point.totalMinor) ?? [0]));

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

          {section === "overview" && <>
            {dashboard.loading && <section aria-live="polite" className="rounded-3xl border border-sky-200 bg-sky-50 p-6 text-sm font-bold text-sky-900"><RefreshCw className="ml-2 inline h-5 w-5 animate-spin" /> جارٍ تجهيز ملخص متجرك من الخادم…</section>}
            {dashboard.error && <section role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-900"><div><h2 className="font-black">تعذر تحميل ملخص التشغيل</h2><p className="mt-1 text-sm">{dashboard.error}</p></div><button type="button" onClick={() => setDashboardReloadToken((value) => value + 1)} className="rounded-xl bg-white px-4 py-2 text-xs font-black shadow-sm">إعادة المحاولة</button></section>}

            {dashboardData && <>
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">مهام اليوم</h2><p className="mt-1 text-sm text-slate-500">ابدأ بما يحتاج تدخلك، ثم راجع مؤشرات المتجر.</p></div><button type="button" onClick={() => setDashboardReloadToken((value) => value + 1)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"><RefreshCw className="h-4 w-4" /> تحديث الملخص</button></div>
                {dashboardData.tasks.length === 0 ? <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="h-5 w-5" /><div><p className="font-black">لا توجد مهام عاجلة</p><p className="mt-1 text-xs">متجرك مستقر حاليًا. يمكنك إضافة منتجات أو مراجعة المحتوى.</p></div></div> : <div className="mt-5 grid gap-3 lg:grid-cols-2">{dashboardData.tasks.map((task) => { const copy = taskPresentation(task); const target = modules.find((module) => module.section === task.section); return <button key={task.code} type="button" disabled={!target?.enabled} onClick={() => target && navigate(target)} className={`flex items-center justify-between gap-4 rounded-2xl border p-4 text-right transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${task.priority === "high" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}><div className="flex min-w-0 items-start gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${task.priority === "high" ? "bg-amber-100 text-amber-800" : "bg-white text-sky-700"}`}><AlertTriangle className="h-5 w-5" /></div><div><p className="font-black">{copy.title}</p><p className="mt-1 text-xs leading-6 text-slate-500">{copy.detail}</p></div></div><span className="shrink-0 text-xs font-black text-sky-700">{copy.action} ←</span></button>; })}</div>}
              </section>

              <section aria-label="مؤشرات المتجر اليوم" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="مبيعات اليوم المكتملة" value={dashboardData.metrics.salesTodayMinor === null ? "—" : formatMoneyMinor(dashboardData.metrics.salesTodayMinor, dashboardData.currencyCode)} detail="من الطلبات المكتملة اليوم" unavailable={dashboardData.metrics.salesTodayMinor === null} icon={Banknote} />
                <MetricCard label="طلبات اليوم" value={String(dashboardData.metrics.ordersToday ?? 0)} detail={`${dashboardData.metrics.openOrders ?? 0} طلبًا مفتوحًا`} unavailable={dashboardData.metrics.ordersToday === null} icon={ShoppingBag} />
                <MetricCard label="المنتجات المنشورة" value={String(dashboardData.metrics.publishedProducts ?? 0)} detail={dashboardData.metrics.draftProducts === null ? "غير متاح لصلاحيات الحساب" : `${dashboardData.metrics.draftProducts} مسودة`} unavailable={dashboardData.metrics.publishedProducts === null} icon={Package} />
                <MetricCard label="تنبيهات المخزون" value={String(dashboardData.metrics.lowStockProducts ?? 0)} detail="منتجات وصلت إلى حد التنبيه" unavailable={dashboardData.metrics.lowStockProducts === null} icon={Boxes} />
              </section>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)]">
                <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5"><div><h2 className="text-lg font-black">أحدث الطلبات</h2><p className="mt-1 text-xs text-slate-500">لا تعرض اللوحة بيانات العميل الحساسة.</p></div>{dashboardData.visibility.orders && <button type="button" onClick={() => navigate(modules.find((module) => module.section === "orders")!)} className="text-xs font-black text-sky-700">عرض جميع الطلبات ←</button>}</div>{!dashboardData.visibility.orders ? <p className="p-6 text-sm font-bold text-slate-400">قائمة الطلبات غير متاحة لصلاحيات هذا الحساب.</p> : dashboardData.recentOrders.length === 0 ? <p className="p-8 text-center text-sm font-bold text-slate-400">لم تصل طلبات بعد.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-right text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-3">الطلب</th><th className="px-5 py-3">الإجمالي</th><th className="px-5 py-3">الدفع</th><th className="px-5 py-3">الحالة</th><th className="px-5 py-3">التاريخ</th></tr></thead><tbody className="divide-y divide-slate-100">{dashboardData.recentOrders.map((order) => <tr key={order.id} className="hover:bg-slate-50"><td className="px-5 py-3 font-black">#{order.number}</td><td className="px-5 py-3 font-bold">{formatMoneyMinor(order.grandTotalMinor, order.currencyCode)}</td><td className="px-5 py-3 text-slate-500">{order.paymentState === "due_on_delivery" ? "عند الاستلام" : "تحويل غير متحقق"}</td><td className="px-5 py-3"><span className="rounded-full bg-sky-50 px-2.5 py-1 font-black text-sky-800">{orderStatusLabels[order.status]}</span></td><td className="px-5 py-3 text-slate-500">{new Intl.DateTimeFormat("ar-YE", { dateStyle: "short", timeStyle: "short" }).format(new Date(order.createdAt))}</td></tr>)}</tbody></table></div>}</section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><TrendingUp className="h-5 w-5 text-sky-600" /><div><h2 className="text-lg font-black">الأكثر مبيعًا</h2><p className="text-xs text-slate-500">آخر 30 يومًا</p></div></div>{!dashboardData.visibility.analytics ? <p className="mt-5 text-sm font-bold text-slate-400">غير متاح لصلاحيات الحساب.</p> : dashboardData.topProducts.length === 0 ? <p className="mt-5 text-sm font-bold text-slate-400">تظهر المنتجات هنا بعد اكتمال أول طلب.</p> : <ol className="mt-5 space-y-3">{dashboardData.topProducts.map((product, index) => <li key={product.productId} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div className="min-w-0"><p className="truncate font-black">{product.name}</p><p className="mt-1 text-[10px] text-slate-500">{product.quantity} قطعة مكتملة</p></div><span className="text-lg font-black text-sky-700">#{index + 1}</span></li>)}</ol>}</section>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-sky-600" /><div><h2 className="text-lg font-black">المبيعات خلال 7 أيام</h2><p className="text-xs text-slate-500">الطلبات المكتملة فقط</p></div></div>{!dashboardData.visibility.analytics ? <p className="mt-5 text-sm font-bold text-slate-400">غير متاح لصلاحيات الحساب.</p> : <div className="mt-6 flex h-44 items-end gap-2" aria-label="رسم المبيعات لسبعة أيام">{dashboardData.salesSeries.map((point) => <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="text-[9px] font-bold text-slate-500">{point.totalMinor > 0 ? formatMoneyMinor(point.totalMinor, dashboardData.currencyCode) : "0"}</span><div className="w-full rounded-t-lg bg-gradient-to-t from-sky-600 to-cyan-300" style={{ height: `${Math.max(5, Math.round((point.totalMinor / highestSalesPoint) * 100))}%` }} /><span className="text-[9px] text-slate-400">{new Intl.DateTimeFormat("ar-YE", { weekday: "short" }).format(new Date(`${point.date}T00:00:00Z`))}</span></div>)}</div>}</section>

                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black">أدوات المتجر</h2><p className="mt-1 text-sm text-slate-500">انتقل مباشرة إلى المهمة المطلوبة.</p></div><Store className="h-5 w-5 text-slate-400" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{modules.filter((module) => module.section !== "overview").map((module) => <button key={module.section} type="button" disabled={!module.enabled} onClick={() => navigate(module)} className="rounded-2xl border border-slate-200 p-4 text-right transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-50"><module.icon className="mb-3 h-5 w-5 text-sky-600" /><p className="font-black">{module.label}</p><p className="mt-1 text-xs leading-6 text-slate-500">{module.enabled ? module.description : "غير متاحة في حالة المتجر أو صلاحيات الحساب الحالية"}</p></button>)}</div></section>
              </div>
            </>}
          </>}
          {operational && section === "products" && <MerchantCatalogPanel tenantId={store.id} canEditInBuilder={store.capabilities.catalogManage && store.capabilities.workspaceManage} onEdit={() => onOpenBuilder("products")} onSessionExpired={onSessionExpired} />}
          {operational && section === "orders" && <MerchantOrdersWorkspace tenantId={store.id} canView={store.capabilities.ordersView} onSessionExpired={onSessionExpired} />}
          {operational && section === "inventory" && <MerchantInventoryPanel tenantId={store.id} canView={store.capabilities.inventoryView} canManage={store.capabilities.inventoryManage} onSessionExpired={onSessionExpired} />}
        </main>
      </div>
    </div>
  );
}
