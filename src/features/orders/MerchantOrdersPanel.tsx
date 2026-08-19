import React from "react";
import type { OrderReceipt } from "../../adapters/uiAdapters";
import type { MerchantOrderAction } from "../../workflows/orderState";

interface MerchantOrdersPanelProps {
  orders: OrderReceipt[];
  loading: boolean;
  error: string | null;
  pendingOrderIds: ReadonlySet<string>;
  actionsFor: (order: OrderReceipt) => ReadonlyArray<MerchantOrderAction>;
  onAdvance: (order: OrderReceipt, status: OrderReceipt["status"]) => void;
}

export default function MerchantOrdersPanel({ orders, loading, error, pendingOrderIds, actionsFor, onAdvance }: MerchantOrdersPanelProps) {
  const mutationPending = pendingOrderIds.size > 0;
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="font-black text-slate-900">الطلبات المسجلة على الخادم</h3>
        <p className="mt-1 text-xs text-slate-500">الأسعار والحالات وحركات المخزون المعروضة هنا مصدرها الخادم.</p>
      </div>
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</div>}
      {loading && <div className="p-4 text-center text-xs font-bold text-slate-500">جارٍ تحميل الطلبات...</div>}
      {!loading && orders.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">لا توجد طلبات مسجلة بعد.</div>}
      {orders.map((order) => {
        return (
          <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-black text-slate-900">{order.number}</p>
                <p className="text-[11px] text-slate-500">{new Date(order.createdAt).toLocaleString("ar-SA")}</p>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-black text-sky-700">{order.status}</span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="font-mono text-sm font-black">{(order.totals.grandTotalMinor / 100).toFixed(2)} {order.currencyCode}</span>
              <div className="flex gap-2">
                {actionsFor(order).map((action) => (
                  <button
                    key={action.status}
                    disabled={loading || mutationPending}
                    onClick={() => onAdvance(order, action.status)}
                    className={action.tone === "danger"
                      ? "rounded-lg border border-rose-200 px-3 py-1.5 text-[11px] font-bold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      : "rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
