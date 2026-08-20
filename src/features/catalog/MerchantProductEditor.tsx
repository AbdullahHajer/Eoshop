import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Boxes,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Package,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import type { Product } from "../../types";

type ProductFilter = "all" | "draft" | "published";

interface MerchantProductEditorProps {
  products: Product[];
  currency: string;
  activeTenantId: string | null;
  mediaOwnerKey: string | null;
  canViewInventory: boolean;
  onProductChange: (productId: string, patch: Partial<Product>) => void;
  onProductMediaChange: (productId: string, urls: string[]) => void;
  uploadMedia: (tenantId: string, file: File, signal?: AbortSignal) => Promise<{ url: string }>;
  onAddProduct: () => void;
  onArchiveProduct: (productId: string) => void;
  onOpenInventory?: () => void;
}

const persistedProductId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function productMedia(product: Product): string[] {
  return [...new Set([product.imageUrl, ...(product.imageUrls ?? [])].filter((url): url is string => Boolean(url)))];
}

function inventoryLabel(product: Product): string {
  if (!product.inventoryRevision || typeof product.manageStock !== "boolean") return "بيانات المخزون غير متاحة";
  if (product.manageStock === false) return "مخزون مفتوح";
  if (typeof product.stockQuantity !== "number"
    || typeof product.availableQuantity !== "number"
    || typeof product.reservedQuantity !== "number") return "بيانات المخزون غير مكتملة";
  return `متاح ${product.availableQuantity} · محجوز ${product.reservedQuantity}`;
}

