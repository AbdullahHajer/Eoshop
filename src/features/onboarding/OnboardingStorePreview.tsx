import React, { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import StorePreview from "../../components/StorePreview";
import type { Product, StoreConfig } from "../../types";

interface OnboardingStorePreviewProps {
  config: StoreConfig;
  compact?: boolean;
}

export default function OnboardingStorePreview({ config, compact = false }: OnboardingStorePreviewProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("الكل");

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      return existing
        ? current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { product, quantity: 1 }];
    });
    setDrawerOpen(true);
  };

  const updateQuantity = (productId: string, amount: number) => {
    setCart((current) => current
      .map((item) => item.product.id === productId ? { ...item, quantity: item.quantity + amount } : item)
      .filter((item) => item.quantity > 0));
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
        <div>
          <p className="text-xs font-black">معاينة حقيقية للمتجر</p>
          <p className="mt-0.5 text-[10px] text-slate-400">المعاينة تجريبية ولا تنشئ طلبات فعلية</p>
        </div>
        <div className="flex rounded-xl bg-white/10 p-1" aria-label="حجم معاينة المتجر">
          <button type="button" aria-label="معاينة سطح المكتب" onClick={() => setDevice("desktop")} className={`rounded-lg p-2 ${device === "desktop" ? "bg-white text-slate-950" : "text-slate-300"}`}><Monitor className="h-4 w-4" /></button>
          <button type="button" aria-label="معاينة الجوال" onClick={() => setDevice("mobile")} className={`rounded-lg p-2 ${device === "mobile" ? "bg-white text-slate-950" : "text-slate-300"}`}><Smartphone className="h-4 w-4" /></button>
        </div>
      </div>
      <div className={`flex items-start justify-center overflow-auto bg-slate-200 p-3 ${compact ? "h-[520px]" : "h-[680px]"}`}>
        <div className={`overflow-hidden bg-white shadow-2xl transition-all ${device === "mobile" ? "h-[640px] w-[360px] shrink-0 rounded-[2.5rem] border-[9px] border-slate-950" : "min-h-full w-full rounded-2xl"}`}>
          <StorePreview
            config={config}
            cart={cart}
            addToCart={addToCart}
            updateQuantity={updateQuantity}
            calculateTotal={() => undefined}
            isCartDrawerOpen={drawerOpen}
            setIsCartDrawerOpen={setDrawerOpen}
            hasOrdered={false}
            handleCheckout={() => undefined}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            previewDevice={device}
            mode="preview"
          />
        </div>
      </div>
    </div>
  );
}

