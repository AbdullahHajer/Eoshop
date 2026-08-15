import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Globe, RefreshCw, ShieldCheck, X } from "lucide-react";
import { AuthApiError } from "../services/authApi";
import { provisioningApi, type StoreSubmission } from "../services/provisioningApi";

interface DomainSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeName: string;
  businessType: string;
  themeStyle: "elegant" | "tech";
  config: Record<string, unknown>;
  onSubmitted?: (submission: StoreSubmission) => void;
}

const tenantBaseDomain = import.meta.env.VITE_TENANT_BASE_DOMAIN || "eoshop.local";

export default function DomainSetupModal({ isOpen, onClose, storeName, businessType, themeStyle, config, onSubmitted }: DomainSetupModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await provisioningApi.submit({ storeName, businessType, themeStyle, config });
      onSubmitted?.(response.data);
      onClose();
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : "تعذر إرسال طلب المتجر. حاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" dir="rtl">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="relative bg-gradient-to-l from-sky-600 via-indigo-600 to-slate-900 p-6 text-white">
          <button onClick={onClose} type="button" className="absolute left-4 top-4 rounded-full bg-white/10 p-2 hover:bg-white/20" aria-label="إغلاق"><X className="h-5 w-5" /></button>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/30 bg-white/15 p-3"><Globe className="h-6 w-6" /></div>
            <div>
              <h3 className="text-lg font-black">إرسال المتجر للمراجعة والتجهيز</h3>
              <p className="mt-1 text-xs text-sky-100">سيُحجز العنوان داخل المنصة، ثم يبدأ التجهيز الآلي فقط بعد موافقة الإدارة.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-black text-slate-900">عنوان تشغيل داخلي آمن</p>
            <p className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-xs font-bold text-slate-700" dir="ltr">store-&lt;tenant-id&gt;.{tenantBaseDomain}</p>
            <p className="mt-2 text-[11px] text-slate-500">اختيار النطاق التجاري وحجزه والتحقق منه مؤجل إلى WP 2.3.</p>
          </div>

          <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
            <p className="flex items-center gap-2 font-black"><ShieldCheck className="h-4 w-4" /> العملية قابلة لإعادة المحاولة ولا تنشئ متجرًا نصف جاهز.</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> الباقات والدفع والنطاقات المخصصة ستُفعّل في الخطوة WP 2.3.</p>
          </div>

          <button disabled={submitting} type="submit" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-sky-600 to-indigo-700 px-5 py-4 text-sm font-black text-white shadow-lg disabled:opacity-60">
            {submitting && <RefreshCw className="h-5 w-5 animate-spin" />}
            {submitting ? "جارٍ إرسال الطلب بأمان..." : "إرسال الطلب للمراجعة"}
          </button>
        </form>
      </div>
    </div>
  );
}
