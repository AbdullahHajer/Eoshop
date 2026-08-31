import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import StorePreview from "../../src/components/StorePreview";
import { ELEGANT_PRESET, type Product, type StoreConfig } from "../../src/types";
import { addProductToCart, changeCartLineQuantity, type CartLine } from "../../src/workflows/orderState";

const products: Product[] = [
  {
    id: "information-perfume",
    status: "published",
    name: "عطر بلانشه الاستثنائي",
    price: 310,
    description: "تركيبة عطرية متوازنة بنفحات نظيفة.",
    category: "عطور",
    imageKeyword: "perfume",
    imageUrl: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=800&q=86",
    manageStock: true,
    stockQuantity: 12,
    availableQuantity: 12,
  },
];

const config: StoreConfig = {
  ...ELEGANT_PRESET,
  storeName: "فيلور",
  slogan: "اختيارات تحريرية تجمع بين التفاصيل الهادئة والحضور الواثق.",
  currency: "ر.س",
  primaryColor: "#8A4B36",
  secondaryColor: "#1C1917",
  textColor: "#57534E",
  bgColor: "#FBFAF7",
  cardBgColor: "#FFFFFF",
  borderColor: "#E8E4DE",
  products,
  aboutTitle: "نختار ما يستحق أن يبقى",
  aboutText: "بدأت فيلور كمساحة تجمع القطع التي تحمل قصة واضحة وتصميمًا يعيش أبعد من موسم واحد. كل ما يظهر هنا هو جزء من هوية المتجر المنشورة واختياراته الحالية.",
  aboutVision: "أن تكون كل زيارة فرصة لاكتشاف قطعة تعبّر عن صاحبها، بجمال هادئ وتجربة شراء واضحة من الاختيار حتى استلام الطلب.",
  aboutImage: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1400&q=88",
  phone: "+967700000111",
  whatsapp: "+967700000111",
  email: "hello@velour.example",
  address: "صنعاء — شارع حدة، جوار المركز التجاري",
  workingHours: "السبت إلى الخميس، 9 صباحًا — 9 مساءً",
  instagram: "velour_store",
  twitter: "velour_store",
  tiktok: "velour_store",
};

function InformationPreview() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [category, setCategory] = useState("الكل");
  const page = new URLSearchParams(window.location.search).get("page") === "contact" ? "contact" : "about";

  return (
    <StorePreview
      config={config}
      cart={cart}
      addToCart={(product, quantity = 1) => setCart((current) => addProductToCart(current, product, quantity).items)}
      updateQuantity={(productId, amount) => setCart((current) => changeCartLineQuantity(current, productId, amount).items)}
      calculateTotal={() => undefined}
      isCartDrawerOpen={drawerOpen}
      setIsCartDrawerOpen={setDrawerOpen}
      hasOrdered={false}
      handleCheckout={() => undefined}
      selectedCategory={category}
      setSelectedCategory={setCategory}
      externalPage={page}
      mode="preview"
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <InformationPreview />
  </React.StrictMode>,
);
