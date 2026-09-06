import type { Product } from "../types";
import type { FulfillmentStatus, MerchantOrderFulfillment, OrderReceipt } from "../adapters/uiAdapters";

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
  status: "accepted" | "cancelled";
  label: string;
  tone: "danger" | "primary";
}

export interface MerchantFulfillmentAction {
  status: MerchantOrderFulfillment["allowedTransitions"][number];
  label: string;
  tone: "primary" | "warning" | "success";
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

export function merchantFulfillmentStatusLabel(status: FulfillmentStatus): string {
  return {
    unfulfilled: "لم يبدأ التنفيذ",
    preparing: "قيد التجهيز",
    dispatched: "خرج للتسليم",
    delivered: "سُجّل كمُسلّم",
    legacy_completed: "مكتمل قبل التتبع",
  }[status];
}

export function merchantFulfillmentReasonLabel(reasonCode: string): string {
  return {
    checkout_submitted: "سُجّل الطلب بانتظار بدء التنفيذ",
    merchant_preparing: "سجّل التاجر بدء التجهيز",
    merchant_dispatched: "سجّل التاجر خروج الطلب للتسليم",
    merchant_delivered: "سجّل التاجر تسليم الطلب",
    migration_unfulfilled_adopted: "نُقلت حالة الطلب السابقة بلا حدث تنفيذ",
    migration_processing_adopted: "نُقلت حالة التجهيز السابقة إلى السجل",
    migration_legacy_completed_adopted: "حالة مكتملة سابقة لتفعيل سجل التنفيذ",
  }[reasonCode] ?? "تحديث تنفيذ مسجل من الخادم";
}

export function merchantOrderActions(order: OrderReceipt): MerchantOrderAction[] {
  if (order.status !== "submitted") return [];
  const labels: Record<MerchantOrderAction["status"], string> = {
    accepted: "قبول الطلب",
    cancelled: "إلغاء الطلب",
  };
  return (order.allowedTransitions ?? [])
    .filter((status): status is "accepted" | "cancelled" => status === "accepted" || status === "cancelled")
    .map((status) => ({
    status,
    label: labels[status],
    tone: status === "cancelled" ? "danger" : "primary",
  }));
}

export function merchantFulfillmentActions(order: Pick<OrderReceipt, "status"> & { fulfillment?: MerchantOrderFulfillment }): MerchantFulfillmentAction[] {
  if (!order.fulfillment) return [];
  const labels: Record<MerchantFulfillmentAction["status"], string> = {
    preparing: "بدء التجهيز",
    dispatched: "تسجيل الخروج للتسليم",
    delivered: "تسجيل الطلب كمُسلّم",
  };
  const tones: Record<MerchantFulfillmentAction["status"], MerchantFulfillmentAction["tone"]> = {
    preparing: "primary",
    dispatched: "warning",
    delivered: "success",
  };
  return order.fulfillment.allowedTransitions
    .filter((status) => {
      if (status === "preparing") return order.status === "accepted" && order.fulfillment?.status === "unfulfilled";
      if (status === "dispatched") return order.status === "processing" && order.fulfillment?.status === "preparing";
      return order.status === "processing" && order.fulfillment?.status === "dispatched";
    })
    .map((status) => ({
      status,
      label: labels[status],
      tone: tones[status],
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
