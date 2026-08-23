// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import type { StoreSubmission, UserProfile } from "../../adapters/uiAdapters";
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

function callbacks() {
  return { onBack: vi.fn(), onNavigate: vi.fn(), onOpenBuilder: vi.fn(), onPublish: vi.fn(async () => undefined), onUnpublish: vi.fn(async () => undefined), onCopyPublicUrl: vi.fn(), onLogout: vi.fn(), onSessionExpired: vi.fn() };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("MerchantStoreOperations", () => {
  it("loads independent server-owned overview snapshots", async () => {
    const adapters = createFakeUiAdapters({
      catalog: { load: vi.fn(async () => ({ tenantId: "tenant-a", revision: 2, currencyCode: "YER", products: [{ id: "p1", name: "منتج", price: 10, status: "published" as const, description: "", category: "", imageKeyword: "default" }] })) },
      orders: { list: vi.fn(async () => ({ items: [], total: 4 })) },
      inventory: { load: vi.fn(async () => [{ productId: "p1", onHand: 2, reserved: 1, available: 1, manageStock: true, lowStockThreshold: 2, inventoryRevision: 1 }]) },
    });
    render(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={store()} section="overview" {...callbacks()} /></UiAdaptersProvider>);

    await waitFor(() => expect(screen.getByText("4")).toBeTruthy());
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("المنتجات الفعالة")).toBeTruthy();
  });

  it("keeps a catalog-only staff member inside the read module without opening the builder", async () => {
    const onNavigate = vi.fn();
    const onOpenBuilder = vi.fn();
    const staffStore = store({ capabilities: { workspaceManage: false, catalogManage: true, inventoryView: false, inventoryManage: false, ordersView: false, ordersManage: false, draftEdit: false, resubmit: false, publish: false, unpublish: false } });
    const adapters = createFakeUiAdapters({ catalog: { load: vi.fn(async () => ({ tenantId: "tenant-a", revision: 1, currencyCode: "YER", products: [] })) } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={staffStore} section="overview" {...callbacks()} onNavigate={onNavigate} onOpenBuilder={onOpenBuilder} /></UiAdaptersProvider>);

    await userEvent.click(screen.getAllByRole("button", { name: /المنتجات/ })[0]);
    expect(onNavigate).toHaveBeenCalledWith("products");
    expect(onOpenBuilder).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "التصميم والهوية" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not request operational data for an unknown store", () => {
    const catalogLoad = vi.fn();
    const adapters = createFakeUiAdapters({ catalog: { load: catalogLoad } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={null} section="overview" {...callbacks()} /></UiAdaptersProvider>);
    expect(screen.getByRole("heading", { name: "المتجر غير متاح لهذا الحساب" })).toBeTruthy();
    expect(catalogLoad).not.toHaveBeenCalled();
  });

  it("keeps denied overview facts unavailable instead of inventing zero values", async () => {
    const ordersList = vi.fn();
    const inventoryLoad = vi.fn();
    const adapters = createFakeUiAdapters({
      catalog: { load: vi.fn(async () => ({ tenantId: "tenant-a", revision: 1, currencyCode: "YER", products: [] })) },
      orders: { list: ordersList },
      inventory: { load: inventoryLoad },
    });
    const deniedStore = store({ capabilities: { workspaceManage: false, catalogManage: false, inventoryView: false, inventoryManage: false, ordersView: false, ordersManage: false, draftEdit: false, resubmit: false, publish: false, unpublish: false } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={deniedStore} section="overview" {...callbacks()} /></UiAdaptersProvider>);

    await waitFor(() => expect(screen.getAllByText("غير متاح لصلاحيات الحساب")).toHaveLength(2));
    expect(ordersList).not.toHaveBeenCalled();
    expect(inventoryLoad).not.toHaveBeenCalled();
  });

  it("expires the local merchant context when an operations request returns 401", async () => {
    const onSessionExpired = vi.fn();
    const adapters = createFakeUiAdapters({
      catalog: { load: vi.fn(async () => { throw new UiAdapterError("انتهت الجلسة", "unauthenticated"); }) },
      orders: { list: vi.fn(async () => ({ items: [], total: 0 })) },
      inventory: { load: vi.fn(async () => []) },
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
    let resolveFirst!: (value: Awaited<ReturnType<ReturnType<typeof createFakeUiAdapters>["catalog"]["load"]>>) => void;
    const first = new Promise<Awaited<ReturnType<ReturnType<typeof createFakeUiAdapters>["catalog"]["load"]>>>((resolve) => { resolveFirst = resolve; });
    const catalogLoad = vi.fn((tenantId: string) => tenantId === "tenant-a"
      ? first
      : Promise.resolve({ tenantId: "tenant-b", revision: 1, currencyCode: "YER", products: [{ id: "b", name: "B", price: 1, status: "published" as const, description: "", category: "", imageKeyword: "default" }] }));
    const adapters = createFakeUiAdapters({ catalog: { load: catalogLoad } });
    const restricted = { workspaceManage: false, catalogManage: false, inventoryView: false, inventoryManage: false, ordersView: false, ordersManage: false, draftEdit: false, resubmit: false, publish: false, unpublish: false };
    const rendered = render(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={store({ capabilities: restricted })} section="overview" {...callbacks()} /></UiAdaptersProvider>);
    rendered.rerender(<UiAdaptersProvider adapters={adapters}><MerchantStoreOperations user={user} store={store({ id: "tenant-b", storeName: "متجر تعز", capabilities: restricted })} section="overview" {...callbacks()} /></UiAdaptersProvider>);

    await waitFor(() => expect(screen.getByText("1")).toBeTruthy());
    resolveFirst({ tenantId: "tenant-a", revision: 1, currencyCode: "YER", products: [
      { id: "a1", name: "A1", price: 1, status: "published", description: "", category: "", imageKeyword: "default" },
      { id: "a2", name: "A2", price: 1, status: "published", description: "", category: "", imageKeyword: "default" },
    ] });
    await Promise.resolve();
    expect(screen.queryByText("2")).toBeNull();
  });
});
