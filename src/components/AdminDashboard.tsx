import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ExternalLink,
  Globe2,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  X,
  XCircle,
} from "lucide-react";
import type { PlatformStore, ProvisioningStatus, VerificationStatus } from "../adapters/uiAdapters";

export type { PlatformStore } from "../adapters/uiAdapters";

interface AdminDashboardProps {
  stores: PlatformStore[];
  permissions: string[];
  loading: boolean;
  error: string | null;
  onReload: () => Promise<void>;
  onUpdateStoreStatus: (
    storeId: string,
    status: VerificationStatus,
    reason?: string,
  ) => Promise<void>;
  onRetryProvisioning: (storeId: string) => Promise<void>;
  onActivateSubscription: (storeId: string, endsAt: string) => Promise<void>;
  onPublish: (storeId: string) => Promise<void>;
  onUnpublish: (storeId: string) => Promise<void>;
  onClose: () => void;
}

const statusLabel: Record<VerificationStatus, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول ومفعّل",
  rejected: "مرفوض",
  suspended: "موقوف مؤقتًا",
};

const statusClass: Record<VerificationStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-rose-50 text-rose-800 border-rose-200",
  suspended: "bg-slate-100 text-slate-800 border-slate-300",
};

const provisioningLabel: Record<ProvisioningStatus, string> = {
  not_started: "بانتظار الموافقة",
  queued: "في قائمة التجهيز",
  provisioning: "جارٍ التجهيز",
  retrying: "إعادة محاولة",
  active: "قاعدة المتجر جاهزة",
  failed: "فشل التجهيز",
};

