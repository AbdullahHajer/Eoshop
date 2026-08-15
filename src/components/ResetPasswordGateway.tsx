import React, { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { authApi } from "../services/authApi";
import { ApiError } from "../services/apiClient";

export default function ResetPasswordGateway() {
  const parameters = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = parameters.get("token") ?? "";
  const email = parameters.get("email") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token || !email) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 10 || password !== confirmation) {
      setError("استخدم كلمة مرور من 10 خانات على الأقل وتأكد من تطابقها.");
      return;
    }

    setLoading(true);

    try {
      setMessage(await authApi.resetPassword({
        token,
        email,
        password,
        passwordConfirmation: confirmation,
      }));
      window.history.replaceState({}, "", window.location.pathname);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "تعذر تحديث كلمة المرور.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md" dir="rtl">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-7 text-right shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-sky-100 p-3 text-sky-700"><KeyRound className="h-6 w-6" /></div>
          <div>
            <h2 className="font-black text-slate-900">إنشاء كلمة مرور جديدة</h2>
            <p className="text-xs text-slate-500">{email}</p>
          </div>
        </div>

        {error && <p className="flex gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700"><AlertCircle className="h-4 w-4" />{error}</p>}
        {message && <p className="flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" />{message}</p>}

        {!message && (
          <>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="كلمة المرور الجديدة" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
            <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="تأكيد كلمة المرور" className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-sky-600 p-3 text-sm font-bold text-white disabled:opacity-50">
              {loading ? "جاري التحديث..." : "تحديث كلمة المرور"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
