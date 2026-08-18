import { AlertTriangle } from "lucide-react";
import StorePreview from "../../components/StorePreview";
import type { CreateOrderInput, OrderReceipt, StorefrontBootstrap } from "../../adapters/uiAdapters";
import type { Product } from "../../types";

interface PublicStorefrontScreenProps {
  storefront: StorefrontBootstrap | null;
  error: string | null;
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
  if (storefront) {
    return (
      <main className="min-h-screen bg-white">
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
    );
  }

  if (!error) return null;

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl">
        <AlertTriangle className="mx-auto h-10 w-10 text-rose-600" />
        <h1 className="mt-4 text-xl font-black text-slate-900">تعذر تحميل المتجر</h1>
        <p className="mt-2 text-sm text-slate-600">{error}</p>
        <button type="button" onClick={retry} className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">
          إعادة المحاولة
        </button>
      </div>
    </main>
  );
}
