// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import type { MerchantOrderList, OrderDetail, OrderReceipt } from "../../adapters/uiAdapters";
import MerchantOrdersWorkspace from "../../components/MerchantOrdersWorkspace";

const receipt: OrderReceipt = {
  id: "order-1",
  number: "EO-1",
  status: "submitted",
  allowedTransitions: ["accepted", "cancelled"],
  fulfillmentStatus: "unfulfilled",
  paymentState: "due_on_delivery",
  paymentMethod: "cod",
  customerName: "أحمد العميل",
  currencyCode: "YER",
  totals: { itemsSubtotalMinor: 100, discountMinor: 0, shippingMinor: 0, taxMinor: 0, paymentFeeMinor: 0, grandTotalMinor: 100 },
  createdAt: "2026-08-19T10:00:00Z",
  checkoutPresentation: { title: "تم استلام طلبك", message: "احتفظ برقم الطلب للمتابعة مع المتجر.", whatsappTarget: null },
};

const detail: OrderDetail = {
  ...receipt,
  items: [{ productId: "product-1", name: "عطر صنعاء", sku: "SKU-1", unitPriceMinor: 100, quantity: 1, lineTotalMinor: 100, tracked: true }],
  customer: { name: "أحمد العميل", phone: "+967700000001", email: "customer@example.test", notes: "اتصل قبل الوصول" },
  address: { city: "صنعاء", area: "المدينة القديمة", street: null, details: "البوابة الأولى" },
  payment: { method: "cod", state: "due_on_delivery", channelId: null, channelLabel: null, reference: null },
  history: [{ from: null, to: "submitted", reasonCode: "checkout_submitted", createdAt: "2026-08-19T10:00:00Z" }],
  fulfillment: { status: "unfulfilled", allowedTransitions: ["preparing"], history: [] },
};

