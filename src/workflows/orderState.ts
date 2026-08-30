import type { Product } from "../types";
import type { OrderReceipt } from "../adapters/uiAdapters";

export type CartLine = { product: Product; quantity: number };

export interface CartReconciliation {
  items: CartLine[];
  removed: number;
  changed: number;
}

export type CartMutationReason = "not_sellable" | "out_of_stock" | "stock_limit" | null;

export interface CartMutation {
  items: CartLine[];
  acceptedQuantity: number;
  reason: CartMutationReason;
}

export const STOREFRONT_CART_LINE_LIMIT = 99;

export interface MerchantOrderAction {
  status: OrderReceipt["status"];
  label: string;
  tone: "danger" | "primary";
}

export function merchantOrderStatusLabel(status: OrderReceipt["status"]): string {
  return {
    submitted: "جديد",
    accepted: "مقبول",
    processing: "قيد التجهيز",
    completed: "مكتمل",
    cancelled: "ملغي",
    expired: "منتهي",
  }[status];
}

export function merchantPaymentMethodLabel(method: OrderReceipt["paymentMethod"]): string {
  if (method === "cod") return "الدفع عند الاستلام";
  if (method === "bank_transfer") return "تحويل بنكي";
  if (method === "wallet") return "محفظة إلكترونية";
  return "وسيلة الدفع غير متاحة";
}

export function merchantOrderReasonLabel(reasonCode: string): string {
  return {
    checkout_submitted: "أرسل العميل الطلب",
    merchant_accepted: "قبل التاجر الطلب",
    merchant_processing: "بدأ التاجر التجهيز",
    merchant_completed: "أكمل التاجر الطلب",
    merchant_cancelled: "ألغى التاجر الطلب",
    checkout_reservation_expired: "انتهت مهلة حجز المخزون",
  }[reasonCode] ?? "تحديث مسجل من الخادم";
}

export function merchantOrderActions(order: OrderReceipt): MerchantOrderAction[] {
  const labels: Record<NonNullable<OrderReceipt["allowedTransitions"]>[number], string> = {
    accepted: "قبول الطلب",
    processing: "بدء التجهيز",
    completed: "إكمال الطلب",
    cancelled: "إلغاء الطلب",
  };
  return (order.allowedTransitions ?? []).map((status) => ({
    status,
    label: labels[status],
    tone: status === "cancelled" ? "danger" : "primary",
  }));
}

export function isStorefrontProductPublished(product: Product): boolean {
  return product.status !== "archived" && product.status !== "draft";
}

export function storefrontAvailableQuantity(product: Product): number | null {
  if (product.manageStock === false) return null;
  const available = product.availableQuantity ?? product.stockQuantity;
  if (typeof available !== "number" || !Number.isFinite(available)) return null;
  return Math.max(0, Math.floor(available));
}

export function storefrontCartLineLimit(product: Product): number {
  return Math.min(storefrontAvailableQuantity(product) ?? STOREFRONT_CART_LINE_LIMIT, STOREFRONT_CART_LINE_LIMIT);
}

export function addProductToCart(cart: CartLine[], product: Product, requestedQuantity = 1): CartMutation {
  if (!isStorefrontProductPublished(product)) {
    return { items: cart, acceptedQuantity: 0, reason: "not_sellable" };
  }

  const requested = Number.isFinite(requestedQuantity)
    ? Math.max(0, Math.floor(requestedQuantity))
    : 0;
  if (requested === 0) return { items: cart, acceptedQuantity: 0, reason: null };

  const available = storefrontAvailableQuantity(product);
  if (available !== null && available <= 0) {
    return { items: cart, acceptedQuantity: 0, reason: "out_of_stock" };
  }

  const existing = cart.find((line) => line.product.id === product.id);
  const currentQuantity = existing?.quantity ?? 0;
  const lineLimit = storefrontCartLineLimit(product);
  const nextQuantity = Math.min(currentQuantity + requested, lineLimit);
  const acceptedQuantity = nextQuantity - currentQuantity;
  if (acceptedQuantity <= 0) {
    return { items: cart, acceptedQuantity: 0, reason: "stock_limit" };
  }

  const items = existing
    ? cart.map((line) => line.product.id === product.id ? { product, quantity: nextQuantity } : line)
    : [...cart, { product, quantity: nextQuantity }];
  return {
    items,
    acceptedQuantity,
    reason: acceptedQuantity < requested ? "stock_limit" : null,
  };
}

export function changeCartLineQuantity(cart: CartLine[], productId: string, amount: number): CartMutation {
  const line = cart.find((item) => item.product.id === productId);
  if (!line || !Number.isFinite(amount) || amount === 0) {
    return { items: cart, acceptedQuantity: 0, reason: null };
  }

  if (amount < 0) {
    const nextQuantity = line.quantity + Math.ceil(amount);
    return {
      items: nextQuantity <= 0
        ? cart.filter((item) => item.product.id !== productId)
        : cart.map((item) => item.product.id === productId ? { ...item, quantity: nextQuantity } : item),
      acceptedQuantity: Math.max(-line.quantity, Math.ceil(amount)),
      reason: null,
    };
  }

  return addProductToCart(cart, line.product, amount);
}

export function reconcileCartWithStorefront(cart: CartLine[], products: Product[]): CartReconciliation {
  const currentProducts = new Map(products.map((product) => [product.id, product]));
  let removed = 0;
  let changed = 0;
  const items: CartLine[] = [];

  for (const line of cart) {
    const product = currentProducts.get(line.product.id);
    if (!product || !isStorefrontProductPublished(product)) {
      removed += 1;
      continue;
    }
    const available = storefrontAvailableQuantity(product);
    if (available !== null && available <= 0) {
      removed += 1;
      continue;
    }
    const quantity = available === null ? line.quantity : Math.min(line.quantity, available);
    if (quantity !== line.quantity || JSON.stringify(product) !== JSON.stringify(line.product)) changed += 1;
    items.push({ product, quantity });
  }

  return { items, removed, changed };
}
