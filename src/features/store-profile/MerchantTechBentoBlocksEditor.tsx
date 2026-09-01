import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Copy, Image, Loader2, Palette, Plus, Trash2, Upload } from "lucide-react";
import type { StoreAssetUpload } from "../../adapters/uiAdapters";
import type { StorefrontMarketingBlock, StorefrontMarketingPlacement } from "../../contracts/storefrontMarketingBlocks";
import { uiErrorMessage } from "../../contracts/uiError";
import type { StoreConfig } from "../../types";
import { randomUuid } from "../../utils/randomUuid";
import { contrastRatio, readableForeground } from "../../utils/readableForeground";

interface Props {
  config: StoreConfig;
  activeTenantId: string | null;
  mediaOwnerKey: string | null;
  onChange: (key: keyof StoreConfig, value: unknown) => void;
  uploadAsset: (tenantId: string, file: File, signal?: AbortSignal) => Promise<StoreAssetUpload>;
}

type TechPlacement = Extract<StorefrontMarketingPlacement, "hero_bento" | "side_ad" | "discovery">;
type ImageField = "imageUrl" | "mobileImageUrl";

interface TechGroup {
  placement: TechPlacement;
  title: string;
  help: string;
  empty: string;
  limit: number;
  fallbackSurfaces: string[];
}

const GROUPS: TechGroup[] = [
  {
    placement: "hero_bento",
    title: "مربعات Bento الرئيسية",
    help: "حتى خمس مساحات داخل واجهة Tech؛ كل مربع صورة وهدف مستقلان.",
    empty: "لا توجد مربعات مخصصة؛ سيشتق القالب بدائل صادقة من التصنيفات المنشورة.",
    limit: 5,
    fallbackSurfaces: ["#1473E6", "#16856B", "#EC665E", "#6575DD", "#92B526"],
  },
  {
    placement: "side_ad",
    title: "الإعلانات الجانبية",
    help: "إعلانان كحد أقصى. إذا لم يوجد إعلان منشور يعيد القالب توزيع المساحة تلقائيًا.",
    empty: "لا توجد إعلانات جانبية؛ لن يحجز القالب عمودًا فارغًا.",
    limit: 2,
    fallbackSurfaces: ["#071B35", "#80654F"],
  },
  {
    placement: "discovery",
    title: "دوائر الاكتشاف",
    help: "صور دائرية سريعة بلا سعر أو زر سلة، وتفتح هدفًا حقيقيًا.",
    empty: "لا توجد عناصر اكتشاف منشورة بعد.",
    limit: 10,
    fallbackSurfaces: ["#E2E8F0"],
  },
];

