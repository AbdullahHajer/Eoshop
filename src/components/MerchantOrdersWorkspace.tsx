import React from "react";
import { RefreshCw, ShoppingBag } from "lucide-react";
import MerchantOrdersPanel from "../features/orders/MerchantOrdersPanel";
import { useMerchantOrders } from "../hooks/useMerchantOrders";
import { merchantOrderActions } from "../workflows/orderState";

interface MerchantOrdersWorkspaceProps {
  tenantId: string;
  canView: boolean;
  onSessionExpired?: () => void;
}

export default function MerchantOrdersWorkspace({ tenantId, canView, onSessionExpired }: MerchantOrdersWorkspaceProps) {
  const orders = useMerchantOrders(tenantId, canView, onSessionExpired);

  if (!canView) {
    return <div role="alert" className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-900">لا يملك هذا الحساب صلاحية عرض الطلبات.</div>;
  }

  return (
    <section className="space-y-4" aria-labelledby="orders-heading">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div><h2 id="orders-heading" className="flex items-center gap-2 text-xl font-black"><ShoppingBag className="h-5 w-5 text-sky-600" /> الطلبات</h2><p className="mt-1 text-sm text-slate-500">{orders.total === null ? "قائمة الخادم الحالية" : `${orders.total} طلب مسجل على الخادم`}</p></div>
        <button type="button" disabled={orders.loading || orders.pendingOrderIds.size > 0} onClick={() => void orders.load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${orders.loading ? "animate-spin" : ""}`} /> تحديث</button>
      </div>
      <MerchantOrdersPanel
        orders={orders.items}
        loading={orders.loading}
        error={orders.error}
        pendingOrderIds={orders.pendingOrderIds}
        actionsFor={merchantOrderActions}
        onAdvance={(order, status) => void orders.advance(order, status)}
      />
    </section>
  );
}
