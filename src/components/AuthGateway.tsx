import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { 
  User, Mail, Phone, Lock, Eye, EyeOff, ShieldCheck, 
  Sparkles, LogOut, X, ChevronLeft, LogIn, AlertCircle
} from "lucide-react";
import { authApi, AuthApiError, toUserProfile } from "../services/authApi";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "merchant" | "admin";
  platformRoles: string[];
  platformPermissions: string[];
  createdStoreId?: string;
  createdStoreName?: string;
  storeStatus?: "pending" | "approved" | "rejected" | "none";
}

interface AuthGatewayProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onLoginSuccess: (user: UserProfile) => void;
  onLogout: () => Promise<void>;
  onStartStoreCreation: () => void;
  initialMode?: "login" | "signup";
}

export default function AuthGateway({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout,
  onStartStoreCreation,
  initialMode = "signup"
}: AuthGatewayProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  
  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Password Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError("");
      setNotice("");
    }
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: "", color: "" };
    if (pwd.length < 6) return { score: 1, label: "ضعيفة جداً", color: "bg-rose-500" };
    if (pwd.length < 8) return { score: 2, label: "متوسطة", color: "bg-amber-500" };
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) return { score: 4, label: "قوية جداً 🛡️", color: "bg-emerald-500" };
    return { score: 3, label: "جيدة", color: "bg-sky-500" };
  };

  const pwdStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "signup") {
      if (!fullName.trim() || !email.trim() || !phone.trim() || !password.trim() || !confirmPassword.trim()) {
        setError("الرجاء إدخال جميع البيانات المطلوبة لإنشاء الحساب");
        return;
      }
      if (password.length < 10) {
        setError("كلمة المرور يجب أن لا تقل عن 10 خانات");
        return;
      }
      if (password !== confirmPassword) {
        setError("كلمتا المرور غير متطابقتين! يرجى التأكد من كتابتهما بنسق متطابق");
        return;
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError("الرجاء إدخال البريد الإلكتروني وكلمة المرور");
        return;
      }
    }

    setLoading(true);

    try {
      const authenticated = mode === "signup"
        ? await authApi.register({
            name: fullName,
            email,
            phone,
            password,
            passwordConfirmation: confirmPassword,
          })
        : await authApi.login(email, password);

      const newUser = toUserProfile(authenticated);
      onLoginSuccess(newUser);
      onClose();
    } catch (requestError) {
      setError(requestError instanceof AuthApiError ? requestError.message : "تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setNotice("");

    if (!email.trim()) {
      setError("أدخل البريد الإلكتروني أولاً لإرسال تعليمات الاستعادة.");
      return;
    }

    setLoading(true);

    try {
      setNotice(await authApi.forgotPassword(email));
    } catch (requestError) {
      setError(requestError instanceof AuthApiError ? requestError.message : "تعذر إرسال طلب الاستعادة.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md dir-rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden my-auto max-h-[92vh] flex flex-col"
      >
        {/* Top Gradient accent bar */}
        <div className="h-2 bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500 shrink-0" />
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* If user is logged in -> Merchant Profile View */}
        {currentUser ? (
          <div className="p-8 text-right overflow-y-auto">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-sky-500/20 shrink-0">
                {currentUser.fullName.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  مرحباً، {currentUser.fullName} 👋
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {currentUser.email}
                </p>
                <div className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  جلسة حساب نشطة
                </div>
              </div>
            </div>

            {/* Merchant Status Card */}
            <div className="space-y-4 mb-8">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-50 to-sky-50/50 dark:from-slate-800/50 dark:to-sky-950/30 border border-sky-100 dark:border-sky-900/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">حالة المتجر الإلكتروني</span>
                  {currentUser.storeStatus === "approved" ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">مفعل ونشط 🎉</span>
                  ) : currentUser.storeStatus === "pending" ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">قيد المراجعة ⏳</span>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">جاهز للتصميم والإنشاء</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  يمكنك البدء وتصميم متجرك وتخصيص هويتك بالكامل وإرساله للاعتماد السريع.
                </p>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onStartStoreCreation();
                }}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-base shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
              >
                <Sparkles className="w-5 h-5" />
                <span>أنشئ متجرك الإلكتروني الآن 🚀</span>
              </button>
            </div>

            {/* Logout Action */}
            <button
              onClick={async () => {
                setError("");
                try {
                  await onLogout();
                  onClose();
                } catch {
                  setError("تعذر إنهاء الجلسة على الخادم. تحقق من الاتصال ثم حاول مجددًا.");
                }
              }}
              className="w-full py-3 px-4 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج من الحساب</span>
            </button>
          </div>
        ) : (
          /* Sign-up / Sign-in Tabs & Form */
          <div className="p-7 text-right overflow-y-auto">
            {/* Header Tabs */}
            <div className="text-center mb-5">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1.5">
                {mode === "signup" ? "إنشاء حساب تاجر جديد" : "تسجيل الدخول للمنصة"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === "signup" 
                  ? "سجّل حسابك في ثوانٍ لبدء تصميم وتأمين متجرك الإلكتروني" 
                  : "أدخل بيانات حسابك للمتابعة وإدارة متاجرك السحابية"}
              </p>
            </div>

            {/* Tab Selector */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(""); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  mode === "signup"
                    ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                إنشاء حساب جديد ✨
              </button>
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  mode === "login"
                    ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                تسجيل الدخول 🔑
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {notice && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                {notice}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الاسم الكامل للتاجر <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                    <input
                      type="text"
                      placeholder="مثال: عبدالرحمن بن خالد"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  البريد الإلكتروني <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>
              </div>

              {mode === "login" && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-500 disabled:opacity-50"
                >
                  نسيت كلمة المرور؟ أرسل تعليمات الاستعادة
                </button>
              )}

              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم الجوال للتواصل <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                    <input
                      type="tel"
                      placeholder="+966 50 123 4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  كلمة المرور <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pr-10 pl-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === "signup" && password && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="h-1.5 flex-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full ${pwdStrength.color} transition-all`} style={{ width: `${pwdStrength.score * 25}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500">{pwdStrength.label}</span>
                  </div>
                )}
              </div>

              {/* Confirm Password field in Signup Mode */}
              {mode === "signup" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تأكيد كلمة المرور <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pr-10 pl-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 py-3.5 px-6 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span>جاري التحقق والمعالجة...</span>
                ) : (
                  <>
                    <span>{mode === "signup" ? "إنشاء الحساب وبدء المنصة 🚀" : "تسجيل الدخول للحساب 🔑"}</span>
                    <ChevronLeft className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}
