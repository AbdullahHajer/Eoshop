import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./apiClient";
import { orderApi, type CreateOrderInput } from "./orderApi";

const config = {
  storeName: "Server Store",
  slogan: "Server-owned",
  logoIcon: "S",
  primaryColor: "#112233",
  secondaryColor: "#334455",
  themeStyle: "elegant",
  bannerText: "Banner",
  fontFamily: "Cairo",
  phone: "+967700000000",
  currency: "YER",
  products: [{
    id: "11111111-1111-4111-8111-111111111111",
    name: "Product",
    price: "12.50",
    description: "Description",
    category: "General",
    imageKeyword: "product",
  }],
};

const receipt = {
  id: "22222222-2222-4222-8222-222222222222",
  number: "EO-222222222222",
  status: "submitted",
  allowedTransitions: ["cancelled", "accepted"],
  paymentState: "due_on_delivery",
  currencyCode: "YER",
  totals: {
    itemsSubtotalMinor: 2500,
    discountMinor: 250,
    shippingMinor: 500,
    taxMinor: 338,
    paymentFeeMinor: 100,
    grandTotalMinor: 3188,
  },
  items: [{
    productId: "11111111-1111-4111-8111-111111111111",
    name: "Product",
    sku: "SKU-1",
    unitPriceMinor: 1250,
    quantity: 2,
    lineTotalMinor: 2500,
    tracked: true,
  }],
  createdAt: "2026-08-17T10:00:00Z",
  internalCost: 900,
};

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
});

describe("orderApi", () => {
  it("loads the public server workspace with authoritative revisions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { workspaceRevision: 4, catalogRevision: 7, config, schemaName: "secret" },
    }), { status: 200 })));

    const storefront = await orderApi.loadStorefront();

    expect(storefront.workspaceRevision).toBe(4);
    expect(storefront.catalogRevision).toBe(7);
    expect(storefront.config.products[0].price).toBe(12.5);
    expect(storefront).not.toHaveProperty("schemaName");
  });

  it("sends identifiers and quantities only and trusts the returned minor-unit receipt", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "order-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { replayed: false, order: receipt } }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "33333333-3333-4333-8333-333333333333" });
    const input: CreateOrderInput = {
      workspaceRevision: 4,
      catalogRevision: 7,
      lines: [{ productId: config.products[0].id, quantity: 2 }],
      couponCode: "SAVE10",
      payment: { method: "cod" },
      customer: { name: "Customer", phone: "+967700000001" },
      address: { city: "Sanaa", area: "Center", details: "Gate 1" },
    };

    const result = await orderApi.create(input, "44444444-4444-4444-8444-444444444444");

    expect(result.order.totals.grandTotalMinor).toBe(3188);
    expect(result.order.checkoutPresentation).toEqual({
      title: "تم استلام طلبك",
      message: "احتفظ برقم الطلب للمتابعة مع المتجر.",
      whatsappTarget: null,
    });
    expect(result.order).not.toHaveProperty("internalCost");
    const request = fetchMock.mock.calls[1][1] as RequestInit;
    const body = JSON.parse(request.body as string);
    expect(body.lines).toEqual([{ productId: config.products[0].id, quantity: 2 }]);
    expect(body).not.toHaveProperty("total");
    expect(body).not.toHaveProperty("price");
    expect(request.headers).toMatchObject({
      "Idempotency-Key": "44444444-4444-4444-8444-444444444444",
      "X-CSRF-TOKEN": "order-csrf",
    });
  });

  it("rejects unsafe or fractional minor-unit values in a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        items: [{ ...receipt, totals: { ...receipt.totals, taxMinor: 1.5 } }],
        pagination: { total: 1 },
      },
    }), { status: 200 })));

    await expect(orderApi.list("tenant-one")).rejects.toMatchObject({
      category: "unexpected",
      status: 200,
    });
  });

  it("maps only server-projected order transitions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { items: [receipt], pagination: { total: 1 } },
    }), { status: 200 })));

    const result = await orderApi.list("tenant-one");
    expect(result.items[0].allowedTransitions).toEqual(["cancelled", "accepted"]);
  });

  it("rejects a malformed receipt contact target", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        items: [{
          ...receipt,
          checkoutPresentation: { title: "Title", message: "Message", whatsappTarget: "javascript:alert(1)" },
        }],
        pagination: { total: 1 },
      },
    }), { status: 200 })));

    await expect(orderApi.list("tenant-one")).rejects.toMatchObject({ category: "unexpected", status: 200 });
  });
});
