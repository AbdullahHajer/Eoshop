import { type ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  LoaderCircle,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import type { GuestOrderTracking } from "../../adapters/uiAdapters";

type TimelineStage = GuestOrderTracking["timeline"][number]["stage"];

interface ErrorLike {
  category?: unknown;
  name?: unknown;
  retryable?: unknown;
  retryAfterSeconds?: unknown;
  status?: unknown;
}

type TrackingView =
  | { kind: "loading" }
  | { kind: "success"; capability: string; order: GuestOrderTracking; refreshing: boolean }
  | { kind: "retry" }
  | { kind: "error" }
  | { kind: "throttle"; remainingSeconds: number };

export interface GuestOrderTrackingPageProps {
  capability?: string | null;
  invalidCapability?: boolean;
  lookupOrder: (capability: string, signal?: AbortSignal) => Promise<GuestOrderTracking>;
  storeName?: string;
}

const timelineLabels: Record<TimelineStage, string> = {
  submitted: "استلم المتجر الطلب",
  accepted: "قبل المتجر الطلب",
  preparing: "بدأ تجهيز الطلب",
  dispatched: "خرج الطلب للتوصيل",
  delivered: "سُجّل تسليم الطلب",
  legacy_completed: "اكتملت معالجة الطلب في السجل السابق",
  cancelled: "أُلغي الطلب",
  expired: "انتهت صلاحية الطلب",
};

function errorLike(error: unknown): ErrorLike {
  return error && typeof error === "object" ? error as ErrorLike : {};
}

function isAborted(error: unknown, signal: AbortSignal): boolean {
  const candidate = errorLike(error);
  return signal.aborted || candidate.name === "AbortError" || candidate.category === "aborted";
}

function retryDelay(error: ErrorLike): number {
  if (typeof error.retryAfterSeconds !== "number" || !Number.isFinite(error.retryAfterSeconds)) return 0;
  return Math.min(3_600, Math.max(0, Math.ceil(error.retryAfterSeconds)));
}

function failedView(error: unknown): TrackingView {
  const candidate = errorLike(error);
  if (candidate.category === "throttled" || candidate.status === 429) {
    return { kind: "throttle", remainingSeconds: retryDelay(candidate) };
  }
  if (
    candidate.retryable === true
    || candidate.category === "network"
    || candidate.category === "server"
    || candidate.category === "csrf"
  ) {
    return { kind: "retry" };
  }
  return { kind: "error" };
}

function currentStatusCopy(order: GuestOrderTracking): { title: string; detail: string; tone: string } {
  if (order.orderStatus === "cancelled") {
    return {
      title: "أُلغي الطلب",
      detail: "سجّل المتجر إلغاء الطلب. تواصل مع المتجر إذا كنت تحتاج إلى مزيد من التوضيح.",
      tone: "border-rose-200 bg-rose-50 text-rose-950",
    };
  }
  if (order.orderStatus === "expired") {
    return {
      title: "انتهت صلاحية الطلب",
      detail: "انتهت صلاحية الطلب قبل اكتمال معالجته.",
      tone: "border-amber-200 bg-amber-50 text-amber-950",
    };
  }

  switch (order.fulfillmentStatus) {
    case "delivered":
      return {
        title: "سُجّل تسليم الطلب",
        detail: "سجّل المتجر اكتمال تسليم هذا الطلب.",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
      };
    case "dispatched":
      return {
        title: "خرج الطلب للتوصيل",
        detail: "سجّل المتجر خروج الطلب للتوصيل. قد تختلف مدة الوصول بحسب ترتيبات التوصيل.",
        tone: "border-sky-200 bg-sky-50 text-sky-950",
      };
    case "preparing":
      return {
        title: "الطلب قيد التجهيز",
        detail: "سجّل المتجر بدء تجهيز طلبك.",
        tone: "border-sky-200 bg-sky-50 text-sky-950",
      };
    case "legacy_completed":
      return {
        title: "اكتملت معالجة الطلب",
        detail: "هذه حالة من السجل السابق ولا تعني وحدها أن الطلب شُحن أو سُلّم.",
        tone: "border-slate-200 bg-slate-50 text-slate-950",
      };
    case "unfulfilled":
      if (order.orderStatus === "accepted") {
        return {
          title: "قبل المتجر الطلب",
          detail: "قُبل طلبك، ولم يُسجّل بدء التجهيز بعد.",
          tone: "border-indigo-200 bg-indigo-50 text-indigo-950",
        };
      }
      if (order.orderStatus === "processing") {
        return {
          title: "الطلب قيد المعالجة",
          detail: "الطلب قيد المعالجة، ولا يوجد حدث تجهيز أو توصيل مسجّل حتى الآن.",
          tone: "border-indigo-200 bg-indigo-50 text-indigo-950",
        };
      }
      if (order.orderStatus === "completed") {
        return {
          title: "اكتملت معالجة الطلب",
          detail: "لا توجد حالة تسليم مستقلة مسجّلة، لذلك لا تعني هذه الحالة وحدها أن الطلب سُلّم.",
          tone: "border-slate-200 bg-slate-50 text-slate-950",
        };
      }
      return {
        title: "استلم المتجر الطلب",
        detail: "استلم المتجر طلبك، ولم يُسجّل بدء التجهيز بعد.",
        tone: "border-indigo-200 bg-indigo-50 text-indigo-950",
      };
  }
}

function formatRecordedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "وقت غير متاح";
  return new Intl.DateTimeFormat("ar-YE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function StateShell({
  children,
  role,
  stateRef,
  testId,
}: {
  children: ReactNode;
  role?: "alert" | "status";
  stateRef: RefObject<HTMLElement | null>;
  testId: string;
}) {
  return (
    <section
      ref={stateRef}
      role={role}
      tabIndex={-1}
      data-testid={testId}
      className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 outline-none focus-visible:ring-4 focus-visible:ring-sky-200 motion-reduce:transition-none sm:p-9"
    >
      {children}
    </section>
  );
}

