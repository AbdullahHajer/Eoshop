import React, { useEffect, useRef, useState } from "react";
import { Edit3, Package, RefreshCw } from "lucide-react";
import { useUiAdapters } from "../adapters/UiAdaptersContext";
import { isUiError, uiErrorMessage } from "../contracts/uiError";
import type { CatalogSnapshot } from "../adapters/uiAdapters";

interface MerchantCatalogPanelProps {
  tenantId: string;
  canEditInBuilder: boolean;
  onEdit: () => void;
  onSessionExpired?: () => void;
}

export default function MerchantCatalogPanel({ tenantId, canEditInBuilder, onEdit, onSessionExpired }: MerchantCatalogPanelProps) {
  const { catalog } = useUiAdapters();
  const [snapshot, setSnapshot] = useState<CatalogSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const sessionExpired = useRef(onSessionExpired);
  sessionExpired.current = onSessionExpired;

  const load = () => {
    activeRequest.current?.abort();
    const operation = ++sequence.current;
    const controller = new AbortController();
    activeRequest.current = controller;
    setSnapshot(null);
    setLoading(true);
    setError(null);
    catalog.load(tenantId, controller.signal).then((result) => {
      if (operation === sequence.current) setSnapshot(result);
    }).catch((caught) => {
      if (operation !== sequence.current || isUiError(caught, "aborted")) return;
      if (isUiError(caught, "unauthenticated")) {
        sessionExpired.current?.();
        return;
      }
      setSnapshot(null);
      setError(uiErrorMessage(caught, "تعذر تحميل منتجات المتجر."));
    }).finally(() => {
      if (operation === sequence.current) {
        activeRequest.current = null;
        setLoading(false);
      }
    });
    return controller;
  };

  useEffect(() => {
    const controller = load();
    return () => {
      sequence.current += 1;
      controller.abort();
      if (activeRequest.current === controller) activeRequest.current = null;
    };
  }, [catalog, tenantId]);

  return (
    <section className="space-y-5" aria-labelledby="catalog-heading">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div><h2 id="catalog-heading" className="text-xl font-black">المنتجات</h2><p className="mt-1 text-sm text-slate-500">لقطة الكتالوج الحالية من الخادم، بما فيها المسودات والمؤرشف.</p></div>
        <div className="flex gap-2"><button type="button" disabled={loading} onClick={() => { load(); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-black disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> تحديث</button>{canEditInBuilder && <button type="button" onClick={onEdit} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white"><Edit3 className="h-4 w-4" /> إضافة وتعديل المنتجات</button>}</div>
      </div>
      {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</div>}
      {!loading && snapshot?.products.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500"><Package className="mx-auto mb-3 h-7 w-7" />لا توجد منتجات بعد.</div>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {snapshot?.products.map((product) => <article key={product.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-black">{product.name}</h3><p className="mt-1 truncate text-xs text-slate-500">{product.sku || "بدون SKU"} · {product.category || "دون تصنيف"}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${product.status === "published" ? "bg-emerald-50 text-emerald-700" : product.status === "archived" ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-800"}`}>{product.status === "published" ? "منشور" : product.status === "archived" ? "مؤرشف" : "مسودة"}</span></div><p className="mt-4 font-mono text-lg font-black">{(product.salePrice ?? product.basePrice ?? product.price).toFixed(2)} {snapshot.currencyCode}</p></article>)}
      </div>
    </section>
  );
}
