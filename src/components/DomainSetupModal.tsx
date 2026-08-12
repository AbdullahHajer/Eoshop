import React, { useState } from "react";
import { 
  Globe, ShieldCheck, Sparkles, CreditCard, X, Check, ArrowRight, RefreshCw, Upload, CheckCircle2
} from "lucide-react";

interface DomainSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueToExport?: () => void;
  storeName: string;
  onSaveDomain?: (domain: string) => void;
}

export default function DomainSetupModal({
  isOpen,
  onClose,
  onContinueToExport,
  storeName,
  onSaveDomain
}: DomainSetupModalProps) {
  const [subdomainName, setSubdomainName] = useState(
    storeName ? storeName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/gi, "") : "mybrand"
  );
  const [selectedPackage, setSelectedPackage] = useState<"basic" | "growth" | "pro">("growth");
  const [isOrderSubmitted, setIsOrderSubmitted] = useState(false);
  const [crFileName, setCrFileName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsOrderSubmitted(true);
    
    const fullSubdomain = `${subdomainName.trim() || "mybrand"}.mobtaker.sa`;

    setTimeout(() => {
      setIsOrderSubmitted(false);
      if (onSaveDomain) {
        onSaveDomain(fullSubdomain);
      }
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-fadeIn overflow-y-auto dir-rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-800">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-sky-600 via-indigo-600 to-slate-900 text-white p-5 sm:p-6 relative shrink-0">
          <button
            onClick={onClose}
            type="button"
            className="absolute left-4 top-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0 shadow-inner">
              <Globe className="w-6 h-6 text-sky-200" />
            </div>
            <div>
              <span className="text-[11px] font-black bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block mb-1 shadow-2xs">
                خطوة اعتماد ونشر المتجر السحابي 🚀
              </span>
              <h3 className="text-lg sm:text-xl font-black text-white leading-tight">
                تحديد اسم الدومين الفرعي وتفعيل المتجر
              </h3>
              <p className="text-xs text-sky-100 font-medium mt-0.5">
                حدد الاسم الذي ترغب بظهوره في رابط متجرك الفرعي لتشغيل قاعدة البيانات المستقلة
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body - Scrollable */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">

          {/* 1. Subdomain Name Selection */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3">
            <label className="block text-xs font-extrabold text-slate-900">
              1. اختر اسم الدومين الفرعي لمتجرك <span className="text-rose-500">*</span>
            </label>

            <div className="flex items-center dir-ltr">
              <span className="px-3.5 py-3 bg-slate-200 border border-r-0 border-slate-300 text-slate-700 text-xs font-black rounded-l-xl select-none">
                .mobtaker.sa
              </span>
              <input
                type="text"
                value={subdomainName}
                onChange={(e) => setSubdomainName(e.target.value)}
                placeholder="storename"
                required
                className="w-full dir-ltr px-3.5 py-3 bg-white border border-slate-300 text-sm font-extrabold text-slate-900 rounded-r-xl focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200/60">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>الرابط النهائي المعاين لعملاء متجرك: <strong className="font-mono text-slate-900 dir-ltr inline-block">{subdomainName || "store"}.mobtaker.sa</strong></span>
            </div>
          </div>

          {/* 2. Cloud Subscription Plan Selection */}
          <div className="space-y-2.5">
            <label className="block text-xs font-extrabold text-slate-900">
              2. اختر باقة التشغيل السحابية <span className="text-rose-500">*</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Basic Plan */}
              <div 
                onClick={() => setSelectedPackage("basic")}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer space-y-1.5 relative ${
                  selectedPackage === "basic" 
                    ? "border-sky-500 bg-sky-50/50 shadow-xs" 
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900">الباقة الأساسية</span>
                  <span className="text-[10px] font-extrabold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">99 ر.س / شهرياً</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  متجر سحابي + 50 منتج + قاعدة بيانات آمنة.
                </p>
              </div>

              {/* Growth Plan (Recommended) */}
              <div 
                onClick={() => setSelectedPackage("growth")}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer space-y-1.5 relative overflow-hidden ${
                  selectedPackage === "growth" 
                    ? "border-sky-600 bg-sky-100/40 shadow-sm" 
                    : "border-slate-200 bg-white hover:border-sky-300"
                }`}
              >
                <div className="absolute top-0 left-0 bg-sky-600 text-white text-[9px] font-extrabold px-2.5 py-0.5 rounded-br-lg">
                  الموصى بها 🌟
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-sky-950">باقة النمو السريعة</span>
                  <span className="text-[10px] font-extrabold text-sky-800 bg-sky-200/60 px-2 py-0.5 rounded-full">199 ر.س / شهرياً</span>
                </div>
                <p className="text-[10px] text-sky-900/80 leading-relaxed font-medium">
                  منتجات غير محدودة + قاعدة بيانات PostgreSQL منفصلة تماماً لكل متجر.
                </p>
              </div>

              {/* Pro Plan */}
              <div 
                onClick={() => setSelectedPackage("pro")}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer space-y-1.5 relative ${
                  selectedPackage === "pro" 
                    ? "border-indigo-600 bg-indigo-50/50 shadow-xs" 
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900">الباقة الاحترافية</span>
                  <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">399 ر.س / شهرياً</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  قواعد بيانات معزولة عالية الأداء + دعم ربط البوابات البنكية المباشرة.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Commercial Document Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-extrabold text-slate-900">
              3. إرفاق وثيقة التوثيق التجاري (سجل تجاري / وثيقة عمل حر / صفحة موثقة) <span className="text-rose-500">*</span>
            </label>
            <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/80 text-center hover:bg-slate-100 transition cursor-pointer">
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
              <span className="text-xs font-bold text-slate-800 block">
                {crFileName ? `تم إرفاق: ${crFileName}` : "اسحب ملف السجل التجاري هنا أو اضغط للاختيار"}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">يدعم صيغ PDF, PNG, JPG (الحد الأقصى 10MB)</span>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isOrderSubmitted}
            className="w-full bg-gradient-to-r from-sky-600 via-indigo-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white font-extrabold py-4 px-6 rounded-2xl text-sm transition shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isOrderSubmitted ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>جارِ اعتماد الطلب وإنشاء قاعدة بيانات PostgreSQL وتفعيل الدومين الفرعي...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>تأكيد طلب التفعيل والاعتماد السحابي 🚀</span>
              </>
            )}
          </button>

        </form>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
}
