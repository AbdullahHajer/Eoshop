import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, Check, Globe2, LayoutTemplate, Loader2, ShieldCheck } from "lucide-react";
import { useUiAdapters } from "../../adapters/UiAdaptersContext";
import { isUiError, uiErrorMessage, type StoreDraft, type StorePlan, type UserProfile } from "../../adapters/uiAdapters";
import { ELEGANT_PRESET, TECH_PRESET, type StoreConfig } from "../../types";

type Step = "business" | "design" | "review";

interface MerchantOnboardingPageProps {
  user: UserProfile;
  requestedStep: Step;
  onSessionExpired: (returnTo: string) => void;
}

const stepPath: Record<Step, string> = { business: "/app/new", design: "/app/new/design", review: "/app/new/review" };

export default function MerchantOnboardingPage({ user, requestedStep, onSessionExpired }: MerchantOnboardingPageProps) {
  const { provisioning, plans: planActions } = useUiAdapters();
  const [step, setStep] = useState<Step>(requestedStep);
  const [draft, setDraft] = useState<StoreDraft | null>(null);
  const [storeName, setStoreName] = useState("");
  const [businessType, setBusinessType] = useState("تجزئة");
  const [theme, setTheme] = useState<"elegant" | "tech">("elegant");
  const [config, setConfig] = useState<StoreConfig>(ELEGANT_PRESET);
  const [plans, setPlans] = useState<StorePlan[]>([]);
  const [planKey, setPlanKey] = useState("starter");
  const [handle, setHandle] = useState("");
  const [availability, setAvailability] = useState<{ available: boolean; domain: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [pendingSubmission, setPendingSubmission] = useState(false);
  const loadSequence = useRef(0);
  const operationSequence = useRef(0);
  const operationController = useRef<AbortController | null>(null);

  const applyDraft = (value: StoreDraft) => {
    setDraft(value);
    setStoreName(value.storeName);
    setBusinessType(value.businessType);
    setTheme(value.themeStyle);
    setConfig(value.config);
    setHandle(value.handle ?? "");
    setPlanKey(value.planKey ?? "starter");
  };

  const dirty = useMemo(() => {
    if (!draft) return storeName.trim() !== "";
    if (step === "business") return storeName.trim() !== draft.storeName || businessType !== draft.businessType;
    if (step === "design") return theme !== draft.themeStyle || JSON.stringify(config) !== JSON.stringify(draft.config);
    return handle.trim().toLowerCase() !== (draft.handle ?? "") || planKey !== (draft.planKey ?? "starter");
  }, [businessType, config, draft, handle, planKey, step, storeName, theme]);

  const navigate = (target: Step, persisted = false) => {
    if (!persisted && dirty && !window.confirm("توجد تعديلات غير محفوظة في هذه الخطوة. هل تريد تجاهلها؟")) return;
    setStep(target);
    window.history.pushState({}, "", stepPath[target]);
  };

  const beginOperation = () => {
    operationController.current?.abort();
    const controller = new AbortController();
    operationController.current = controller;
    return { sequence: ++operationSequence.current, controller };
  };

  const handleFailure = (caught: unknown, fallback: string, sequence: number) => {
    if (sequence !== operationSequence.current || isUiError(caught, "aborted")) return;
    if (isUiError(caught, "unauthenticated")) {
      onSessionExpired(stepPath[step]);
      return;
    }
    setError(uiErrorMessage(caught, fallback));
  };

  useEffect(() => {
    const sequence = ++loadSequence.current;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    provisioning.recoverCommittedSubmission(user.id, controller.signal)
      .then(async (recovered) => {
        if (sequence !== loadSequence.current) return;
        if (recovered) {
          window.location.assign(`/app/stores/${encodeURIComponent(recovered.id)}/overview`);
          return;
        }
        const [current, availablePlans] = await Promise.all([
          provisioning.currentDraft(controller.signal),
          planActions.list(controller.signal),
        ]);
        if (sequence !== loadSequence.current) return;
        setPlans(availablePlans);
        if (!current) {
          setStep("business");
          window.history.replaceState({}, "", stepPath.business);
          return;
        }
        applyDraft(current);
        const required = current.nextRequiredStep === "business" || current.nextRequiredStep === "design" || current.nextRequiredStep === "review"
          ? current.nextRequiredStep
          : requestedStep;
        const rank: Record<Step, number> = { business: 1, design: 2, review: 3 };
        if (rank[requestedStep] > rank[required]) {
          setStep(required);
          window.history.replaceState({}, "", stepPath[required]);
        }
      })
      .catch((caught) => {
        if (sequence !== loadSequence.current || isUiError(caught, "aborted")) return;
        if (isUiError(caught, "unauthenticated")) onSessionExpired(stepPath[requestedStep]);
        else setError(uiErrorMessage(caught, "تعذر تحميل مسودة التهيئة من الخادم."));
      })
      .finally(() => {
        if (sequence === loadSequence.current) setLoading(false);
      });
    return () => {
      controller.abort();
      operationController.current?.abort();
      loadSequence.current += 1;
      operationSequence.current += 1;
    };
  }, [user.id]);

  useEffect(() => {
    if (step !== "review" || handle.trim().length < 3 || pendingSubmission) {
      setAvailability(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setChecking(true);
      planActions.domainAvailability(handle.trim().toLowerCase(), controller.signal)
        .then((result) => setAvailability(result))
        .catch((caught) => {
          if (isUiError(caught, "unauthenticated")) onSessionExpired(stepPath.review);
          else if (!isUiError(caught, "aborted")) setAvailability(null);
        })
        .finally(() => setChecking(false));
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [handle, pendingSubmission, planActions, step]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (!saving && !dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, saving]);

  const selectTheme = (value: "elegant" | "tech") => {
    if (saving) return;
    const preset = value === "elegant" ? ELEGANT_PRESET : TECH_PRESET;
    setTheme(value);
    setConfig({ ...preset, storeName: draft?.storeName || storeName, themeStyle: value });
  };

  const saveBusiness = async (event: React.FormEvent) => {
    event.preventDefault();
    const { sequence, controller } = beginOperation();
    setSaving(true);
    setError("");
    try {
      const saved = await provisioning.saveBusiness({ expectedRevision: draft?.revision ?? 0, storeName, businessType }, controller.signal);
      if (sequence !== operationSequence.current) return;
      applyDraft(saved);
      navigate("design", true);
    } catch (caught) {
      handleFailure(caught, "تعذر حفظ بيانات النشاط.", sequence);
    } finally {
      if (sequence === operationSequence.current) setSaving(false);
    }
  };

  const saveDesign = async () => {
    if (!draft) return;
    const { sequence, controller } = beginOperation();
    setSaving(true);
    setError("");
    try {
      const saved = await provisioning.saveDesign({ expectedRevision: draft.revision, themeStyle: theme, config }, controller.signal);
      if (sequence !== operationSequence.current) return;
      applyDraft(saved);
      navigate("review", true);
    } catch (caught) {
      handleFailure(caught, "تعذر حفظ تصميم المتجر.", sequence);
    } finally {
      if (sequence === operationSequence.current) setSaving(false);
    }
  };

  const submit = async () => {
    if (!draft || (!pendingSubmission && (!availability?.available || !planKey))) {
      setError("اختر باقة وعنوانًا متاحًا قبل الإرسال.");
      return;
    }
    const { sequence, controller } = beginOperation();
    setSaving(true);
    setError("");
    try {
      const ready = pendingSubmission ? draft : await provisioning.saveReview({
        expectedRevision: draft.revision,
        handle: handle.trim().toLowerCase(),
        planKey,
      }, controller.signal);
      if (sequence !== operationSequence.current) return;
      applyDraft(ready);
      setPendingSubmission(true);
      await provisioning.submit({
        storeName: ready.storeName,
        businessType: ready.businessType,
        themeStyle: ready.themeStyle,
        handle: ready.handle!,
        planKey: ready.planKey!,
        config: ready.config,
        draftId: ready.id,
        expectedDraftRevision: ready.revision,
      }, user.id, controller.signal);
      if (sequence !== operationSequence.current) return;
      setPendingSubmission(false);
      window.location.assign("/app");
    } catch (caught) {
      handleFailure(caught, pendingSubmission
        ? "تعذر تأكيد نتيجة الإرسال. أعد المحاولة لاستعادة العملية نفسها دون تكرار المتجر."
        : "تعذر حفظ المراجعة أو إرسال المتجر.", sequence);
      if (!isUiError(caught, "network") && !isUiError(caught, "server")) setPendingSubmission(false);
    } finally {
      if (sequence === operationSequence.current) setSaving(false);
    }
  };

  const selectedPlan = useMemo(() => plans.find((plan) => plan.key === planKey) ?? null, [plans, planKey]);
  const inputClass = "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100";

  if (loading) return <LoadingScreen />;

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-3xl bg-slate-950 p-6 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold text-sky-300">تهيئة متجر جديد</p><h1 className="mt-1 text-2xl font-black">من بيانات النشاط إلى طلب جاهز للمراجعة</h1></div><a href="/app" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold"><ArrowRight className="h-4 w-4" />بوابة التاجر</a></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">{(["business", "design", "review"] as Step[]).map((item, index) => <div key={item} className={`rounded-2xl border p-3 ${item === step ? "border-sky-400 bg-sky-500/20" : "border-white/10 bg-white/5"}`}><span className="text-xs text-slate-300">الخطوة {index + 1}</span><p className="mt-1 font-black">{item === "business" ? "بيانات النشاط" : item === "design" ? "اختيار التصميم" : "العنوان والباقة"}</p></div>)}</div>
        </header>

        {error && <div role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}

        {step === "business" && <form onSubmit={saveBusiness} className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><SectionTitle icon={Building2} title="عرّفنا بالنشاط" text="هذه البيانات تُحفظ الآن في مسودة الخادم، ويمكنك استكمالها لاحقًا من أي جهاز." /><label className="mt-7 block text-sm font-bold">اسم المتجر أو النشاط<input value={storeName} onChange={(event) => setStoreName(event.target.value)} required minLength={2} maxLength={255} className={inputClass} /></label><label className="mt-5 block text-sm font-bold">نوع النشاط<select value={businessType} onChange={(event) => setBusinessType(event.target.value)} className={inputClass}>{["تجزئة", "أغذية ومشروبات", "أزياء", "عطور وبخور", "إلكترونيات", "خدمات", "أخرى"].map((item) => <option key={item}>{item}</option>)}</select></label><button disabled={saving} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3.5 text-sm font-black text-white disabled:opacity-50">حفظ ومتابعة التصميم<ArrowLeft className="h-4 w-4" /></button></form>}

        {step === "design" && <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><SectionTitle icon={LayoutTemplate} title="اختر نقطة بداية مناسبة" text="سنحفظ نسخة التصميم على الخادم. بعد تجهيز المتجر تستطيع تخصيص الهوية والمنتجات بالتفصيل." /><div className="mt-7 grid gap-5 md:grid-cols-2">{(["elegant", "tech"] as const).map((item) => { const preset = item === "elegant" ? ELEGANT_PRESET : TECH_PRESET; return <button type="button" key={item} onClick={() => selectTheme(item)} className={`relative overflow-hidden rounded-3xl border-2 p-5 text-right transition ${theme === item ? "border-sky-500 ring-4 ring-sky-100" : "border-slate-200 hover:border-slate-300"}`}><div className="h-32 rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${preset.primaryColor}, ${preset.secondaryColor})` }}><p className="text-3xl">{preset.logoIcon}</p><p className="mt-3 font-black">{item === "elegant" ? "الأناقة العصرية" : "التقنية والابتكار"}</p></div>{theme === item && <span className="absolute left-8 top-8 rounded-full bg-white p-1 text-sky-600"><Check className="h-4 w-4" /></span>}<p className="mt-4 text-xs leading-6 text-slate-500">ألوان وخطوط أساسية قابلة للتعديل لاحقًا من لوحة المتجر.</p></button>; })}</div><div className="mt-7 flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={() => navigate("business")} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold">السابق</button><button type="button" disabled={saving} onClick={() => void saveDesign()} className="flex-1 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">حفظ التصميم والمتابعة</button></div></section>}

        {step === "review" && <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><SectionTitle icon={Globe2} title="العنوان والباقة ثم الإرسال" text="العنوان لا يُحجز في هذه الشاشة؛ الحجز الذري يحدث عند إرسال الطلب النهائي فقط." /><div className="mt-7 grid gap-6 lg:grid-cols-2"><div><label className="block text-sm font-bold">معرّف عنوان المتجر<input disabled={pendingSubmission} value={handle} onChange={(event) => setHandle(event.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())} minLength={3} maxLength={50} dir="ltr" className={`${inputClass} text-left`} /></label><p className={`mt-2 text-xs font-bold ${availability?.available ? "text-emerald-700" : "text-slate-500"}`}>{checking ? "جاري التحقق..." : availability ? availability.available ? `متاح الآن: ${availability.domain}` : "العنوان غير متاح حاليًا." : "3–50 حرفًا إنجليزيًا صغيرًا أو رقمًا أو شرطة داخلية."}</p></div><div><label className="block text-sm font-bold">الباقة<select disabled={pendingSubmission} value={planKey} onChange={(event) => setPlanKey(event.target.value)} className={inputClass}>{plans.map((plan) => <option key={plan.key} value={plan.key}>{plan.name}</option>)}</select></label>{selectedPlan && <p className="mt-2 text-xs leading-6 text-slate-500">{selectedPlan.maxProducts === null ? "منتجات غير محدودة" : `حتى ${selectedPlan.maxProducts} منتجات`} — {selectedPlan.activationMode === "automatic" ? "تفعيل تلقائي بعد الموافقة" : "يتطلب تفعيل الإدارة"}</p>}</div></div><div className="mt-7 flex gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-xs leading-6 text-indigo-900"><ShieldCheck className="h-5 w-5 shrink-0" /><p>الإرسال ينشئ طلب مراجعة فقط. لا يصبح المتجر عامًا إلا بعد الموافقة والتجهيز وتفعيل الاشتراك والنشر.</p></div>{pendingSubmission && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900">نتيجة المحاولة السابقة غير مؤكدة. الضغط مرة أخرى يستعيد العملية نفسها بمفتاح idempotency، دون حفظ المسودة مرة أخرى.</p>}<div className="mt-7 flex flex-wrap gap-3"><button type="button" disabled={saving || pendingSubmission} onClick={() => navigate("design")} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold">السابق</button><button type="button" disabled={saving || (!pendingSubmission && !availability?.available)} onClick={() => void submit()} className="flex-1 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{saving ? "جاري الحفظ والإرسال..." : pendingSubmission ? "استعادة نتيجة الإرسال" : "حفظ المراجعة وإرسال الطلب"}</button></div></section>}
      </div>
    </main>
  );
}

function SectionTitle({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return <div className="flex items-start gap-4"><span className="rounded-2xl bg-sky-100 p-3 text-sky-700"><Icon className="h-6 w-6" /></span><div><h2 className="text-xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm leading-7 text-slate-500">{text}</p></div></div>;
}

function LoadingScreen() {
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-100"><div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 font-bold text-slate-700 shadow"><Loader2 className="h-5 w-5 animate-spin text-sky-600" />جاري استعادة مسودة المتجر من الخادم...</div></main>;
}