export default function MerchantProductEditor({
  products,
  currency,
  activeTenantId,
  mediaOwnerKey,
  canViewInventory,
  onProductChange,
  onProductMediaChange,
  uploadMedia: uploadCatalogMedia,
  onAddProduct,
  onArchiveProduct,
  onOpenInventory,
}: MerchantProductEditorProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [archiveCandidate, setArchiveCandidate] = useState<Product | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const previousCount = useRef(products.length);
  const productCollection = useRef(products);
  const tenant = useRef(activeTenantId);
  const mediaOwner = useRef(mediaOwnerKey);
  const mediaGeneration = useRef(0);
  const uploadController = useRef<AbortController | null>(null);

  productCollection.current = products;
  tenant.current = activeTenantId;
  mediaOwner.current = mediaOwnerKey;

  useEffect(() => {
    if (products.length > previousCount.current && products[0]) setExpandedId(products[0].id);
    previousCount.current = products.length;
    if (expandedId && !products.some((product) => product.id === expandedId)) setExpandedId(null);
  }, [expandedId, products]);

  useEffect(() => {
    mediaGeneration.current += 1;
    uploadController.current?.abort();
    uploadController.current = null;
    setUploadingProductId(null);
    setMediaError(null);
    return () => uploadController.current?.abort();
  }, [activeTenantId, mediaOwnerKey, products]);

  const visibleProducts = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("ar");
    return products.filter((product) => {
      if (filter !== "all" && (product.status ?? "draft") !== filter) return false;
      if (!normalized) return true;
      return [product.name, product.sku, product.category, product.description]
        .some((value) => (value ?? "").toLocaleLowerCase("ar").includes(normalized));
    });
  }, [filter, products, search]);

  const updateMoney = (product: Product, field: "basePrice" | "salePrice", raw: string) => {
    if (field === "salePrice" && raw === "") {
      onProductChange(product.id, { salePrice: null, price: product.basePrice ?? product.price });
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return;
    if (field === "basePrice") {
      onProductChange(product.id, {
        basePrice: value,
        price: product.salePrice ?? value,
      });
    } else {
      onProductChange(product.id, { salePrice: value, price: value });
    }
  };

  const addExternalMedia = (product: Product) => {
    const value = mediaUrl.trim();
    if (!value.startsWith("https://")) {
      setMediaError("يجب أن يبدأ رابط الصورة بـ https://");
      return;
    }
    const current = productMedia(product);
    if (current.includes(value)) {
      setMediaUrl("");
      return;
    }
    if (current.length >= 8) {
      setMediaError("يمكن إرفاق ثماني صور كحد أقصى.");
      return;
    }
    onProductMediaChange(product.id, [...current, value]);
    if (!product.imageUrl) onProductChange(product.id, { imageUrl: value });
    setMediaUrl("");
    setMediaError(null);
  };

  const uploadMedia = async (product: Product, files: File[], input: HTMLInputElement) => {
    if (!activeTenantId) {
      setMediaError("رفع الملفات متاح بعد تفعيل المتجر. يمكنك استخدام رابط HTTPS في المسودة.");
      input.value = "";
      return;
    }
    const remaining = Math.max(0, 8 - productMedia(product).length);
    const accepted = files.slice(0, remaining);
    if (accepted.length === 0) {
      setMediaError("وصل المنتج إلى الحد الأعلى للصور.");
      input.value = "";
      return;
    }
    if (accepted.some((file) => file.size > 5 * 1024 * 1024)) {
      setMediaError("الحد الأعلى للصورة الواحدة 5 ميجابايت.");
      input.value = "";
      return;
    }

    uploadController.current?.abort();
    const controller = new AbortController();
    uploadController.current = controller;
    const generation = ++mediaGeneration.current;
    const tenantAtStart = activeTenantId;
    const ownerAtStart = mediaOwnerKey;
    const productId = product.id;
    const productsAtStart = products;
    setUploadingProductId(productId);
    setMediaError(null);
    try {
      const uploads = [];
      for (const file of accepted) {
        uploads.push(await uploadCatalogMedia(tenantAtStart, file, controller.signal));
        if (controller.signal.aborted
          || generation !== mediaGeneration.current
          || tenant.current !== tenantAtStart
          || mediaOwner.current !== ownerAtStart
          || productCollection.current !== productsAtStart) return;
      }
      if (!productCollection.current.some((candidate) => candidate.id === productId)) return;
      onProductMediaChange(productId, [...productMedia(product), ...uploads.map((upload) => upload.url)]);
    } catch (error) {
      if (!controller.signal.aborted) setMediaError(error instanceof Error ? error.message : "تعذر رفع صورة المنتج.");
    } finally {
      if (generation === mediaGeneration.current) {
        uploadController.current = null;
        setUploadingProductId(null);
      }
      input.value = "";
    }
  };

  return (
    <section className="space-y-4 p-4" aria-labelledby="product-editor-heading">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 id="product-editor-heading" className="text-base font-black text-slate-950">محرر المنتجات</h2>
            <p className="mt-1 text-xs leading-6 text-slate-500">عدّل البيانات هنا، ثم استخدم «حفظ التعديلات» أعلى الصفحة لإرسالها إلى الخادم.</p>
          </div>
          <button type="button" onClick={onAddProduct} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white">
            <Plus className="h-4 w-4" /> إضافة منتج
          </button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث بالاسم أو SKU أو التصنيف" className="w-full rounded-xl border border-slate-200 py-2.5 pr-10 pl-3 text-xs outline-none focus:border-sky-400" />
          </label>
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(["all", "published", "draft"] as const).map((value) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-1.5 text-[11px] font-black ${filter === value ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>
                {value === "all" ? `الكل ${products.length}` : value === "published" ? "منشور" : "مسودة"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {canViewInventory && onOpenInventory && (
        <button type="button" onClick={onOpenInventory} className="flex w-full items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 p-3 text-right text-xs font-bold text-amber-950">
          <span><Boxes className="ml-2 inline h-4 w-4" />الكميات والحجوزات تُدار من وحدة المخزون المستقلة.</span>
          <span className="text-amber-700">فتح المخزون ←</span>
        </button>
      )}

      {visibleProducts.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          <Package className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          {products.length === 0 ? "لا توجد منتجات بعد. أضف أول منتج للبدء." : "لا توجد نتائج تطابق البحث والفلتر."}
        </div>
      )}

      <div className="space-y-3">
        {visibleProducts.map((product) => {
          const expanded = expandedId === product.id;
          const media = productMedia(product);
          const effectivePrice = product.salePrice ?? product.basePrice ?? product.price;
          return (
            <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button type="button" onClick={() => setExpandedId(expanded ? null : product.id)} className="flex w-full items-center gap-3 p-4 text-right">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-slate-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-black">{product.name || "منتج بلا اسم"}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${product.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{product.status === "published" ? "منشور" : "مسودة"}</span></div>
                  <p className="mt-1 text-[11px] text-slate-500">{effectivePrice.toFixed(2)} {currency}{canViewInventory && product.inventoryRevision ? ` · ${inventoryLabel(product)}` : ""}</p>
                </div>
                {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </button>

              {expanded && (
                <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-[11px] font-bold text-slate-600">اسم المنتج<input value={product.name} onChange={(event) => onProductChange(product.id, { name: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" /></label>
                    <label className="space-y-1 text-[11px] font-bold text-slate-600">الحالة<select value={product.status ?? "draft"} onChange={(event) => onProductChange(product.id, { status: event.target.value as Product["status"] })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="draft">مسودة — غير ظاهر للعملاء</option><option value="published">منشور داخل المتجر</option></select></label>
                    <label className="space-y-1 text-[11px] font-bold text-slate-600">السعر الأساسي<input data-testid={`product-base-price-${product.id}`} type="number" min="0" step="0.01" value={product.basePrice ?? product.price} onChange={(event) => updateMoney(product, "basePrice", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" /></label>
                    <label className="space-y-1 text-[11px] font-bold text-slate-600">سعر العرض (اختياري)<input data-testid={`product-sale-price-${product.id}`} type="number" min="0" step="0.01" value={product.salePrice ?? ""} onChange={(event) => updateMoney(product, "salePrice", event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" /></label>
                    <label className="space-y-1 text-[11px] font-bold text-slate-600">التصنيف<input value={product.category ?? ""} onChange={(event) => onProductChange(product.id, { category: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" /></label>
                    <label className="space-y-1 text-[11px] font-bold text-slate-600">SKU<input value={product.sku ?? ""} onChange={(event) => onProductChange(product.id, { sku: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs" /></label>
                  </div>
                  <label className="block space-y-1 text-[11px] font-bold text-slate-600">وصف المنتج<textarea rows={4} value={product.description ?? ""} onChange={(event) => onProductChange(product.id, { description: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-6" /></label>

                  {canViewInventory && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><strong>المخزون للعرض فقط:</strong> {inventoryLabel(product)}</div>
                  )}

                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between"><p className="text-xs font-black">صور المنتج ({media.length}/8)</p><ImagePlus className="h-4 w-4 text-slate-400" /></div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {media.map((url) => (
                        <div key={url} className={`group relative aspect-square overflow-hidden rounded-xl border-2 ${product.imageUrl === url ? "border-sky-500" : "border-slate-200"}`}>
                          <button type="button" onClick={() => onProductChange(product.id, { imageUrl: url })} className="h-full w-full"><img src={url} alt="" className="h-full w-full object-cover" /></button>
                          <button type="button" aria-label="إزالة الصورة" onClick={() => { const next = media.filter((candidate) => candidate !== url); onProductMediaChange(product.id, next); if (product.imageUrl === url) onProductChange(product.id, { imageUrl: next[0] ?? "" }); }} className="absolute left-1 top-1 rounded-full bg-rose-600 p-1 text-white"><X className="h-3 w-3" /></button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2"><input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://example.com/product.jpg" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs" /><button type="button" onClick={() => addExternalMedia(product)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black">إضافة رابط</button></div>
                    <label className="relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sky-200 bg-sky-50 text-xs font-black text-sky-800">
                      <Upload className="h-4 w-4" />{uploadingProductId === product.id ? "جارٍ رفع الصور..." : "رفع صور من الجهاز"}
                      <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={uploadingProductId === product.id} className="absolute inset-0 opacity-0" onChange={(event) => void uploadMedia(product, Array.from(event.target.files ?? []), event.currentTarget)} />
                    </label>
                    {mediaError && <p role="alert" className="text-xs font-bold text-rose-700">{mediaError}</p>}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
                    <button type="button" onClick={() => setArchiveCandidate(product)} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700"><Archive className="h-4 w-4" />{persistedProductId.test(product.id) ? "أرشفة المنتج عند الحفظ" : "إزالة مسودة المنتج"}</button>
                    <button type="button" onClick={() => setExpandedId(null)} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white">إغلاق التفاصيل — التعديلات غير محفوظة</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {archiveCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="archive-product-heading" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 id="archive-product-heading" className="text-base font-black">{persistedProductId.test(archiveCandidate.id) ? "أرشفة المنتج" : "إزالة مسودة المنتج"}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">{persistedProductId.test(archiveCandidate.id) ? "سيختفي المنتج من المتجر بعد نجاح حفظ مساحة العمل. لن يحدث أي تغيير في الخادم قبل الحفظ." : "سيُزال هذا المنتج غير المحفوظ من المسودة الحالية."}</p>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setArchiveCandidate(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black">إلغاء</button><button type="button" onClick={() => { onArchiveProduct(archiveCandidate.id); setArchiveCandidate(null); setExpandedId(null); }} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white">تأكيد</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