export default function GuestOrderTrackingPage({
  capability,
  invalidCapability = false,
  lookupOrder,
  storeName,
}: GuestOrderTrackingPageProps) {
  const routeCapability = capability?.trim() ?? "";
  const routeUnavailable = invalidCapability || routeCapability.length === 0;
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState<TrackingView>({ kind: "loading" });
  const viewRef = useRef<TrackingView>(view);
  viewRef.current = view;
  const stateRef = useRef<HTMLElement>(null);
  const lookupControllerRef = useRef<AbortController | null>(null);
  const refreshQueuedRef = useRef(false);
  const effectiveKind = routeUnavailable ? "missing" : view.kind;

  useEffect(() => {
    if (routeUnavailable) {
      refreshQueuedRef.current = false;
      return;
    }

    const controller = new AbortController();
    lookupControllerRef.current = controller;
    refreshQueuedRef.current = false;
    setView((current) => current.kind === "success" && current.refreshing && current.capability === routeCapability
      ? current
      : { kind: "loading" });

    void (async () => {
      try {
        const order = await lookupOrder(routeCapability, controller.signal);
        if (!controller.signal.aborted) setView({ kind: "success", capability: routeCapability, order, refreshing: false });
      } catch (error) {
        if (!isAborted(error, controller.signal)) setView(failedView(error));
      } finally {
        if (lookupControllerRef.current === controller) lookupControllerRef.current = null;
      }
    })();

    return () => {
      controller.abort();
      if (lookupControllerRef.current === controller) lookupControllerRef.current = null;
    };
  }, [attempt, lookupOrder, routeCapability, routeUnavailable]);

  useEffect(() => {
    stateRef.current?.focus();
  }, [effectiveKind]);

  useEffect(() => {
    if (view.kind !== "throttle" || view.remainingSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setView((current) => {
        if (current.kind !== "throttle") return current;
        if (current.remainingSeconds <= 1) window.clearInterval(timer);
        return { ...current, remainingSeconds: Math.max(0, current.remainingSeconds - 1) };
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [view.kind]);

  const successCopy = useMemo(
    () => view.kind === "success" ? currentStatusCopy(view.order) : null,
    [view],
  );

  const retry = () => {
    if (lookupControllerRef.current || refreshQueuedRef.current) return;
    refreshQueuedRef.current = true;
    setAttempt((current) => current + 1);
  };
  const refresh = useCallback(() => {
    const current = viewRef.current;
    if (current.kind !== "success" || current.refreshing || lookupControllerRef.current || refreshQueuedRef.current) return;
    refreshQueuedRef.current = true;
    const refreshingView: TrackingView = { ...current, refreshing: true };
    viewRef.current = refreshingView;
    setView(refreshingView);
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    const refreshAfterHistoryRestore = (event: PageTransitionEvent) => {
      if (event.persisted && !routeUnavailable) refresh();
    };
    window.addEventListener("pageshow", refreshAfterHistoryRestore);
    return () => window.removeEventListener("pageshow", refreshAfterHistoryRestore);
  }, [refresh, routeUnavailable]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 sm:py-12" dir="rtl">
      <button
        type="button"
        onClick={() => stateRef.current?.focus()}
        className="fixed right-4 top-4 z-50 -translate-y-24 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition-transform focus:translate-y-0 motion-reduce:transition-none"
      >
        تخطي إلى حالة الطلب
      </button>

      <div id="guest-order-tracking-content" className="mx-auto w-full max-w-2xl">
        <header className="mb-6 flex items-start gap-4 px-1 sm:mb-8">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white" aria-hidden="true">
            <PackageCheck className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-black text-sky-700">{storeName ? `تحديثات ${storeName}` : "تحديثات الطلب المسجّلة"}</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">تتبّع طلبك</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">نعرض آخر حالة سجّلها المتجر، من دون بياناتك الشخصية.</p>
          </div>
        </header>

        {routeUnavailable ? (
          <StateShell stateRef={stateRef} role="alert" testId="tracking-missing">
            <TriangleAlert aria-hidden="true" className="h-9 w-9 text-amber-600" />
            <h2 className="mt-4 text-xl font-black">{invalidCapability ? "تعذّر فتح رابط التتبع" : "رابط التتبع غير مكتمل"}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              افتح رابط التتبع الكامل الذي استلمته بعد إنشاء الطلب. حفاظًا على خصوصيتك، لا تشارك هذا الرابط مع الآخرين.
            </p>
            <a href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white outline-none focus-visible:ring-4 focus-visible:ring-sky-200 motion-reduce:transition-none">
              العودة إلى المتجر
            </a>
          </StateShell>
        ) : view.kind === "loading" ? (
          <StateShell stateRef={stateRef} role="status" testId="tracking-loading">
            <div aria-busy="true" className="flex items-center gap-4">
              <LoaderCircle aria-hidden="true" className="h-8 w-8 shrink-0 animate-spin text-sky-600 motion-reduce:animate-none" />
              <div>
                <h2 className="font-black">جارٍ جلب آخر حالة مسجّلة…</h2>
                <p className="mt-1 text-sm text-slate-600">قد يستغرق ذلك لحظات قليلة.</p>
              </div>
            </div>
          </StateShell>
        ) : view.kind === "retry" ? (
          <StateShell stateRef={stateRef} role="alert" testId="tracking-retry">
            <RefreshCw aria-hidden="true" className="h-9 w-9 text-sky-700" />
            <h2 className="mt-4 text-xl font-black">تعذّر جلب آخر تحديث</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">لم نتمكن من الاتصال بالخدمة الآن. يمكنك إعادة المحاولة بأمان.</p>
            <button type="button" onClick={retry} className="mt-6 min-h-11 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white outline-none focus-visible:ring-4 focus-visible:ring-sky-200 motion-reduce:transition-none">
              إعادة المحاولة
            </button>
          </StateShell>
        ) : view.kind === "throttle" ? (
          <StateShell stateRef={stateRef} role="alert" testId="tracking-throttle">
            <Clock3 aria-hidden="true" className="h-9 w-9 text-amber-600" />
            <h2 className="mt-4 text-xl font-black">طلبات كثيرة خلال وقت قصير</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              {view.remainingSeconds > 0
                ? `انتظر ${view.remainingSeconds.toLocaleString("ar-SA")} ثانية قبل المحاولة مجددًا.`
                : "يمكنك إعادة المحاولة الآن."}
            </p>
            <button
              type="button"
              onClick={retry}
              disabled={view.remainingSeconds > 0}
              className="mt-6 min-h-11 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white outline-none enabled:focus-visible:ring-4 enabled:focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              إعادة المحاولة
            </button>
          </StateShell>
        ) : view.kind === "error" ? (
          <StateShell stateRef={stateRef} role="alert" testId="tracking-error">
            <TriangleAlert aria-hidden="true" className="h-9 w-9 text-rose-600" />
            <h2 className="mt-4 text-xl font-black">تعذّر فتح تتبع الطلب</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">تحقق من فتح الرابط الكامل الذي استلمته. لا نعرض تفاصيل إضافية لحماية خصوصية الطلب.</p>
            <a href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white outline-none focus-visible:ring-4 focus-visible:ring-sky-200 motion-reduce:transition-none">
              العودة إلى المتجر
            </a>
          </StateShell>
        ) : (
          <StateShell stateRef={stateRef} testId="tracking-success">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-slate-500">رقم الطلب</p>
                <p className="mt-1 font-mono text-lg font-black" dir="ltr"><bdi>{view.order.number}</bdi></p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800">
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                رابط خاص
              </span>
            </div>

            <section className={`mt-6 rounded-2xl border p-5 ${successCopy?.tone ?? "border-slate-200 bg-slate-50 text-slate-950"}`} aria-labelledby="guest-order-current-status">
              <div className="flex items-start gap-3">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <h2 id="guest-order-current-status" className="text-lg font-black">{successCopy?.title}</h2>
                  <p className="mt-2 text-sm leading-7 opacity-80">{successCopy?.detail}</p>
                </div>
              </div>
            </section>

            <div className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-lg font-black">الأحداث المسجّلة</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs text-slate-500">
                    آخر تحديث: <time dateTime={view.order.updatedAt}><bdi dir="auto">{formatRecordedAt(view.order.updatedAt)}</bdi></time>
                  </p>
                  <button
                    type="button"
                    onClick={refresh}
                    disabled={view.refreshing}
                    aria-busy={view.refreshing}
                    aria-label={view.refreshing ? "جارٍ تحديث الحالة" : "تحديث الحالة"}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-black text-sky-800 outline-none enabled:hover:bg-sky-100 enabled:focus-visible:ring-4 enabled:focus-visible:ring-sky-200 disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none"
                  >
                    <RefreshCw aria-hidden="true" className={`h-4 w-4 ${view.refreshing ? "animate-spin motion-reduce:animate-none" : ""}`} />
                    <span aria-live="polite">{view.refreshing ? "جارٍ التحديث…" : "تحديث الحالة"}</span>
                  </button>
                </div>
              </div>

              {view.order.timeline.length === 0 ? (
                <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">لا توجد أحداث زمنية مسجّلة للعرض حتى الآن.</p>
              ) : (
                <ol aria-label="الأحداث الفعلية المسجّلة للطلب" className="mt-5 space-y-4">
                  {view.order.timeline.map((event, index) => (
                    <li key={`${event.stage}-${event.occurredAt}-${index}`} className="relative border-r-2 border-sky-100 pb-1 pr-5 last:pb-0">
                      <span aria-hidden="true" className="absolute -right-[5px] top-1.5 h-2 w-2 rounded-full bg-sky-600" />
                      <p className="text-sm font-black">{timelineLabels[event.stage]}</p>
                      <time dateTime={event.occurredAt} className="mt-1 block text-xs text-slate-500">
                        <bdi dir="auto">{formatRecordedAt(event.occurredAt)}</bdi>
                      </time>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <p className="mt-8 flex items-start gap-2 border-t border-slate-100 pt-5 text-xs leading-6 text-slate-500">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
              لا تعرض هذه الصفحة الاسم أو الهاتف أو العنوان أو بيانات الدفع.
            </p>
          </StateShell>
        )}
      </div>
    </main>
  );
}
