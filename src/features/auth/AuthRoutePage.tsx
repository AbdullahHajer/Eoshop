import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, Phone, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useUiAdapters } from "../../adapters/UiAdaptersContext";
import type { UserProfile } from "../../adapters/uiAdapters";
import { uiErrorMessage } from "../../adapters/uiAdapters";
import { usePlatformSettings } from "../../adapters/PlatformSettingsContext";
import { authorizeReturnTarget, readSafeReturnTarget } from "../../app/safeReturnTarget";

type AuthMode = "login" | "register" | "forgot" | "reset";

interface AuthRoutePageProps {
  mode: AuthMode;
  currentUser: UserProfile | null;
  restoring: boolean;
  onAuthenticated: (user: UserProfile) => void;
}

export default function AuthRoutePage({ mode, currentUser, restoring, onAuthenticated }: AuthRoutePageProps) {
  const { auth, provisioning } = useUiAdapters();
  const { settings } = usePlatformSettings();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get("email") ?? "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const returnTarget = useMemo(() => readSafeReturnTarget(window.location.search), []);

  const continueAfterAuthentication = async (user: UserProfile) => {
    onAuthenticated(user);
    let stores = [];
    try {
      stores = await provisioning.listStores();
    } catch {
      // A failed optional destination lookup must not turn a valid login into a false failure.
    }
    window.location.assign(authorizeReturnTarget(returnTarget, user, stores));
  };

  useEffect(() => {
    if (!restoring && currentUser && (mode === "login" || mode === "register")) void continueAfterAuthentication(currentUser);
  }, [currentUser, mode, restoring]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "forgot") {
        setNotice(await auth.forgotPassword(email));
      } else if (mode === "reset") {
        const token = new URLSearchParams(window.location.search).get("token") ?? "";
        setNotice(await auth.resetPassword({ token, email, password, passwordConfirmation: confirmation }));
        setPassword("");
        setConfirmation("");
      } else {
        const user = mode === "register"
          ? await auth.register({ name, email, phone, password, passwordConfirmation: confirmation })
          : await auth.login(email, password);
        await continueAfterAuthentication(user);
      }
    } catch (caught) {
      setError(uiErrorMessage(caught, "تعذر إكمال العملية. راجع البيانات وحاول مرة أخرى."));
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<AuthMode, [string, string]> = {
    login: ["مرحبًا بعودتك", "ادخل إلى حسابك لإدارة متاجرك ومتابعة طلباتك."],
    register: ["ابدأ حساب التاجر", "حساب واحد آمن يقودك من الفكرة حتى نشر المتجر."],
    forgot: ["استعادة الوصول", "أدخل بريدك وسنرسل التعليمات إن كان الحساب موجودًا."],
    reset: ["تعيين كلمة مرور جديدة", "استخدم الرابط الآمن واختر كلمة مرور قوية لا تقل عن 10 أحرف."],
  };
  const inputClass = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-normal outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100";

  return (
    <main dir="rtl" className="min-h-screen bg-slate-950 px-4 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-sky-600 via-indigo-700 to-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <a href="/" className="relative flex items-center gap-3 font-black">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><Sparkles className="h-6 w-6" /></span>
            <span><b className="block text-xl">{settings.platformName}</b><small className="text-sky-100">{settings.tagline}</small></span>
          </a>
          <div className="relative space-y-5">
            <p className="text-4xl font-black leading-tight">متجرك يبدأ بخطوات واضحة، وليس بنوافذ متفرقة.</p>
            <ul className="space-y-3 text-sm text-sky-50">
              {["جلسة حقيقية محمية من الخادم", "مسودة متجر تستمر بعد إعادة التحميل", "مراجعة وتجهيز ونشر بحالات واضحة"].map((text) => (
                <li key={text} className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-300" />{text}</li>
              ))}
            </ul>
          </div>
          <p className="relative text-xs text-sky-100">لن نطلب منك بيانات دفع أو وعود نشر غير متاحة في هذه الخطوة.</p>
        </section>

        <section className="flex items-center p-6 sm:p-10 lg:p-14">
          <div className="mx-auto w-full max-w-md">
            <a href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-sky-700"><ArrowLeft className="h-4 w-4" />العودة للرئيسية</a>
            <h1 className="text-3xl font-black text-slate-950">{titles[mode][0]}</h1>
            <p className="mt-2 text-sm leading-7 text-slate-500">{titles[mode][1]}</p>

            {error && <div role="alert" className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
            {notice && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{notice}</div>}

            <form onSubmit={submit} className="mt-7 space-y-4">
              {mode === "register" && <Field icon={UserRound} label="الاسم الكامل"><input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} autoComplete="name" className={inputClass} /></Field>}
              <Field icon={Mail} label="البريد الإلكتروني"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={255} autoComplete="email" dir="ltr" className={`${inputClass} text-left`} /></Field>
              {mode === "register" && <Field icon={Phone} label="رقم الهاتف — اختياري"><input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={32} autoComplete="tel" dir="ltr" placeholder="+967 7xx xxx xxx" className={`${inputClass} text-left`} /></Field>}
              {(mode === "login" || mode === "register" || mode === "reset") && (
                <Field icon={LockKeyhole} label={mode === "reset" ? "كلمة المرور الجديدة" : "كلمة المرور"}>
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "login" ? undefined : 10} autoComplete={mode === "login" ? "current-password" : "new-password"} className={`${inputClass} pl-12`} />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="إظهار أو إخفاء كلمة المرور" className="absolute left-3 top-9 text-slate-400">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                </Field>
              )}
              {(mode === "register" || mode === "reset") && <Field icon={LockKeyhole} label="تأكيد كلمة المرور"><input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={10} autoComplete="new-password" className={inputClass} /></Field>}

              <button disabled={busy || restoring} className="w-full rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-60">
                {busy ? "جاري المعالجة..." : mode === "login" ? "تسجيل الدخول" : mode === "register" ? "إنشاء الحساب والمتابعة" : mode === "forgot" ? "إرسال تعليمات الاستعادة" : "تحديث كلمة المرور"}
              </button>
            </form>

            <nav className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-bold text-sky-700">
              {mode !== "login" && <a href="/login">لدي حساب</a>}
              {mode !== "register" && <a href="/register">إنشاء حساب جديد</a>}
              {mode === "login" && <a href="/forgot-password">نسيت كلمة المرور؟</a>}
              {mode === "reset" && notice && <a href="/login">الانتقال لتسجيل الدخول</a>}
            </nav>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return <label className="relative block text-sm font-bold text-slate-700"><span className="mb-2 flex items-center gap-2"><Icon className="h-4 w-4 text-sky-600" />{label}</span>{children}</label>;
}
