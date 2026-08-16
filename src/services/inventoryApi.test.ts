import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./apiClient";
import { inventoryApi } from "./inventoryApi";

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
});

const item = {
  productId: "11111111-1111-4111-8111-111111111111",
  name: "Server product",
  sku: "SKU-1",
  onHand: 15,
  reserved: 3,
  available: 12,
  manageStock: true,
  lowStockThreshold: 5,
  inventoryRevision: 4,
  internalCost: "must-not-escape",
};

describe("inventoryApi", () => {
  it("maps explicit balances and sends an idempotent revisioned adjustment", async () => {
    const response = {
      data: {
        tenantId: "tenant-1",
        operationId: "22222222-2222-4222-8222-222222222222",
        replayed: false,
        items: [item],
      },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "inventory-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "33333333-3333-4333-8333-333333333333" });

    const result = await inventoryApi.adjust("tenant-1", [{
      productId: item.productId,
      expectedInventoryRevision: 3,
      movementKind: "receive",
      delta: 5,
    }], "stock_received", "Supplier delivery");

    expect(result.items[0]).toEqual(expect.objectContaining({ onHand: 15, reserved: 3, available: 12 }));
    expect(result.items[0]).not.toHaveProperty("internalCost");
    const request = fetchMock.mock.calls[1][1] as RequestInit;
    expect(request.headers).toMatchObject({
      "Idempotency-Key": "33333333-3333-4333-8333-333333333333",
      "X-CSRF-TOKEN": "inventory-csrf",
    });
    expect(JSON.parse(request.body as string).lines[0].expectedInventoryRevision).toBe(3);
  });

  it("preserves null availability for products whose stock is not tracked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { items: [{ ...item, available: null, manageStock: false }] },
    }), { status: 200 })));

    await expect(inventoryApi.load("tenant-1")).resolves.toEqual([
      expect.objectContaining({ available: null, manageStock: false }),
    ]);
  });
});
