import type { Product } from "../types";

export type CartLine = { product: Product; quantity: number };

export interface CartReconciliation {
  items: CartLine[];
  removed: number;
  changed: number;
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
