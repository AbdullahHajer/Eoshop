import { useEffect, useRef } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import StorePreview from "../../components/StorePreview";
import type { CreateOrderInput, OrderReceipt, StorefrontBootstrap } from "../../adapters/uiAdapters";
import type { Product } from "../../types";

interface PublicStorefrontScreenProps {
  storefront: StorefrontBootstrap | null;
  error: string | null;
  loading: boolean;
  cart: Array<{ product: Product; quantity: number }>;
  addToCart: (product: Product) => void;
  updateQuantity: (productId: string, amount: number) => void;
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (isOpen: boolean) => void;
  hasOrdered: boolean;
  handleCheckout: () => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  submitOrder: (input: Omit<CreateOrderInput, "workspaceRevision" | "catalogRevision">) => Promise<OrderReceipt>;
  retry?: () => void;
}

export default function PublicStorefrontScreen({
  storefront,
  error,
  loading,
  cart,
  addToCart,
  updateQuantity,
  isCartDrawerOpen,
  setIsCartDrawerOpen,
  hasOrdered,
  handleCheckout,
  selectedCategory,
  setSelectedCategory,
  submitOrder,
  retry = () => window.location.reload(),
}: PublicStorefrontScreenProps) {
  const contentRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const previousStateRef = useRef<"loading" | "error" | "ready" | "empty">("loading");
  const viewState = storefront ? "ready" : loading ? "loading" : error ? "error" : "empty";

  useEffect(() => {
    if (previousStateRef.current === viewState) return;
    previousStateRef.current = viewState;
    if (viewState === "ready") contentRef.current?.focus();
    if (viewState === "error" || viewState === "empty") errorRef.current?.focus();
  }, [viewState]);

  if (storefront) {
    return (
      <>
        <a href="#public-storefront-content" className="fixed right-4 top-4 z-[70] -translate-y-24 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition-transform focus:translate-y-0">
          تخطي إلى محتوى المتجر
        </a>
        <main ref={contentRef} id="public-storefront-content" tabIndex={-1} className="min-h-screen bg-white outline-none">
          <StorePreview
            config={storefront.config}
            cart={cart}
            addToCart={addToCart}
            updateQuantity={updateQuantity}
            calculateTotal={() => {}}
            isCartDrawerOpen={isCartDrawerOpen}
            setIsCartDrawerOpen={setIsCartDrawerOpen}
            hasOrdered={hasOrdered}
            handleCheckout={handleCheckout}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            mode="live"
            submitOrder={submitOrder}
          />
        </main>
      </>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6" dir="rtl" aria-busy="true">
        <div role="status" aria-live="polite" className="rounded-3xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
          <RefreshCw aria-hidden="true" className="mx-auto h-8 w-8 animate-spin motion-reduce:animate-none text-sky-600" />
          <p className="mt-4 text-sm font-black text-slate-700">جارٍ تحميل المتجر…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
      <div ref={errorRef} role="alert" tabIndex={-1} className="max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl outline-none">
        <AlertTriangle aria-hidden="true" className="mx-auto h-10 w-10 text-rose-600" />
        <h1 className="mt-4 text-xl font-black text-slate-900">تعذر تحميل المتجر</h1>
        <p className="mt-2 text-sm text-slate-600">{error || "لم تكتمل استجابة المتجر. أعد المحاولة للحصول على أحدث نسخة منشورة."}</p>
        <button type="button" onClick={retry} className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">
          إعادة المحاولة
        </button>
      </div>
    </main>
  );
}
