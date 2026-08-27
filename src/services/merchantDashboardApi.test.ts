import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./apiClient";
import { merchantDashboardApi } from "./merchantDashboardApi";

const response = {
  data: {
    tenantId: "tenant-1",
    generatedAt: "2026-08-27T08:00:00Z",
    currencyCode: "YER",
    visibility: { orders: true, inventory: true, analytics: true, productsManage: true, workspaceManage: true },
    metrics: {
      salesTodayMinor: 125000,
      ordersToday: 4,
      openOrders: 2,
      publishedProducts: 8,
      draftProducts: 1,
      lowStockProducts: 3,
    },
    tasks: [{ code: "orders_new", count: 2, section: "orders", priority: "high" }],
    recentOrders: [{
      id: "order-1",
      number: "EO-1001",
      status: "submitted",
      paymentState: "due_on_delivery",
      currencyCode: "YER",
      grandTotalMinor: 25000,
      createdAt: "2026-08-27T07:00:00Z",
      customer: { name: "must not cross the dashboard boundary" },
    }],
    salesSeries: [{ date: "2026-08-27", totalMinor: 125000 }],
    topProducts: [{ productId: "product-1", name: "منتج", quantity: 4 }],
    internalSchema: "must-not-cross",
  },
};

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
});

describe("merchantDashboardApi", () => {
  it("maps the permission-aware projection and discards undeclared sensitive fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await merchantDashboardApi.load("tenant/one");

    expect(result.metrics.ordersToday).toBe(4);
    expect(result.tasks[0]).toEqual({ code: "orders_new", count: 2, section: "orders", priority: "high" });
    expect(result.recentOrders[0]).not.toHaveProperty("customer");
    expect(result).not.toHaveProperty("internalSchema");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/merchant/stores/tenant%2Fone/dashboard");
  });

  it("rejects unsafe counters in an otherwise successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { ...response.data, metrics: { ...response.data.metrics, openOrders: -1 } },
    }), { status: 200 })));

    await expect(merchantDashboardApi.load("tenant-1")).rejects.toMatchObject({
      category: "unexpected",
      status: 200,
    });
  });
});
