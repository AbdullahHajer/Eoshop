import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, KeyRound, LogOut, Mail, Phone, Save, ShieldCheck, UserRound } from "lucide-react";
import { useUiAdapters } from "../../adapters/UiAdaptersContext";
import { isUiError, uiErrorMessage, type UserProfile } from "../../adapters/uiAdapters";
import { usePlatformSettings } from "../../adapters/PlatformSettingsContext";

interface AccountPageProps {
  user: UserProfile;
  onUserChanged: (user: UserProfile) => void;
  onLoggedOut: () => void;
  onSessionExpired: (returnTo: string) => void;
}

export default function AccountPage({ user, onUserChanged, onLoggedOut, onSessionExpired }: AccountPageProps) {
  const { auth, provisioning } = useUiAdapters();
  const { settings } = usePlatformSettings();
  const [name, setName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "conflict" } | null>(null);
  const operation = useRef(0);
  const operationController = useRef<AbortController | null>(null);
  const dirty = useMemo(() => name.trim() !== user.fullName || phone.trim() !== user.phone, [name, phone, user]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  useEffect(() => {
    operation.current += 1;
    operationController.current?.abort();
    setName(user.fullName);
    setPhone(user.phone);
    setCurrentPassword("");
    setPassword("");
    setConfirmation("");
    setProfileBusy(false);
    setPasswordBusy(false);
    setMessage(null);
  }, [user.id]);

  useEffect(() => () => {
    operation.current += 1;
    operationController.current?.abort();
  }, []);

  const expireSession = () => {
    operation.current += 1;
    operationController.current?.abort();
    onSessionExpired("/app/account");
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const sequence = ++operation.current;
    operationController.current?.abort();
    const controller = new AbortController();
    operationController.current = controller;
    setProfileBusy(true);
    setMessage(null);
    try {
      const updated = await auth.updateProfile({
        expectedRevision: user.profileRevision,
        name,
        phone: phone.trim() || null,
      }, controller.signal);
      if (sequence !== operation.current) return;
      onUserChanged(updated);
      setName(updated.fullName);
      setPhone(updated.phone);
      setMessage({ text: "حُفظ الملف الشخصي على الخادم.", type: "success" });
    } catch (caught) {
      if (sequence !== operation.current) return;
      if (isUiError(caught, "unauthenticated")) {
        expireSession();
        return;
      }
      if (isUiError(caught, "conflict")) {
        try {
          const current = await auth.session(controller.signal);
          if (sequence !== operation.current || !current) return;
          onUserChanged(current);
          setMessage({ text: "تغير الملف على الخادم. حمّلنا النسخة الأحدث وحافظنا على مدخلاتك؛ راجعها ثم اضغط حفظ لتطبيقها يدويًا.", type: "conflict" });
        } catch (reloadFailure) {
          if (isUiError(reloadFailure, "unauthenticated")) {
            expireSession();
            return;
          }
          setMessage({ text: "تغير الملف على الخادم وتعذر تحميل نسخته الأحدث. حدّث الصفحة قبل إعادة الحفظ.", type: "error" });
        }
      } else {
        setMessage({ text: uiErrorMessage(caught, "تعذر حفظ الملف الشخصي."), type: "error" });
      }
    } finally {
      if (sequence === operation.current) setProfileBusy(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const sequence = ++operation.current;
    operationController.current?.abort();
    const controller = new AbortController();
    operationController.current = controller;
    setPasswordBusy(true);
    setMessage(null);
    try {
      const response = await auth.changePassword({ currentPassword, password, passwordConfirmation: confirmation }, controller.signal);
      if (sequence !== operation.current) return;
      setCurrentPassword("");
      setPassword("");
      setConfirmation("");
      setMessage({ text: response, type: "success" });
    } catch (caught) {
      if (sequence !== operation.current || isUiError(caught, "aborted")) return;
      if (isUiError(caught, "unauthenticated")) {
        expireSession();
        return;
      }
      setMessage({ text: uiErrorMessage(caught, "تعذر تغيير كلمة المرور."), type: "error" });
    } finally {
      if (sequence === operation.current) setPasswordBusy(false);
    }
  };

  const logout = async () => {
    if (dirty && !window.confirm("توجد تعديلات ملف شخصي غير محفوظة. هل تريد تجاهلها وتسجيل الخروج؟")) return;
    operation.current += 1;
    try {
      await auth.logout();
      provisioning.clearPendingForOwner(user.id);
      onLoggedOut();
      window.location.assign("/");
    } catch (caught) {
      setMessage({ text: uiErrorMessage(caught, "تعذر تسجيل الخروج من الخادم."), type: "error" });
    }
  };

  const inputClass = "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100";

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-slate-950 px-6 py-5 text-white shadow-xl">
          <div><p className="text-xs font-bold text-sky-300">{settings.platformName}</p><h1 className="mt-1 text-2xl font-black">حساب التاجر</h1><p className="mt-1 text-xs text-slate-300">بيانات الهوية والجلسة — منفصلة عن إعدادات كل متجر.</p></div>
          <div className="flex gap-2"><a href="/app" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold hover:bg-white/20"><ArrowRight className="h-4 w-4" />بوابة المتاجر</a><button onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-bold"><LogOut className="h-4 w-4" />خروج</button></div>
        </header>

        {message && <div role="status" className={`mb-6 rounded-2xl border p-4 text-sm font-bold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : message.type === "conflict" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message.text}</div>}

        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={saveProfile} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3"><span className="rounded-2xl bg-sky-100 p-3 text-sky-700"><UserRound className="h-6 w-6" /></span><div><h2 className="font-black">الملف الشخصي</h2><p className="text-xs text-slate-500">نسخة الملف: {user.profileRevision}</p></div></div>
            <label className="block text-sm font-bold text-slate-700">الاسم الكامل<input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} className={inputClass} /></label>
            <label className="mt-4 block text-sm font-bold text-slate-700"><span className="flex items-center gap-2"><Mail className="h-4 w-4" />البريد — للقراءة فقط</span><input readOnly value={user.email} dir="ltr" className={`${inputClass} bg-slate-100 text-left text-slate-500`} /></label>
            <label className="mt-4 block text-sm font-bold text-slate-700"><span className="flex items-center gap-2"><Phone className="h-4 w-4" />رقم الهاتف</span><input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={32} dir="ltr" placeholder="+967 7xx xxx xxx" className={`${inputClass} text-left`} /></label>
            <button disabled={profileBusy || !dirty} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{profileBusy ? "جاري الحفظ..." : "حفظ الملف الشخصي"}</button>
          </form>

          <form onSubmit={changePassword} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3"><span className="rounded-2xl bg-indigo-100 p-3 text-indigo-700"><KeyRound className="h-6 w-6" /></span><div><h2 className="font-black">أمان كلمة المرور</h2><p className="text-xs text-slate-500">التغيير يلغي الجلسات والروابط القديمة.</p></div></div>
            <label className="block text-sm font-bold text-slate-700">كلمة المرور الحالية<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" className={inputClass} /></label>
            <label className="mt-4 block text-sm font-bold text-slate-700">كلمة المرور الجديدة<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} autoComplete="new-password" className={inputClass} /></label>
            <label className="mt-4 block text-sm font-bold text-slate-700">تأكيد كلمة المرور<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={10} autoComplete="new-password" className={inputClass} /></label>
            <div className="mt-5 flex gap-3 rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" /><p>بعد النجاح تبقى هذه الجلسة فقط، وتصبح روابط إعادة التعيين الصادرة سابقًا غير صالحة.</p></div>
            <button disabled={passwordBusy} className="mt-6 w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{passwordBusy ? "جاري التحديث..." : "تغيير كلمة المرور"}</button>
          </form>
        </div>
      </div>
    </main>
  );
}