export default function AdminDashboard({
  stores,
  permissions,
  loading,
  error,
  onReload,
  onUpdateStoreStatus,
  onRetryProvisioning,
  onActivateSubscription,
  onPublish,
  onUnpublish,
  onClose,
}: AdminDashboardProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | VerificationStatus>("all");
  const [busyStoreId, setBusyStoreId] = useState<string | null>(null);
  const [reasonDecision, setReasonDecision] = useState<{
    store: PlatformStore;
    status: "rejected" | "suspended";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [activationStore, setActivationStore] = useState<PlatformStore | null>(null);
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState("");

  const canReview = permissions.includes("platform.stores.review");
  const canManage = permissions.includes("platform.stores.manage");
  const filteredStores = useMemo(() => stores.filter((storeRecord) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      storeRecord.storeName,
      storeRecord.ownerName,
      storeRecord.ownerEmail,
    ].some((value) => value.toLowerCase().includes(query));

    return matchesSearch && (status === "all" || storeRecord.verificationStatus === status);
  }), [search, status, stores]);

  const updateStatus = async (
    storeRecord: PlatformStore,
    nextStatus: VerificationStatus,
    rejectionReason?: string,
  ) => {
    setBusyStoreId(storeRecord.id);
    try {
      await onUpdateStoreStatus(storeRecord.id, nextStatus, rejectionReason);
      setReasonDecision(null);
      setReason("");
    } catch {
      // The parent keeps the server-provided error visible and the decision open.
    } finally {
      setBusyStoreId(null);
    }
  };

  const retryProvisioning = async (storeRecord: PlatformStore) => {
    setBusyStoreId(storeRecord.id);
    try {
      await onRetryProvisioning(storeRecord.id);
    } finally {
      setBusyStoreId(null);
    }
  };

  const runStoreAction = async (storeRecord: PlatformStore, action: () => Promise<void>) => {
    setBusyStoreId(storeRecord.id);
    try {
      await action();
    } finally {
      setBusyStoreId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" dir="rtl">
      <motion.section
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl"
      >
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-600 p-3 text-white"><ShieldCheck className="h-6 w-6" /></div>
            <div>
              <h2 className="text-lg font-black text-slate-950">إدارة متاجر المنصة</h2>
              <p className="text-xs text-slate-500">بيانات وصلاحيات مباشرة من خادم Eoshop</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void onReload()}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> تحديث
            </button>
            <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 border-b border-slate-200 bg-white p-4 sm:grid-cols-4">
          {(Object.keys(statusLabel) as VerificationStatus[]).map((statusKey) => (
            <button
              key={statusKey}
              onClick={() => setStatus(statusKey)}
              className={`rounded-2xl border p-3 text-right transition ${status === statusKey ? statusClass[statusKey] : "border-slate-200 bg-slate-50 text-slate-700"}`}
            >
              <span className="block text-2xl font-black">{stores.filter((item) => item.verificationStatus === statusKey).length}</span>
              <span className="text-xs font-bold">{statusLabel[statusKey]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث بالمتجر أو المالك أو البريد"
              className="w-full rounded-xl border border-slate-200 py-2 pr-10 pl-3 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <button onClick={() => setStatus("all")} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">
            عرض الكل ({stores.length})
          </button>
        </div>

        <main className="flex-1 overflow-auto p-4">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">
              <AlertTriangle className="h-5 w-5" /> {error}
            </div>
          )}

          {!loading && !error && filteredStores.length === 0 && (
            <div className="grid place-items-center rounded-3xl border border-dashed border-slate-300 bg-white py-20 text-slate-500">
              <Store className="mb-3 h-10 w-10" /> لا توجد متاجر مطابقة.
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {filteredStores.map((storeRecord) => {
              const busy = busyStoreId === storeRecord.id;
              return (
                <article key={storeRecord.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-black text-slate-950">{storeRecord.storeName}</h3>
                      <p className="mt-1 text-xs text-slate-500">{storeRecord.ownerName} · {storeRecord.ownerEmail}</p>
                      <p className="mt-1 text-xs text-slate-500">{storeRecord.businessType}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-black ${statusClass[storeRecord.verificationStatus]}`}>
                      {statusLabel[storeRecord.verificationStatus]}
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800">
                    التجهيز: {provisioningLabel[storeRecord.provisioningStatus]}
                    {storeRecord.latestProvisioningRun?.lastErrorMessage && (
                      <span className="mt-1 block text-rose-700">{storeRecord.latestProvisioningRun.lastErrorMessage}</span>
                    )}
                  </div>

                  <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 sm:grid-cols-2">
                    <div>
                      <span className="block font-black text-slate-900">النطاق والنشر</span>
                      <span className="mt-1 block" dir="ltr">{storeRecord.publicDomain ?? storeRecord.requestedDomain ?? "—"}</span>
                      <span className="mt-1 block font-bold text-indigo-700">{storeRecord.publicationStatus}</span>
                    </div>
                    <div>
                      <span className="block font-black text-slate-900">الاشتراك</span>
                      <span className="mt-1 block">{storeRecord.subscription?.plan.name ?? "—"}</span>
                      <span className="mt-1 block font-bold text-indigo-700">{storeRecord.subscription?.status ?? "—"}</span>
                    </div>
                    {storeRecord.publicationBlockers.length > 0 && (
                      <p className="sm:col-span-2 text-[11px] text-amber-700">موانع النشر: {storeRecord.publicationBlockers.join("، ")}</p>
                    )}
                    {storeRecord.publicDomain && storeRecord.publicationStatus === "published" && (
                      <a href={`http://${storeRecord.publicDomain}`} target="_blank" rel="noreferrer" className="sm:col-span-2 flex items-center gap-1 font-bold text-emerald-700">
                        <ExternalLink className="h-3.5 w-3.5" /> فتح المتجر المنشور
                      </a>
                    )}
                  </div>

                  {storeRecord.rejectionReason && (
                    <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-800">السبب: {storeRecord.rejectionReason}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {storeRecord.verificationStatus === "pending" && canReview && (
                      <>
                        <button disabled={busy} onClick={() => void updateStatus(storeRecord, "approved")} className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                          <CheckCircle2 className="h-4 w-4" /> قبول
                        </button>
                        <button disabled={busy} onClick={() => setReasonDecision({ store: storeRecord, status: "rejected" })} className="flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                          <XCircle className="h-4 w-4" /> رفض
                        </button>
                      </>
                    )}
                    {storeRecord.verificationStatus === "approved" && canManage && (
                      <button disabled={busy} onClick={() => setReasonDecision({ store: storeRecord, status: "suspended" })} className="flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                        <Ban className="h-4 w-4" /> تعليق
                      </button>
                    )}
                    {storeRecord.verificationStatus === "suspended" && canManage && (
                      <button disabled={busy} onClick={() => void updateStatus(storeRecord, "approved")} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">إعادة التفعيل</button>
                    )}
                    {storeRecord.verificationStatus === "rejected" && canManage && (
                      <button disabled={busy} onClick={() => void updateStatus(storeRecord, "pending")} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">إعادة للمراجعة</button>
                    )}
                    {storeRecord.provisioningStatus === "failed" && canManage && (
                      <button disabled={busy} onClick={() => void retryProvisioning(storeRecord)} className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                        <RefreshCw className="h-4 w-4" /> إعادة محاولة التجهيز
                      </button>
                    )}
                    {(storeRecord.subscription?.status === "pending_activation"
                      || (storeRecord.subscription?.status === "active"
                        && Boolean(storeRecord.subscription.endsAt)
                        && new Date(storeRecord.subscription.endsAt as string).getTime() <= Date.now())) && canManage && (
                      <button disabled={busy} onClick={() => setActivationStore(storeRecord)} className="flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">
                        <CheckCircle2 className="h-4 w-4" /> {storeRecord.subscription?.status === "active" ? "تجديد الاشتراك" : "تفعيل الاشتراك يدويًا"}
                      </button>
                    )}
                    {storeRecord.publicationStatus !== "published" && storeRecord.publicationBlockers.length === 0 && canManage && (
                      <button disabled={busy} onClick={() => void runStoreAction(storeRecord, () => onPublish(storeRecord.id))} className="flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                        <Globe2 className="h-4 w-4" /> نشر المتجر
                      </button>
                    )}
                    {storeRecord.publicationStatus === "published" && canManage && (
                      <button disabled={busy} onClick={() => void runStoreAction(storeRecord, () => onUnpublish(storeRecord.id))} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
                        إيقاف النشر
                      </button>
                    )}
                    {!canReview && !canManage && <span className="text-xs text-slate-500">عرض فقط حسب صلاحيات الحساب.</span>}
                  </div>
                </article>
              );
            })}
          </div>
        </main>
      </motion.section>

      {reasonDecision && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (reason.trim()) void updateStatus(reasonDecision.store, reasonDecision.status, reason.trim());
            }}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-black text-slate-950">
              سبب {reasonDecision.status === "rejected" ? "رفض" : "تعليق"} {reasonDecision.store.storeName}
            </h3>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} required className="mt-4 min-h-32 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-rose-400" />
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={!reason.trim() || busyStoreId === reasonDecision.store.id} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">تأكيد القرار</button>
              <button type="button" onClick={() => { setReasonDecision(null); setReason(""); }} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {activationStore && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!subscriptionEndsAt) return;
              void runStoreAction(activationStore, async () => {
                await onActivateSubscription(activationStore.id, new Date(`${subscriptionEndsAt}T23:59:59`).toISOString());
                setActivationStore(null);
                setSubscriptionEndsAt("");
              });
            }}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-black text-slate-950">{activationStore.subscription?.status === "active" ? "تجديد" : "تفعيل"} {activationStore.subscription?.plan.name}</h3>
            <p className="mt-2 text-xs text-slate-500">هذا إجراء إداري يمنح الاستحقاق حتى التاريخ المحدد، ولا يمثل تحصيل دفعة إلكترونية.</p>
            <label className="mt-4 block text-xs font-bold text-slate-700">تاريخ انتهاء الاستحقاق</label>
            <input type="date" required value={subscriptionEndsAt} min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)} onChange={(event) => setSubscriptionEndsAt(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={!subscriptionEndsAt || busyStoreId === activationStore.id} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">تأكيد التفعيل</button>
              <button type="button" onClick={() => { setActivationStore(null); setSubscriptionEndsAt(""); }} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">إلغاء</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
