import React, { useEffect } from "react";
import { ArrowLeft, Check, RefreshCw, ShieldCheck } from "lucide-react";
import { useUiAdapters } from "../adapters/UiAdaptersContext";
import type { StorePlan } from "../adapters/uiAdapters";
import { useApiTask } from "../hooks/useApiTask";

interface ServerPricingPlansProps {
  onStart: () => void;
}

const featureLabels: Record<string, string> = {
  platform_subdomain: "عنوان متجر داخل منصة Eoshop",
  basic_theme: "القالب الأساسي",
  unlimited_products: "منتجات غير محدودة بحسب الباقة",
  priority_review: "أولوية في المراجعة",
  multi_store: "إدارة أكثر من متجر",
};

export default function ServerPricingPlans({ onStart }: ServerPricingPlansProps) {
  const { plans: planActions } = useUiAdapters();
  const plansTask = useApiTask<StorePlan[], []>(planActions.list, { retry: "safe" });
  const plans = plansTask.data ?? [];

  useEffect(() => {
    void plansTask.execute();
  }, [plansTask.execute]);

  return (
    <section id="pricing" className="scroll-mt-6 border-t border-slate-200/80 bg-slate-50 py-16 md:py-24">
      <div className="container mx-auto px-6">
        <div className="mx-auto mb-12 max-w-2xl space-y-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-black text-indigo-800"><ShieldCheck className="h-4 w-4" /> باقات موثقة من خادم Eoshop</span>
          <h2 className="font-display text-3xl font-black text-slate-900 md:text-4xl">الباقات والأسعار</h2>
          <p className="text-sm leading-relaxed text-slate-600">اختيار الباقة المدفوعة يسجل طلبًا فقط؛ تفعيلها إداري في هذه المرحلة، ولم تُربط بوابة دفع إلكترونية بعد.</p>
        </div>

        {plansTask.loading && <div className="flex justify-center py-12 text-indigo-700"><RefreshCw className="h-7 w-7 animate-spin" /></div>}
        {plansTask.error && (
          <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-sm font-bold text-rose-700">
            <p>{plansTask.error.message}</p>
            {plansTask.canRetry && (
              <button type="button" onClick={() => void plansTask.retry()} className="flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-xs text-white">
                <RefreshCw className="h-4 w-4" /> إعادة المحاولة
              </button>
            )}
          </div>
        )}
        {!plansTask.loading && !plansTask.error && (
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.key} className={`flex flex-col rounded-3xl border bg-white p-7 shadow-sm ${plan.key === "pro" ? "border-2 border-amber-500 shadow-lg" : "border-slate-200"}`}>
                <h3 className="text-xl font-black text-slate-950">{plan.name}</h3>
                <div className="my-5 border-y border-slate-100 py-4">
                  <span className="text-4xl font-black text-slate-950">{((plan.priceMinor ?? 0) / 100).toLocaleString("ar-SA")}</span>
                  <span className="mr-2 text-xs font-bold text-slate-500">{plan.currency} / شهريًا</span>
                </div>
                <ul className="flex-1 space-y-3 text-xs text-slate-600">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> حتى {plan.maxStores} {plan.maxStores === 1 ? "متجر" : "متاجر"}</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> {plan.maxProducts === null ? "منتجات غير محدودة" : `حتى ${plan.maxProducts} منتجات`}</li>
                  {plan.features.map((feature) => <li key={feature} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> {featureLabels[feature] ?? feature}</li>)}
                </ul>
                <p className="mt-5 rounded-xl bg-slate-50 p-3 text-[11px] font-bold text-slate-600">{plan.activationMode === "automatic" ? "تفعيل آلي للباقة بعد إنشاء الطلب." : "يتطلب تفعيلًا يدويًا من الإدارة؛ لا توجد مطالبة بدفع ناجح."}</p>
                <button onClick={onStart} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-black text-white hover:bg-slate-800">ابدأ تصميم المتجر <ArrowLeft className="h-4 w-4" /></button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
