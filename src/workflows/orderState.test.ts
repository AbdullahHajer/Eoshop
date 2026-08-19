import { describe, expect, it } from "vitest";
import type { Product } from "../types";
import type { OrderReceipt } from "../adapters/uiAdapters";
import { merchantOrderActions, reconcileCartWithStorefront } from "./orderState";

const product = (id: string, price: number, available = 10): Product => ({
  id,
  name: `Product ${id}`,
  price,
  description: "Description",
  category: "General",
  imageKeyword: "product",
  status: "published",
  manageStock: true,
  stockQuantity: available,
  availableQuantity: available,
});

describe("reconcileCartWithStorefront", () => {
  it("replaces stale product snapshots and caps quantities to current availability", () => {
    const result = reconcileCartWithStorefront(
      [{ product: product("one", 10), quantity: 4 }],
      [product("one", 12.5, 2)],
    );

    expect(result.items).toEqual([{ product: product("one", 12.5, 2), quantity: 2 }]);
    expect(result).toMatchObject({ removed: 0, changed: 1 });
  });

  it("removes products that disappeared or are no longer sellable", () => {
    const result = reconcileCartWithStorefront(
      [
        { product: product("removed", 10), quantity: 1 },
        { product: product("sold-out", 20), quantity: 1 },
      ],
      [product("sold-out", 20, 0)],
    );

    expect(result.items).toEqual([]);
    expect(result.removed).toBe(2);
  });
});

describe("merchantOrderActions", () => {
  it("renders only transitions projected by the server", () => {
    const order = {
      status: "submitted",
      allowedTransitions: ["cancelled", "accepted"],
    } as OrderReceipt;
    expect(merchantOrderActions(order).map((action) => action.status)).toEqual(["cancelled", "accepted"]);
  });

  it("fails closed when the response projects no transitions", () => {
    expect(merchantOrderActions({ status: "submitted" } as OrderReceipt)).toEqual([]);
  });
});
