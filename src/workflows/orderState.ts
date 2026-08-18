import type { Product } from "../types";
import type { OrderReceipt } from "../adapters/uiAdapters";

export type CartLine = { product: Product; quantity: number };

export interface CartReconciliation {
  items: CartLine[];
  removed: number;
  changed: number;
}

export interface MerchantOrderAction {
  status: OrderReceipt["status"];
  label: string;
  tone: "danger" | "primary";
}

export function merchantOrderActions(order: OrderReceipt): MerchantOrderAction[] {
  const actions: MerchantOrderAction[] = [];
  if (order.status === "submitted") actions.push({ status: "cancelled", label: "إلغاء", tone: "danger" });
  const next = order.status === "submitted" ? "accepted" : order.status === "accepted" ? "processing" : order.status === "processing" ? "completed" : null;
  if (next) actions.push({ status: next, label: `نقل إلى ${next}`, tone: "primary" });
  return actions;
}

export function reconcileCartWithStorefront(cart: CartLine[], products: Product[]): CartReconciliation {
  const currentProducts = new Map(products.map((product) => [product.id, product]));
  let removed = 0;
  let changed = 0;
  const items: CartLine[] = [];

  for (const line of cart) {
    const product = currentProducts.get(line.product.id);
    if (!product || product.status === "archived" || product.status === "draft") {
      removed += 1;
      continue;
    }
    const available = product.manageStock === false
      ? null
      : product.availableQuantity ?? product.stockQuantity ?? null;
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