const listResult = (items: OrderReceipt[] = [receipt], overrides: Partial<MerchantOrderList> = {}): MerchantOrderList => ({
  items,
  total: items.length,
  page: 1,
  perPage: 25,
  lastPage: 1,
  filters: { status: null, query: null },
  ...overrides,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MerchantOrdersWorkspace", () => {
  it("opens protected customer, delivery, item and timeline details before a transition", async () => {
    const accepted = { ...receipt, status: "accepted" as const, allowedTransitions: [] };
    const acceptedDetail = { ...detail, ...accepted, history: [...detail.history, { from: "submitted" as const, to: "accepted" as const, reasonCode: "merchant_accepted", createdAt: "2026-08-19T10:05:00Z" }] };
    const preparing = { ...accepted, status: "processing" as const, fulfillmentStatus: "preparing" as const };
    const preparingDetail = {
      ...acceptedDetail,
      ...preparing,
      fulfillment: {
        status: "preparing" as const,
        allowedTransitions: ["dispatched" as const],
        history: [{ from: "unfulfilled" as const, to: "preparing" as const, reasonCode: "merchant_preparing", createdAt: "2026-08-19T10:10:00Z" }],
      },
    };
    const list = vi.fn(async () => listResult());
    const getDetail = vi.fn().mockResolvedValueOnce(detail).mockResolvedValueOnce(acceptedDetail).mockResolvedValueOnce(preparingDetail);
    const updateStatus = vi.fn(async () => ({ replayed: false, order: accepted }));
    const updateFulfillment = vi.fn(async () => ({ replayed: false, order: preparing }));
    const adapters = createFakeUiAdapters({ orders: { list, detail: getDetail, updateStatus, updateFulfillment } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOrdersWorkspace tenantId="tenant-a" canView /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    await operator.click(await screen.findByRole("button", { name: /فتح تفاصيل الطلب/ }));
    expect(await screen.findByText("+967700000001")).toBeTruthy();
    expect(screen.getByText("البوابة الأولى")).toBeTruthy();
    expect(screen.getByText("عطر صنعاء")).toBeTruthy();
    expect(screen.getByText(/أرسل العميل الطلب/)).toBeTruthy();

    await operator.click(screen.getByRole("button", { name: "قبول الطلب" }));
    await waitFor(() => expect(updateStatus).toHaveBeenCalledWith("tenant-a", "order-1", "accepted", "merchant_accepted", expect.any(String), expect.any(AbortSignal)));
    await operator.click(await screen.findByRole("button", { name: "بدء التجهيز" }));
    await waitFor(() => expect(updateFulfillment).toHaveBeenCalledWith("tenant-a", "order-1", "preparing", expect.any(String), expect.any(AbortSignal)));
    expect(await screen.findByRole("button", { name: "تسجيل الخروج للتسليم" })).toBeTruthy();
    expect(getDetail).toHaveBeenCalledTimes(3);
  });

  it("reuses the same transition key after an ambiguous failure", async () => {
    const authoritative = { ...receipt, status: "accepted" as const, allowedTransitions: [] };
    const acceptedDetail = { ...detail, ...authoritative };
    const updateStatus = vi.fn()
      .mockRejectedValueOnce(new Error("network result unknown"))
      .mockResolvedValueOnce({ replayed: true, order: { ...receipt, status: "accepted", allowedTransitions: [] } });
    const list = vi.fn()
      .mockResolvedValueOnce(listResult())
      .mockResolvedValueOnce(listResult([authoritative]));
    const getDetail = vi.fn().mockResolvedValueOnce(detail).mockResolvedValueOnce(acceptedDetail);
    const adapters = createFakeUiAdapters({ orders: { list, detail: getDetail, updateStatus } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOrdersWorkspace tenantId="tenant-a" canView /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    await operator.click(await screen.findByRole("button", { name: /فتح تفاصيل الطلب/ }));
    await operator.click(await screen.findByRole("button", { name: "قبول الطلب" }));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByRole("alert")).toBeTruthy());
    await operator.click(screen.getByRole("button", { name: "قبول الطلب" }));
    await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(2));
    expect(updateStatus.mock.calls[0][4]).toBe(updateStatus.mock.calls[1][4]);
    expect(await screen.findByRole("button", { name: "بدء التجهيز" })).toBeTruthy();
  });

  it("reuses the same fulfillment key after an ambiguous failure", async () => {
    const dispatchableDetail: OrderDetail = {
      ...detail,
      status: "processing",
      allowedTransitions: [],
      fulfillmentStatus: "preparing",
      fulfillment: {
        status: "preparing",
        allowedTransitions: ["dispatched"],
        history: [{ from: "unfulfilled", to: "preparing", reasonCode: "merchant_preparing", createdAt: "2026-08-19T10:10:00Z" }],
      },
    };
    const dispatched = { ...receipt, status: "processing" as const, allowedTransitions: [], fulfillmentStatus: "dispatched" as const };
    const dispatchedDetail: OrderDetail = {
      ...dispatchableDetail,
      ...dispatched,
      fulfillment: {
        status: "dispatched",
        allowedTransitions: ["delivered"],
        history: [...dispatchableDetail.fulfillment!.history, { from: "preparing", to: "dispatched", reasonCode: "merchant_dispatched", createdAt: "2026-08-19T10:20:00Z" }],
      },
    };
    const updateFulfillment = vi.fn()
      .mockRejectedValueOnce(new Error("network result unknown"))
      .mockResolvedValueOnce({ replayed: true, order: dispatched });
    const list = vi.fn()
      .mockResolvedValueOnce(listResult([{ ...receipt, status: "processing", allowedTransitions: [], fulfillmentStatus: "preparing" }]))
      .mockResolvedValueOnce(listResult([dispatched]));
    const getDetail = vi.fn().mockResolvedValueOnce(dispatchableDetail).mockResolvedValueOnce(dispatchedDetail);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const adapters = createFakeUiAdapters({ orders: { list, detail: getDetail, updateFulfillment } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOrdersWorkspace tenantId="tenant-a" canView /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    await operator.click(await screen.findByRole("button", { name: /فتح تفاصيل الطلب/ }));
    await operator.click(await screen.findByRole("button", { name: "تسجيل الخروج للتسليم" }));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByRole("alert")).toBeTruthy());
    await operator.click(screen.getByRole("button", { name: "تسجيل الخروج للتسليم" }));

    await waitFor(() => expect(updateFulfillment).toHaveBeenCalledTimes(2));
    expect(updateFulfillment.mock.calls[0][3]).toBe(updateFulfillment.mock.calls[1][3]);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("button", { name: "تسجيل الطلب كمُسلّم" })).toBeTruthy();
  }, 20_000);

  it("sends bounded status and order-number filters to the server", async () => {
    const list = vi.fn(async (_tenant: string, query: { status?: string; query?: string }) => listResult([], { filters: { status: query.status === "submitted" ? "submitted" : null, query: query.query ?? null } }));
    const adapters = createFakeUiAdapters({ orders: { list } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOrdersWorkspace tenantId="tenant-a" canView /></UiAdaptersProvider>);
    const operator = userEvent.setup();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));

    await operator.type(screen.getByPlaceholderText("EO-..."), "EO-ABC");
    await operator.selectOptions(screen.getByRole("combobox", { name: "حالة الطلب" }), "submitted");
    await operator.click(screen.getByRole("button", { name: "تطبيق" }));

    await waitFor(() => expect(list).toHaveBeenLastCalledWith("tenant-a", expect.objectContaining({ page: 1, status: "submitted", query: "EO-ABC" }), expect.any(AbortSignal)));
  });

  it("keeps a read-only order detail free of management actions", async () => {
    const adapters = createFakeUiAdapters({ orders: { list: vi.fn(async () => listResult([{ ...receipt, allowedTransitions: [] }])), detail: vi.fn(async () => ({ ...detail, allowedTransitions: [], fulfillment: { ...detail.fulfillment!, allowedTransitions: [] } })) } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOrdersWorkspace tenantId="tenant-a" canView /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    await operator.click(await screen.findByRole("button", { name: /فتح تفاصيل الطلب/ }));
    expect(await screen.findByText("+967700000001")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "قبول الطلب" })).toBeNull();
    expect(screen.queryByRole("button", { name: "إلغاء الطلب" })).toBeNull();
    expect(screen.queryByRole("button", { name: "بدء التجهيز" })).toBeNull();
  });

  it("requires explicit confirmation before the terminal cancellation action", async () => {
    const updateStatus = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const adapters = createFakeUiAdapters({ orders: { list: vi.fn(async () => listResult()), detail: vi.fn(async () => detail), updateStatus } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOrdersWorkspace tenantId="tenant-a" canView /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    await operator.click(await screen.findByRole("button", { name: /فتح تفاصيل الطلب/ }));
    await operator.click(await screen.findByRole("button", { name: "إلغاء الطلب" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(updateStatus).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
