import React from "react";
import { Sparkles } from "lucide-react";

interface StoreSubmissionPanelProps {
  storeName: string;
  slogan: string;
  productCount: number;
  onOpen: (() => void) | undefined;
}

export default function StoreSubmissionPanel({ storeName, slogan, productCount, onOpen }: StoreSubmissionPanelProps) {
  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-l from-indigo-50 to-sky-50 p-5">
        <h4 className="flex items-center gap-2 text-sm font-black text-indigo-950"><Sparkles className="h-5 w-5 text-indigo-600" /> إرسال طلب المتجر الحقيقي</h4>
        <p className="mt-2 text-xs leading-relaxed text-indigo-800">ستفتح نافذة متصلة بالخادم لاختيار عنوان متاح وباقة فعلية. إرسال الطلب يحجز العنوان ويضع المتجر للمراجعة فقط؛ تجهيز قاعدة البيانات والنشر عمليتان لاحقتان محميتان.</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">ملخص التصميم الحالي</span>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <h5 className="text-sm font-extrabold text-slate-900">{storeName}</h5>
            <p className="text-xs text-slate-500">{slogan}</p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{productCount} منتج</span>
        </div>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">رفع مستندات التحقق، الدفع الإلكتروني، والنطاقات الخارجية ليست مفعلة في هذه المرحلة ولن تدّعي الواجهة نجاحها.</div>
      <button type="button" onClick={() => onOpen?.()} disabled={!onOpen} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-emerald-600 via-sky-600 to-indigo-600 px-6 py-4 text-sm font-extrabold text-white shadow-lg disabled:opacity-50">
        <Sparkles className="h-5 w-5" /> اختيار العنوان والباقة وإرسال الطلب
      </button>
    </div>
  );
}
