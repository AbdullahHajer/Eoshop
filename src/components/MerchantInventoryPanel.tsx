import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { useMerchantInventory } from "../hooks/useMerchantInventory";

interface MerchantInventoryPanelProps {
  tenantId: string;
  canView: boolean;
  canManage: boolean;
  onSessionExpired?: () => void;
}

export default function MerchantInventoryPanel({ tenantId, canView, canManage, onSessionExpired }: MerchantInventoryPanelProps) {
  const inventory = useMerchantInventory(tenantId, canView, onSessionExpired);
  const mutationPending = inventory.pendingProductIds.size > 0;
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [thresholds, setThresholds] = useState<Record<string, string>>({});

  useEffect(() => {
    setTargets(Object.fromEntries(inventory.items.map((item) => [item.productId, String(item.onHand)])));
    setThresholds(Object.fromEntries(inventory.items.map((item) => [item.productId, String(item.lowStockThreshold)])));
  }, [inventory.items]);

  const totals = useMemo(() => ({
    onHand: inventory.items.reduce((sum, item) => sum + item.onHand, 0),
    reserved: inventory.items.reduce((sum, item) => sum + item.reserved, 0),
    low: inventory.items.filter((item) => item.manageStock && (item.available ?? 0) <= item.lowStockThreshold).length,
  }), [inventory.items]);

  if (!canView) {
    return <div role="alert" className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-900">لا يملك هذا الحساب صلاحية عرض المخزون.</div>;
  }

  return (
    <section className="space-y-5" aria-labelledby="inventory-heading">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div><h2 id="inventory-heading" className="text-xl font-black">المخزون</h2><p className="mt-1 text-sm text-slate-500">الرصيد والحجز والمتاح من سجل المخزون الخادمي.</p></div>
        <button type="button" disabled={inventory.loading || mutationPending} onClick={() => void inventory.load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${inventory.loading ? "animate-spin" : ""}`} /> تحديث</button>
      </div>

      {inventory.error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{inventory.error}</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        {[{ label: "الرصيد الفعلي", value: totals.onHand }, { label: "المحجوز", value: totals.reserved }, { label: "منخفض المخزون", value: totals.low }].map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold text-slate-500">{metric.label}</p><p className="mt-2 text-2xl font-black">{inventory.loading ? "…" : metric.value}</p></div>
        ))}
      </div>

      {!inventory.loading && inventory.items.length === 0 && !inventory.error && <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500"><Boxes className="mx-auto mb-3 h-7 w-7" />لا توجد منتجات مخزنية بعد.</div>}

      <div className="space-y-3">
        {inventory.items.map((item) => {
          const target = Number(targets[item.productId]);
          const threshold = Number(thresholds[item.productId]);
          const low = item.manageStock && (item.available ?? 0) <= item.lowStockThreshold;
          return (
            <article key={item.productId} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-black">{item.name || item.productId}</h3>{low && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-800"><AlertTriangle className="h-3 w-3" /> منخفض</span>}</div>
                  <p className="mt-1 text-xs text-slate-500">{item.sku || "بدون SKU"} · مراجعة {item.inventoryRevision}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[320px]">
                  <div className="rounded-xl bg-slate-50 p-2"><p className="text-[10px] text-slate-500">فعلي</p><p className="font-black">{item.onHand}</p></div>
                  <div className="rounded-xl bg-amber-50 p-2"><p className="text-[10px] text-amber-700">محجوز</p><p className="font-black text-amber-900">{item.reserved}</p></div>
                  <div className="rounded-xl bg-emerald-50 p-2"><p className="text-[10px] text-emerald-700">متاح</p><p className="font-black text-emerald-900">{item.available ?? "غير محدود"}</p></div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-2">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[160px] flex-1 text-xs font-bold text-slate-600">الرصيد الفعلي الجديد<input aria-label={`الرصيد الفعلي ${item.name || item.productId}`} type="number" min={item.reserved} disabled={!canManage || inventory.loading || mutationPending} value={targets[item.productId] ?? item.onHand} onChange={(event) => setTargets((current) => ({ ...current, [item.productId]: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-black disabled:bg-slate-50" /></label>
                  <button type="button" disabled={!canManage || inventory.loading || mutationPending || !Number.isInteger(target) || target < item.reserved || target === item.onHand} onClick={() => void inventory.adjustTo(item, target)} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><Save className="h-4 w-4" /> تسجيل التسوية</button>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[150px] flex-1 text-xs font-bold text-slate-600">حد التنبيه<input aria-label={`حد التنبيه ${item.name || item.productId}`} type="number" min="0" disabled={!canManage || inventory.loading || mutationPending} value={thresholds[item.productId] ?? item.lowStockThreshold} onChange={(event) => setThresholds((current) => ({ ...current, [item.productId]: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-black disabled:bg-slate-50" /></label>
                  <button type="button" disabled={!canManage || inventory.loading || mutationPending || !Number.isInteger(threshold) || threshold < 0} onClick={() => void inventory.updatePolicy(item, !item.manageStock, threshold)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black disabled:opacity-40"><ShieldCheck className="h-4 w-4" /> {item.manageStock ? "إيقاف التتبع" : "تفعيل التتبع"}</button>
                  <button type="button" disabled={!canManage || inventory.loading || mutationPending || !Number.isInteger(threshold) || threshold < 0 || threshold === item.lowStockThreshold} onClick={() => void inventory.updatePolicy(item, item.manageStock, threshold)} className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-black text-sky-800 disabled:opacity-40">حفظ الحد</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
