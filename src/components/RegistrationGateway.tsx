import React, { useState } from "react";
import { Building2, Globe, Mail, ShieldCheck, User, X } from "lucide-react";
import { motion } from "motion/react";

interface RegistrationGatewayProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userData: {
    fullName: string;
    email: string;
    businessName: string;
    businessType: string;
    socialPageUrl?: string;
    docType: string;
    fileName: string;
    fileSize: string;
  }) => void;
  initialStoreName?: string;
  currentUser?: {
    fullName: string;
    email: string;
    businessName: string;
    businessType: string;
    socialPageUrl?: string;
    docType: string;
    fileName?: string;
    fileSize?: string;
  } | null;
  authenticatedUser: {
    fullName: string;
    email: string;
  };
}

export default function RegistrationGateway({
  isOpen,
  onClose,
  onSuccess,
  initialStoreName = "",
  currentUser = null,
  authenticatedUser,
}: RegistrationGatewayProps) {
  const [businessName, setBusinessName] = useState(currentUser?.businessName || initialStoreName);
  const [businessType, setBusinessType] = useState(currentUser?.businessType || "تجزئة");
  const [socialPageUrl, setSocialPageUrl] = useState(currentUser?.socialPageUrl || "");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!businessName.trim()) {
      setError("أدخل اسم النشاط أو المتجر للمتابعة.");
      return;
    }

    onSuccess({
      fullName: authenticatedUser.fullName,
      email: authenticatedUser.email,
      businessName: businessName.trim(),
      businessType,
      socialPageUrl: socialPageUrl.trim() || undefined,
      docType: "not_collected",
      fileName: "",
      fileSize: "",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md" dir="rtl">
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-gradient-to-l from-sky-900 to-slate-950 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-sky-400/30 bg-sky-500/20 p-2.5 text-sky-300"><Building2 className="h-6 w-6" /></div>
            <div>
              <h2 className="text-lg font-black">بيانات أولية لتخصيص التجربة</h2>
              <p className="text-[11px] text-sky-200">هذه ليست عملية توثيق أو إنشاء متجر على الخادم.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="rounded-full p-2 text-slate-300 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </header>

        <form onSubmit={submit} className="space-y-5 p-6">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs leading-relaxed text-indigo-900">
            <p className="flex items-center gap-2 font-black"><ShieldCheck className="h-4 w-4" /> حدود هذه الخطوة واضحة</p>
            <p className="mt-1">نحفظ هذه البيانات محليًا لمساعدتك في التصميم فقط. حجز النطاق واختيار الباقة وإرسال الطلب الحقيقي يتم لاحقًا من نافذة النشر المتصلة بالخادم.</p>
          </div>
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">
              اسم صاحب الحساب
              <span className="relative mt-2 block"><User className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><input readOnly value={authenticatedUser.fullName} className="w-full rounded-xl border border-slate-200 bg-slate-100 py-3 pr-10 pl-3 text-xs" /></span>
            </label>
            <label className="text-xs font-bold text-slate-700">
              البريد المرتبط بالجلسة
              <span className="relative mt-2 block"><Mail className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><input readOnly value={authenticatedUser.email} className="w-full rounded-xl border border-slate-200 bg-slate-100 py-3 pr-10 pl-3 text-xs" /></span>
            </label>
          </div>

          <label className="block text-xs font-bold text-slate-700">اسم النشاط أو المتجر
            <input required value={businessName} onChange={(event) => setBusinessName(event.target.value)} maxLength={255} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-sky-500" />
          </label>
          <label className="block text-xs font-bold text-slate-700">نوع النشاط
            <select value={businessType} onChange={(event) => setBusinessType(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <option value="تجزئة">تجزئة</option>
              <option value="أغذية ومشروبات">أغذية ومشروبات</option>
              <option value="أزياء">أزياء</option>
              <option value="عطور وبخور">عطور وبخور</option>
              <option value="خدمات">خدمات</option>
              <option value="أخرى">أخرى</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-700">رابط صفحة التواصل — اختياري
            <span className="relative mt-2 block"><Globe className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><input type="url" value={socialPageUrl} onChange={(event) => setSocialPageUrl(event.target.value)} placeholder="https://facebook.com/your-page" dir="ltr" className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-3 text-left text-sm outline-none focus:border-sky-500" /></span>
          </label>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-bold text-slate-600">إلغاء</button>
            <button type="submit" className="rounded-xl bg-slate-900 px-6 py-3 text-xs font-black text-white">حفظ البيانات ومتابعة التصميم</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
