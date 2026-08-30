import { describe, expect, it } from "vitest";
import type { Product } from "../types";
import type { OrderReceipt } from "../adapters/uiAdapters";
import {
  addProductToCart,
  changeCartLineQuantity,
  merchantOrderActions,
  reconcileCartWithStorefront,
  storefrontAvailableQuantity,
} from "./orderState";

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

describe("storefront cart boundaries", () => {
  it("rejects unpublished and sold-out products before checkout", () => {
    const draft = { ...product("draft", 10), status: "draft" as const };
    const soldOut = product("sold-out", 20, 0);

    expect(addProductToCart([], draft)).toMatchObject({ items: [], acceptedQuantity: 0, reason: "not_sellable" });
    expect(addProductToCart([], soldOut)).toMatchObject({ items: [], acceptedQuantity: 0, reason: "out_of_stock" });
  });

  it("caps additions and quantity changes to the public availability snapshot", () => {
    const limited = product("limited", 12.5, 2);
    const added = addProductToCart([], limited, 5);

    expect(added.items).toEqual([{ product: limited, quantity: 2 }]);
    expect(added).toMatchObject({ acceptedQuantity: 2, reason: "stock_limit" });
    expect(changeCartLineQuantity(added.items, limited.id, 1)).toMatchObject({
      items: added.items,
      acceptedQuantity: 0,
      reason: "stock_limit",
    });
  });

  it("keeps untracked products orderable and removes a line at zero", () => {
    const untracked = { ...product("untracked", 8), manageStock: false, availableQuantity: 0 };
    const added = addProductToCart([], untracked, 120);

    expect(storefrontAvailableQuantity(untracked)).toBeNull();
    expect(added).toMatchObject({ acceptedQuantity: 99, reason: "stock_limit" });
    expect(added.items[0].quantity).toBe(99);
    expect(changeCartLineQuantity(added.items, untracked.id, -99).items).toEqual([]);
  });

  it("ignores non-finite quantity mutations", () => {
    expect(addProductToCart([], product("finite", 5), Number.NaN)).toEqual({
      items: [],
      acceptedQuantity: 0,
      reason: null,
    });
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
