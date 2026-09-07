import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { CircleAlert, CloudCog, Loader2, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import type { PaymentConnection, PaymentConnectionActions, PaymentConnectionEnvironment } from "../../contracts/paymentConnection";
import { uiError } from "../../contracts/uiError";
import { randomUuid } from "../../utils/randomUuid";

interface Props {
  activeTenantId: string | null;
  paymentConnections: PaymentConnectionActions;
}

const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const opaqueSecretPattern = /^[^\p{C}\p{Z}]{8,512}$/u;
const credentialFieldNames = ["appId", "merchantKey", "clientId", "clientSecret"] as const;

function clearCredentialFields(form: HTMLFormElement | null): void {
  if (!form) return;
  form.reset();
  for (const name of credentialFieldNames) {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement) field.value = "";
  }
}

const stateCopy: Record<PaymentConnection["state"], { label: string; detail: string; className: string }> = {
  unconfigured: { label: "غير مهيأ", detail: "أدخل بيانات حساب المتجر لدى BasGate لحفظها بصورة مشفرة.", className: "bg-slate-100 text-slate-700" },
  draft: { label: "محفوظ دون تحقق", detail: "حُفظت بيانات الربط، لكن الحساب لم يُتحقق منه ولم يُفعّل للدفع.", className: "bg-amber-100 text-amber-800" },
  verification_pending: { label: "بانتظار التحقق", detail: "طلب التحقق مسجل. لا يعني ذلك أن الدفع الإلكتروني أصبح متاحًا.", className: "bg-sky-100 text-sky-800" },
  active: { label: "اتصال متحقق", detail: "تم التحقق من الاتصال. استقبال الدفع يبقى متوقفًا حتى اكتمال دورة الدفع الإلكتروني.", className: "bg-emerald-100 text-emerald-800" },
  verification_failed: { label: "تعذر التحقق", detail: "لم يقبل المزود بيانات الربط. راجع بيانات حساب المتجر ثم احفظها من جديد.", className: "bg-rose-100 text-rose-800" },
  disabled: { label: "موقوف", detail: "الاتصال موقوف ولا يمكنه بدء عمليات دفع جديدة.", className: "bg-slate-200 text-slate-700" },
};

function errorMessage(cause: unknown, operation: "load" | "save"): string {
  const error = uiError(cause);
  if (error?.category === "unauthenticated") return "انتهت جلسة الدخول. سجّل الدخول ثم أعد المحاولة.";
  if (error?.category === "forbidden") return "لا تملك صلاحية إدارة ربط الدفع لهذا المتجر.";
  if (error?.category === "conflict") return "تغيّرت حالة الربط في جلسة أخرى. حدّث الحالة قبل إعادة الحفظ.";
  if (error?.category === "validation") return "تحقق من بيانات BasGate المدخلة ثم أعد المحاولة.";
  if (error?.category === "throttled") return "تم إرسال محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.";
  if (error?.category === "network" || error?.category === "server" || error?.category === "csrf") {
    return operation === "load"
      ? "تعذر تحميل حالة ربط BasGate. يمكنك إعادة المحاولة."
      : "تعذر تأكيد حفظ بيانات الربط. حدّث الحالة قبل إدخالها وإرسالها مجددًا.";
  }
  return operation === "load" ? "تعذر تحميل حالة ربط BasGate." : "تعذر حفظ بيانات ربط BasGate.";
}

