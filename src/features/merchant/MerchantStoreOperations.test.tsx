// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import type { MerchantDashboardSnapshot, StoreSubmission, UserProfile } from "../../adapters/uiAdapters";
import { UiAdapterError } from "../../contracts/uiError";
import MerchantStoreOperations from "../../components/MerchantStoreOperations";

const user: UserProfile = { id: "user-1", fullName: "مالك المتجر", email: "owner@example.test", phone: "", profileRevision: 1, createdAt: null, updatedAt: null, role: "merchant", platformRoles: [], platformPermissions: [] };
const store = (overrides: Partial<StoreSubmission> = {}): StoreSubmission => ({
  id: "tenant-a", storeName: "متجر صنعاء", businessType: "تجزئة", verificationStatus: "approved", provisioningStatus: "active", publicationStatus: "unpublished", reviewFeedback: null,
  capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: false },
  internalDomain: "store-a.example.test", requestedDomain: "sanaa.example.test", publicDomain: null,
  plan: { key: "starter", name: "البداية", activationMode: "automatic" }, subscriptionStatus: "active", publicationBlockers: [], createdAt: null, activeAt: null, publishedAt: null,
  ...overrides,
});

const dashboardSnapshot = (overrides: Partial<MerchantDashboardSnapshot> = {}): MerchantDashboardSnapshot => ({
  tenantId: "tenant-a",
  generatedAt: "2026-08-27T08:00:00Z",
  currencyCode: "YER",
  visibility: { orders: true, inventory: true, analytics: true, productsManage: true, workspaceManage: true },
  metrics: { salesTodayMinor: 125000, ordersToday: 4, openOrders: 2, publishedProducts: 1, draftProducts: 0, lowStockProducts: 1 },
  tasks: [{ code: "orders_new", count: 2, section: "orders", priority: "high" }],
  recentOrders: [],
  salesSeries: [
    { date: "2026-08-21", totalMinor: 0 },
    { date: "2026-08-22", totalMinor: 10000 },
    { date: "2026-08-23", totalMinor: 0 },
    { date: "2026-08-24", totalMinor: 20000 },
    { date: "2026-08-25", totalMinor: 0 },
    { date: "2026-08-26", totalMinor: 30000 },
    { date: "2026-08-27", totalMinor: 125000 },
  ],
  topProducts: [],
  ...overrides,
});