const FILE_LIMITS: Record<TechPlacement, Record<ImageField, number>> = {
  hero_bento: { imageUrl: 750 * 1024, mobileImageUrl: 500 * 1024 },
  side_ad: { imageUrl: 1024 * 1024, mobileImageUrl: 600 * 1024 },
  discovery: { imageUrl: 350 * 1024, mobileImageUrl: 350 * 1024 },
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function placementBlocks(config: StoreConfig, placement: TechPlacement): StorefrontMarketingBlock[] {
  return (config.marketingBlocks ?? [])
    .filter((block) => block.placement === placement)
    .sort((left, right) => left.position - right.position);
}

function statusLabel(block: StorefrontMarketingBlock, now = Date.now()): string {
  if (!block.enabled) return "معطلة";
  if (block.startsAt && Date.parse(block.startsAt) > now) return "مجدولة";
  if (block.endsAt && Date.parse(block.endsAt) <= now) return "منتهية";
  return "نشطة";
}

function validColor(value: string | undefined, fallback: string): string {
  return value && HEX_COLOR.test(value) ? value.toUpperCase() : fallback;
}

function defaultTitle(placement: TechPlacement): string {
  if (placement === "hero_bento") return "مربع جديد";
  if (placement === "side_ad") return "إعلان جديد";
  return "اكتشاف جديد";
}

function contentTypeForTarget(targetType: StorefrontMarketingBlock["targetType"]): StorefrontMarketingBlock["contentType"] {
  if (targetType === "category") return "category";
  if (targetType === "product") return "product";
  return "campaign";
}

function BlockAppearanceEditor({ block, fallbackSurface, onPatch }: {
  block: StorefrontMarketingBlock;
  fallbackSurface: string;
  onPatch: (patch: Partial<StorefrontMarketingBlock>) => void;
}) {
  const backgroundColor = validColor(block.backgroundColor, fallbackSurface);
  const textColor = validColor(block.textColor, "#FFFFFF");
  const ratio = contrastRatio(textColor, backgroundColor);
  const passes = ratio >= 4.5;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3" aria-label={`ألوان ومعاينة ${block.title}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1 text-[11px] font-black text-slate-700"><Palette className="h-4 w-4" /> ألوان ومعاينة المساحة</p>
          <p className="mt-1 text-[10px] leading-5 text-slate-500">تظهر النتيجة فورًا قبل الحفظ، مع قياس تباين اللون الاحتياطي.</p>
        </div>
        <button type="button" onClick={() => onPatch({ textColor: readableForeground(backgroundColor) })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-700">لون نص تلقائي</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          { key: "backgroundColor", label: "لون الخلفية", value: backgroundColor },
          { key: "textColor", label: "لون النص", value: textColor },
        ] as const).map(({ key, label, value }) => {
          const rawValue = block[key] ?? value;
          const invalid = !HEX_COLOR.test(rawValue);
          return (
            <label key={key} className="space-y-1 rounded-xl border border-slate-200 bg-white p-2.5">
              <span className="block text-[10px] font-bold text-slate-600">{label}</span>
              <span className="flex items-center gap-2">
                <input type="color" aria-label={`${label} ${block.title}`} value={value} onChange={(event) => onPatch({ [key]: event.target.value.toUpperCase() })} className="h-9 w-10 cursor-pointer rounded border-0 bg-transparent" />
                <input dir="ltr" aria-label={`رمز ${label} ${block.title}`} aria-invalid={invalid} value={rawValue} maxLength={7} onChange={(event) => onPatch({ [key]: event.target.value.toUpperCase() })} className={`min-w-0 flex-1 rounded-lg border px-2 py-2 text-[11px] ${invalid ? "border-rose-300 text-rose-700" : "border-slate-200"}`} />
              </span>
            </label>
          );
        })}
      </div>
      <div data-testid={`tech-marketing-preview-${block.id}`} className="relative min-h-36 overflow-hidden rounded-xl" style={{ backgroundColor, color: textColor }}>
        {block.imageUrl.trim() ? <img src={block.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${block.focalPointX ?? 50}% ${block.focalPointY ?? 50}%` }} /> : null}
        <span aria-hidden="true" className="absolute inset-0 bg-black" style={{ opacity: (block.overlayOpacity ?? 44) / 100 }} />
        <div className="relative z-10 flex min-h-36 flex-col justify-end gap-1 p-4">
          {block.badge?.trim() ? <span className="w-fit rounded-full border border-current/30 px-2 py-1 text-[9px] font-black">{block.badge}</span> : null}
          <strong className="text-base">{block.title}</strong>
          {block.subtitle?.trim() ? <span className="text-[10px] opacity-90">{block.subtitle}</span> : null}
          <span className="mt-1 w-fit rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-slate-950">{block.ctaLabel}</span>
        </div>
      </div>
      <p className={`text-[10px] font-black ${passes ? "text-emerald-700" : "text-amber-700"}`}>تباين اللون الاحتياطي: {ratio.toFixed(2)}:1 — {passes ? "مناسب للنص العادي" : "يحتاج لونًا أوضح"}</p>
    </section>
  );
}

export default function MerchantTechBentoBlocksEditor({ config, activeTenantId, mediaOwnerKey, onChange, uploadAsset }: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploadRef = useRef<AbortController | null>(null);

  useEffect(() => {
    uploadRef.current?.abort();
    uploadRef.current = null;
    setUploading(null);
    setError(null);
    return () => uploadRef.current?.abort();
  }, [activeTenantId, mediaOwnerKey]);

  const replacePlacement = (placement: TechPlacement, next: StorefrontMarketingBlock[]) => {
    const retained = (config.marketingBlocks ?? []).filter((block) => block.placement !== placement);
    onChange("marketingBlocks", [
      ...retained,
      ...next.map((block, index) => ({ ...block, placement, position: index + 1 })),
    ]);
  };

  const patchBlock = (placement: TechPlacement, id: string, patch: Partial<StorefrontMarketingBlock>) => {
    replacePlacement(placement, placementBlocks(config, placement).map((block) => block.id === id ? { ...block, ...patch } : block));
  };

  const addBlock = (group: TechGroup) => {
    const blocks = placementBlocks(config, group.placement);
    if (blocks.length >= group.limit) return;
    replacePlacement(group.placement, [...blocks, {
      id: randomUuid(),
      placement: group.placement,
      position: blocks.length + 1,
      enabled: false,
      contentType: "campaign",
      title: defaultTitle(group.placement),
      ctaLabel: "استكشف الآن",
      imageUrl: "",
      altText: "أضف وصفًا دقيقًا للصورة",
      backgroundColor: group.fallbackSurfaces[blocks.length % group.fallbackSurfaces.length],
      textColor: "#FFFFFF",
      overlayOpacity: 44,
      focalPointX: 50,
      focalPointY: 50,
      targetType: "products",
      disclosure: "none",
    }]);
  };

  const moveBlock = (placement: TechPlacement, index: number, direction: -1 | 1) => {
    const blocks = placementBlocks(config, placement);
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    replacePlacement(placement, blocks);
  };

  const duplicateBlock = (group: TechGroup, block: StorefrontMarketingBlock) => {
    const blocks = placementBlocks(config, group.placement);
    if (blocks.length >= group.limit) return;
    const index = blocks.findIndex((candidate) => candidate.id === block.id);
    blocks.splice(index + 1, 0, { ...block, id: randomUuid(), enabled: false, title: `${block.title} — نسخة` });
    replacePlacement(group.placement, blocks);
  };

  const handleUpload = async (placement: TechPlacement, block: StorefrontMarketingBlock, field: ImageField, file?: File) => {
    if (!file) return;
    if (!activeTenantId || !mediaOwnerKey) {
      setError("يصبح رفع صور Tech Bento متاحًا بعد إنشاء المتجر وحفظه على الخادم.");
      return;
    }
    const limit = FILE_LIMITS[placement][field];
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size <= 0 || file.size > limit) {
      setError(`استخدم JPEG أو PNG أو WebP بحجم لا يتجاوز ${Math.round(limit / 1024)} كيلوبايت لهذه الخانة.`);
      return;
    }
    uploadRef.current?.abort();
    const controller = new AbortController();
    uploadRef.current = controller;
    const key = `${block.id}:${field}`;
    setUploading(key);
    setError(null);
    try {
      const asset = await uploadAsset(activeTenantId, file, controller.signal);
      if (!controller.signal.aborted) patchBlock(placement, block.id, { [field]: asset.url });
    } catch (uploadError) {
      if (!controller.signal.aborted) setError(uiErrorMessage(uploadError, "تعذر رفع صورة مساحة Tech. حاول مرة أخرى."));
    } finally {
      if (uploadRef.current === controller) uploadRef.current = null;
      if (!controller.signal.aborted) setUploading(null);
    }
  };

  if (config.themeStyle !== "tech") {
    return <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs font-bold leading-6 text-indigo-900">محتوى Tech Bento محفوظ ولن يُحذف. اختر القالب الحديث والتقني لتعديل المربعات والإعلانات ودوائر الاكتشاف.</div>;
  }

  const categories = Array.from(new Set(config.products.filter((product) => product.status === "published").map((product) => product.category.trim()).filter(Boolean)));
  const products = config.products.filter((product) => product.status === "published");

  return (
    <div className="space-y-6">
      <header>
        <h3 className="text-base font-black text-slate-900">مساحات Tech Bento</h3>
        <p className="mt-1 text-xs leading-6 text-slate-500">خصص المربعات الخمسة والإعلانين ودوائر الاكتشاف. كل مساحة مستقلة، والخادم يحتفظ بالحدود والجدولة والأهداف.</p>
      </header>
      {error && <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {GROUPS.map((group) => {
        const blocks = placementBlocks(config, group.placement);
        return (
          <section key={group.placement} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-labelledby={`tech-marketing-${group.placement}`}>
            <div className="flex items-start justify-between gap-3">
              <div><h4 id={`tech-marketing-${group.placement}`} className="text-sm font-black text-slate-900">{group.title}</h4><p className="mt-1 text-[11px] leading-5 text-slate-500">{group.help} ({blocks.length}/{group.limit})</p></div>
              <button type="button" disabled={blocks.length >= group.limit} onClick={() => addBlock(group)} className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-slate-900 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /> إضافة</button>
            </div>
            {blocks.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-xs font-bold leading-6 text-slate-500">{group.empty}</div> : null}
            {blocks.map((block, index) => (
              <details key={block.id} className="rounded-2xl border border-slate-200 bg-white p-3" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">{block.imageUrl ? <img src={block.imageUrl} alt="" className="h-full w-full object-cover" /> : <Image className="h-4 w-4 text-slate-400" />}</span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-900">{index + 1}. {block.title}</strong><small className="text-[10px] font-bold text-slate-500">{statusLabel(block)}</small></span>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${block.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{block.enabled ? "ظاهرة" : "مخفية"}</span>
                </summary>
                <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" role="switch" aria-label={`${block.enabled ? "تعطيل" : "تفعيل"} ${block.title}`} aria-checked={block.enabled} onClick={() => patchBlock(group.placement, block.id, { enabled: !block.enabled })} className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-black">{block.enabled ? "تعطيل" : "تفعيل"}</button>
                    <button type="button" aria-label={`نقل ${block.title} للأعلى`} disabled={index === 0} onClick={() => moveBlock(group.placement, index, -1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label={`نقل ${block.title} للأسفل`} disabled={index === blocks.length - 1} onClick={() => moveBlock(group.placement, index, 1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" aria-label={`نسخ ${block.title}`} disabled={blocks.length >= group.limit} onClick={() => duplicateBlock(group, block)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><Copy className="h-4 w-4" /></button>
                    <button type="button" aria-label={`حذف ${block.title}`} onClick={() => replacePlacement(group.placement, blocks.filter((candidate) => candidate.id !== block.id))} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">العنوان</span><input value={block.title} maxLength={80} onChange={(event) => patchBlock(group.placement, block.id, { title: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">نص الزر</span><input value={block.ctaLabel} maxLength={40} onChange={(event) => patchBlock(group.placement, block.id, { ctaLabel: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
                  </div>
                  <label className="block space-y-1"><span className="text-[11px] font-bold text-slate-600">الوصف المساند</span><textarea value={block.subtitle ?? ""} maxLength={180} rows={2} onChange={(event) => patchBlock(group.placement, block.id, { subtitle: event.target.value || undefined })} className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
                  <label className="block space-y-1"><span className="text-[11px] font-bold text-slate-600">وصف الصورة لذوي الإعاقة</span><input value={block.altText} maxLength={160} onChange={(event) => patchBlock(group.placement, block.id, { altText: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(["imageUrl", "mobileImageUrl"] as const).map((field) => <label key={field} className={`relative flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-xs font-black ${activeTenantId && mediaOwnerKey ? "cursor-pointer bg-white" : "cursor-not-allowed bg-slate-100 text-slate-400"}`}>{uploading === `${block.id}:${field}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{field === "imageUrl" ? "رفع الصورة الأساسية" : "رفع صورة الجوال"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!activeTenantId || !mediaOwnerKey || Boolean(uploading)} className="absolute inset-0 opacity-0" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void handleUpload(group.placement, block, field, file); }} /></label>)}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">الهدف</span><select value={block.targetType} onChange={(event) => { const targetType = event.target.value as StorefrontMarketingBlock["targetType"]; patchBlock(group.placement, block.id, { targetType, targetValue: targetType === "products" ? undefined : "", contentType: contentTypeForTarget(targetType), disclosure: targetType === "external" && block.disclosure === "none" ? "sponsored" : block.disclosure }); }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="products">كل المنتجات</option><option value="category">تصنيف</option><option value="product">منتج</option><option value="external">رابط راعٍ خارجي</option></select></label>
                    {block.targetType === "category" ? <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">التصنيف</span><select value={block.targetValue ?? ""} onChange={(event) => patchBlock(group.placement, block.id, { targetValue: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="">اختر</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label> : null}
                    {block.targetType === "product" ? <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">المنتج</span><select value={block.targetValue ?? ""} onChange={(event) => patchBlock(group.placement, block.id, { targetValue: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="">اختر</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label> : null}
                    {block.targetType === "external" ? <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">رابط HTTPS</span><input dir="ltr" type="url" value={block.targetValue ?? ""} onChange={(event) => patchBlock(group.placement, block.id, { targetValue: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label> : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">الإفصاح</span><select value={block.disclosure} onChange={(event) => patchBlock(group.placement, block.id, { disclosure: event.target.value as StorefrontMarketingBlock["disclosure"] })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="none" disabled={block.targetType === "external"}>لا يوجد</option><option value="ad">إعلان</option><option value="sponsored">برعاية</option></select></label>
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">اسم الراعي</span><input value={block.sponsorName ?? ""} maxLength={80} onChange={(event) => patchBlock(group.placement, block.id, { sponsorName: event.target.value || undefined })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">الشارة</span><input value={block.badge ?? ""} maxLength={40} onChange={(event) => patchBlock(group.placement, block.id, { badge: event.target.value || undefined })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label>
                  </div>
                  <BlockAppearanceEditor block={block} fallbackSurface={group.fallbackSurfaces[index % group.fallbackSurfaces.length]} onPatch={(patch) => patchBlock(group.placement, block.id, patch)} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">التعتيم: {block.overlayOpacity ?? 44}%</span><input type="range" min="0" max="100" value={block.overlayOpacity ?? 44} onChange={(event) => patchBlock(group.placement, block.id, { overlayOpacity: Number(event.target.value) })} className="w-full" /></label>
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">موضع أفقي: {block.focalPointX ?? 50}%</span><input type="range" min="0" max="100" value={block.focalPointX ?? 50} onChange={(event) => patchBlock(group.placement, block.id, { focalPointX: Number(event.target.value) })} className="w-full" /></label>
                    <label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">موضع عمودي: {block.focalPointY ?? 50}%</span><input type="range" min="0" max="100" value={block.focalPointY ?? 50} onChange={(event) => patchBlock(group.placement, block.id, { focalPointY: Number(event.target.value) })} className="w-full" /></label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">يبدأ (UTC RFC3339)</span><input dir="ltr" value={block.startsAt ?? ""} placeholder="2026-09-01T00:00:00Z" onChange={(event) => patchBlock(group.placement, block.id, { startsAt: event.target.value || undefined })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label><label className="space-y-1"><span className="text-[11px] font-bold text-slate-600">ينتهي (UTC RFC3339)</span><input dir="ltr" value={block.endsAt ?? ""} placeholder="2026-10-01T00:00:00Z" onChange={(event) => patchBlock(group.placement, block.id, { endsAt: event.target.value || undefined })} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" /></label></div>
                </div>
              </details>
            ))}
          </section>
        );
      })}
    </div>
  );
}