export default function BasGatePaymentConnectionCard({ activeTenantId, paymentConnections }: Props) {
  const formId = useId();
  const [connection, setConnection] = useState<PaymentConnection | null>(null);
  const [environment, setEnvironment] = useState<PaymentConnectionEnvironment>("sandbox");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const generationRef = useRef(0);
  const loadControllerRef = useRef<AbortController | null>(null);
  const mutationControllerRef = useRef<AbortController | null>(null);
  const retryIdempotencyKeyRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const bindForm = useCallback((element: HTMLFormElement | null) => {
    if (formRef.current && formRef.current !== element) clearCredentialFields(formRef.current);
    formRef.current = element;
  }, []);

  const load = async (tenantId: string, generation: number) => {
    loadControllerRef.current?.abort();
    const controller = new AbortController();
    loadControllerRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const next = await paymentConnections.load(tenantId, controller.signal);
      if (generation !== generationRef.current || controller.signal.aborted) return;
      retryIdempotencyKeyRef.current = null;
      setConnection(next);
      if (next.environment) setEnvironment(next.environment);
    } catch (cause) {
      if (generation !== generationRef.current || controller.signal.aborted) return;
      setError(errorMessage(cause, "load"));
    } finally {
      if (generation === generationRef.current && !controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const generation = ++generationRef.current;
    loadControllerRef.current?.abort();
    mutationControllerRef.current?.abort();
    retryIdempotencyKeyRef.current = null;
    clearCredentialFields(formRef.current);
    setConnection(null);
    setEnvironment("sandbox");
    setError(null);
    setNotice(null);
    setLoading(false);
    setSubmitting(false);
    if (activeTenantId) void load(activeTenantId, generation);

    return () => {
      loadControllerRef.current?.abort();
      mutationControllerRef.current?.abort();
      retryIdempotencyKeyRef.current = null;
      clearCredentialFields(formRef.current);
    };
  }, [activeTenantId]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTenantId || !connection || submitting) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const credentials = {
      appId: String(values.get("appId") ?? "").trim(),
      merchantKey: String(values.get("merchantKey") ?? ""),
      clientId: String(values.get("clientId") ?? "").trim(),
      clientSecret: String(values.get("clientSecret") ?? ""),
    };
    if (!uuidPattern.test(credentials.appId) || !uuidPattern.test(credentials.clientId)) {
      clearCredentialFields(form);
      setError("يجب أن يكون App ID وClient ID بصيغة UUID صحيحة.");
      return;
    }
    if (!opaqueSecretPattern.test(credentials.merchantKey) || !opaqueSecretPattern.test(credentials.clientSecret)) {
      clearCredentialFields(form);
      setError("يجب أن يحتوي Merchant Key وClient Secret على 8 إلى 512 محرفًا دون مسافات أو محارف غير مرئية.");
      return;
    }

    const tenantAtStart = activeTenantId;
    const generation = generationRef.current;
    const controller = new AbortController();
    mutationControllerRef.current?.abort();
    mutationControllerRef.current = controller;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    clearCredentialFields(form);
    const idempotencyKey = retryIdempotencyKeyRef.current ?? randomUuid();

    try {
      const next = await paymentConnections.configure(tenantAtStart, {
        environment,
        expectedRevision: connection.revision,
        credentials,
      }, idempotencyKey, controller.signal);
      if (generation !== generationRef.current || controller.signal.aborted || activeTenantId !== tenantAtStart) return;
      retryIdempotencyKeyRef.current = null;
      setConnection(next);
      setNotice("تم حفظ بيانات الربط بصورة آمنة. لم يتم التحقق من الحساب أو تفعيل الدفع بعد.");
    } catch (cause) {
      if (generation !== generationRef.current || controller.signal.aborted || activeTenantId !== tenantAtStart) return;
      const category = uiError(cause)?.category;
      retryIdempotencyKeyRef.current = category && ["network", "server", "csrf", "throttled"].includes(category)
        ? idempotencyKey
        : null;
      setError(errorMessage(cause, "save"));
    } finally {
      clearCredentialFields(form);
      if (generation === generationRef.current && activeTenantId === tenantAtStart) {
        mutationControllerRef.current = null;
        setSubmitting(false);
      }
    }
  };

  if (!activeTenantId) {
    return <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="flex items-center gap-2 text-sm font-black"><CloudCog className="h-4 w-4 text-indigo-600" /> بوابة BasGate</h4>
      <p className="text-xs leading-6 text-slate-600">يتاح ربط حساب الدفع بعد إنشاء المتجر واعتماده.</p>
    </section>;
  }

  const copy = connection ? stateCopy[connection.state] : null;
  const mayConfigure = connection !== null && connection.state !== "active" && connection.state !== "verification_pending";

  return <section className="space-y-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4" aria-labelledby={`${formId}-title`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h4 id={`${formId}-title`} className="flex items-center gap-2 text-sm font-black text-slate-950"><ShieldCheck className="h-4 w-4 text-indigo-700" /> ربط بوابة BasGate</h4>
        <p className="mt-1 text-[11px] leading-5 text-slate-600">بيانات هذا الربط مستقلة عن إعدادات واجهة المتجر ولا تُعاد إلى المتصفح بعد حفظها.</p>
      </div>
      {copy && <span className={`rounded-full px-3 py-1 text-[11px] font-black ${copy.className}`}>{copy.label}</span>}
    </div>

    {loading && <div role="status" className="flex items-center gap-2 rounded-xl bg-white p-3 text-xs font-bold text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ تحميل حالة الربط…</div>}

    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold leading-5 text-rose-800"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1">{error}</span>{!submitting && <button type="button" onClick={() => void load(activeTenantId, generationRef.current)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1 outline-none focus:ring-2 focus:ring-rose-400"><RefreshCw className="h-3.5 w-3.5" /> تحديث الحالة</button>}</div>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-5 text-emerald-800">{notice}</p>}

    {connection && <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-black text-slate-900">{copy?.detail}</p>
      <dl className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
        <div><dt className="text-slate-500">البيئة</dt><dd className="mt-0.5 font-black text-slate-800">{connection.environment === "production" ? "الإنتاج" : connection.environment === "sandbox" ? "التجربة" : "لم تحدد"}</dd></div>
        <div><dt className="text-slate-500">آخر تحقق ناجح</dt><dd className="mt-0.5 font-black text-slate-800">{connection.lastVerifiedAt ? new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(new Date(connection.lastVerifiedAt)) : "لا يوجد"}</dd></div>
      </dl>
      {connection.canAcceptOnlinePayments && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-[11px] font-bold text-amber-800">جاهزية المزود وحدها لا تُظهر وسيلة الدفع للعميل قبل اكتمال دورة الدفع الإلكتروني في المنصة.</p>}
    </div>}

    {mayConfigure && <form ref={bindForm} onSubmit={submit} noValidate autoComplete="off" className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-slate-600" /><p className="text-xs font-black">بيانات الربط — إدخال مرة واحدة</p></div>
      <label className="block space-y-1"><span className="text-xs font-bold">البيئة</span><select className={input} value={environment} onChange={(event) => setEnvironment(event.target.value as PaymentConnectionEnvironment)} disabled={submitting}><option value="sandbox">التجربة (Sandbox)</option><option value="production">الإنتاج (Production)</option></select></label>
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { name: "appId", label: "App ID", maxLength: 36 },
          { name: "merchantKey", label: "Merchant Key", minLength: 8, maxLength: 512 },
          { name: "clientId", label: "Client ID", maxLength: 36 },
          { name: "clientSecret", label: "Client Secret", minLength: 8, maxLength: 512 },
        ] as const).map(({ name, label, ...limits }) => <label key={name} className="space-y-1"><span className="text-xs font-bold">{label}</span><input name={name} aria-label={label} type="password" required {...limits} autoComplete="new-password" spellCheck={false} dir="ltr" className={input} disabled={submitting} /></label>)}
      </div>
      <p className="text-[11px] leading-5 text-slate-500">لن تظهر القيم مجددًا بعد الإرسال. الحفظ لا يعني نجاح التحقق أو تفعيل الدفع.</p>
      <button type="submit" disabled={submitting} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-black text-white outline-none transition hover:bg-indigo-800 focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}{submitting ? "جارٍ الحفظ الآمن…" : "حفظ بيانات الربط"}</button>
    </form>}
  </section>;
}