function callbacks() {
  return { onBack: vi.fn(), onNavigate: vi.fn(), onOpenBuilder: vi.fn(), onPublish: vi.fn(async () => undefined), onUnpublish: vi.fn(async () => undefined), onCopyPublicUrl: vi.fn(), onLogout: vi.fn(), onSessionExpired: vi.fn() };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("MerchantStoreOperations", () => {
  it("exposes the active module through a compact keyboard-reachable shell", () => {
    const adapters = createFakeUiAdapters();
    render(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={store()} section="overview" {...callbacks()} /></UiAdaptersProvider>);

    expect(screen.getByRole("link", { name: "تجاوز التنقل والانتقال إلى المحتوى الرئيسي" }).getAttribute("href")).toBe("#merchant-operations-main");
    expect(document.getElementById("merchant-operations-main")?.getAttribute("tabindex")).toBe("-1");
    const navigation = screen.getByRole("navigation", { name: "وحدات تشغيل المتجر" });
    expect(navigation.className).toContain("overflow-x-auto");
    expect(within(navigation).getByRole("button", { name: "نظرة عامة" }).getAttribute("aria-current")).toBe("page");
  });

  it("loads one permission-aware server-owned launch dashboard", async () => {
    const adapters = createFakeUiAdapters({
      merchantDashboard: { load: vi.fn(async () => dashboardSnapshot()) },
    });
    render(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={store()} section="overview" {...callbacks()} /></UiAdaptersProvider>);

    await waitFor(() => expect(screen.getByText("4")).toBeTruthy());
    expect(screen.getByText("المنتجات المنشورة")).toBeTruthy();
    expect(screen.getByText("راجع 2 طلبات جديدة")).toBeTruthy();
    expect(screen.getByText("مبيعات اليوم المكتملة")).toBeTruthy();
  });

  it("keeps a catalog-only staff member inside the read module without opening the builder", async () => {
    const onNavigate = vi.fn();
    const onOpenBuilder = vi.fn();
    const staffStore = store({ capabilities: { workspaceManage: false, catalogManage: true, inventoryView: false, inventoryManage: false, ordersView: false, ordersManage: false, draftEdit: false, resubmit: false, publish: false, unpublish: false } });
    const adapters = createFakeUiAdapters({ merchantDashboard: { load: vi.fn(async () => dashboardSnapshot({ visibility: { orders: false, inventory: false, analytics: false, productsManage: true, workspaceManage: false }, metrics: { salesTodayMinor: null, ordersToday: null, openOrders: null, publishedProducts: 0, draftProducts: 0, lowStockProducts: null }, tasks: [], salesSeries: [], topProducts: [] })) } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={staffStore} section="overview" {...callbacks()} onNavigate={onNavigate} onOpenBuilder={onOpenBuilder} /></UiAdaptersProvider>);

    await userEvent.click(screen.getAllByRole("button", { name: /المنتجات/ })[0]);
    expect(onNavigate).toHaveBeenCalledWith("products");
    expect(onOpenBuilder).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "التصميم والهوية" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not request operational data for an unknown store", () => {
    const dashboardLoad = vi.fn();
    const adapters = createFakeUiAdapters({ merchantDashboard: { load: dashboardLoad } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={null} section="overview" {...callbacks()} /></UiAdaptersProvider>);
    expect(screen.getByRole("heading", { name: "المتجر غير متاح لهذا الحساب" })).toBeTruthy();
    expect(dashboardLoad).not.toHaveBeenCalled();
  });

  it("keeps denied overview facts unavailable instead of inventing zero values", async () => {
    const dashboardLoad = vi.fn(async () => dashboardSnapshot({
      visibility: { orders: false, inventory: false, analytics: false, productsManage: false, workspaceManage: false },
      metrics: { salesTodayMinor: null, ordersToday: null, openOrders: null, publishedProducts: null, draftProducts: null, lowStockProducts: null },
      tasks: [], recentOrders: [], salesSeries: [], topProducts: [],
    }));
    const adapters = createFakeUiAdapters({
      merchantDashboard: { load: dashboardLoad },
    });
    const deniedStore = store({ capabilities: { workspaceManage: false, catalogManage: false, inventoryView: false, inventoryManage: false, ordersView: false, ordersManage: false, draftEdit: false, resubmit: false, publish: false, unpublish: false } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={deniedStore} section="overview" {...callbacks()} /></UiAdaptersProvider>);

    await waitFor(() => expect(screen.getAllByText("غير متاح لصلاحيات الحساب").length).toBeGreaterThanOrEqual(3));
    expect(dashboardLoad).toHaveBeenCalledWith("tenant-a", expect.any(AbortSignal));
  });

  it("expires the local merchant context when an operations request returns 401", async () => {
    const onSessionExpired = vi.fn();
    const adapters = createFakeUiAdapters({
      merchantDashboard: { load: vi.fn(async () => { throw new UiAdapterError("انتهت الجلسة", "unauthenticated"); }) },
    });
    render(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={store()} section="overview" {...callbacks()} onSessionExpired={onSessionExpired} /></UiAdaptersProvider>);

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalled());
  });

  it("expires the local merchant context when a publication mutation returns 401", async () => {
    const onSessionExpired = vi.fn();
    const onPublish = vi.fn(async () => { throw new UiAdapterError("انتهت الجلسة", "unauthenticated"); });
    const publishable = store({
      capabilities: { ...store().capabilities, publish: true },
    });
    const adapters = createFakeUiAdapters();
    render(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={publishable} section="overview" {...callbacks()} onPublish={onPublish} onSessionExpired={onSessionExpired} /></UiAdaptersProvider>);

    await userEvent.click(screen.getByRole("button", { name: "نشر المتجر" }));
    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledOnce());
    expect(screen.queryByText("انتهت الجلسة")).toBeNull();
  });

  it("removes the previous tenant catalog synchronously when the route key changes", async () => {
    let resolveSecond!: (value: Awaited<ReturnType<ReturnType<typeof createFakeUiAdapters>["catalog"]["load"]>>) => void;
    const second = new Promise<Awaited<ReturnType<ReturnType<typeof createFakeUiAdapters>["catalog"]["load"]>>>((resolve) => { resolveSecond = resolve; });
    const catalogLoad = vi.fn((tenantId: string) => tenantId === "tenant-a"
      ? Promise.resolve({ tenantId, revision: 1, currencyCode: "YER", products: [{ id: "a", name: "منتج صنعاء", price: 1, status: "published" as const, description: "", category: "", imageKeyword: "default" }] })
      : second);
    const adapters = createFakeUiAdapters({ catalog: { load: catalogLoad } });
    const rendered = render(<UiAdaptersProvider adapters={adapters}><React.Fragment key="tenant-a"><MerchantStoreOperations user={user} store={store()} section="products" {...callbacks()} /></React.Fragment></UiAdaptersProvider>);
    expect(await screen.findByText("منتج صنعاء")).toBeTruthy();

    rendered.rerender(<UiAdaptersProvider adapters={adapters}><React.Fragment key="tenant-b"><MerchantStoreOperations user={user} store={store({ id: "tenant-b", storeName: "متجر تعز" })} section="products" {...callbacks()} /></React.Fragment></UiAdaptersProvider>);
    expect(screen.queryByText("منتج صنعاء")).toBeNull();
    expect(screen.getAllByText("متجر تعز").length).toBeGreaterThan(0);

    resolveSecond({ tenantId: "tenant-b", revision: 1, currencyCode: "YER", products: [{ id: "b", name: "منتج تعز", price: 2, status: "published", description: "", category: "", imageKeyword: "default" }] });
    expect(await screen.findByText("منتج تعز")).toBeTruthy();
  });

  it("ignores an older store snapshot that resolves after a tenant switch", async () => {
    let resolveFirst!: (value: MerchantDashboardSnapshot) => void;
    const first = new Promise<MerchantDashboardSnapshot>((resolve) => { resolveFirst = resolve; });
    const dashboardLoad = vi.fn((tenantId: string) => tenantId === "tenant-a"
      ? first
      : Promise.resolve(dashboardSnapshot({ tenantId: "tenant-b", metrics: { ...dashboardSnapshot().metrics, publishedProducts: 1 } })));
    const adapters = createFakeUiAdapters({ merchantDashboard: { load: dashboardLoad } });
    const catalogOnly = { workspaceManage: false, catalogManage: true, inventoryView: false, inventoryManage: false, ordersView: false, ordersManage: false, draftEdit: false, resubmit: false, publish: false, unpublish: false };
    const rendered = render(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={store({ capabilities: catalogOnly })} section="overview" {...callbacks()} /></UiAdaptersProvider>);
    rendered.rerender(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={store({ id: "tenant-b", storeName: "متجر تعز", capabilities: catalogOnly })} section="overview" {...callbacks()} /></UiAdaptersProvider>);

    const publishedLabel = await screen.findByText("المنتجات المنشورة");
    const publishedMetric = publishedLabel.closest("div");
    expect(publishedMetric).not.toBeNull();
    await waitFor(() => expect(within(publishedMetric!).getByText("1")).toBeTruthy());
    resolveFirst(dashboardSnapshot({ metrics: { ...dashboardSnapshot().metrics, publishedProducts: 2 } }));
    await Promise.resolve();
    expect(within(publishedMetric!).queryByText("2")).toBeNull();
  });
});
