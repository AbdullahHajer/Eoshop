// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoreSubmission, UserProfile } from "../../adapters/uiAdapters";
import MerchantPortal from "./MerchantPortal";

const user: UserProfile = {
  id: "user-1",
  fullName: "تاجر تجريبي",
  email: "merchant@example.test",
  phone: "",
  role: "merchant",
  platformRoles: [],
  platformPermissions: [],
};

function store(overrides: Partial<StoreSubmission> = {}): StoreSubmission {
  return {
    id: "tenant-1",
    storeName: "متجر صنعاء",
    businessType: "تجزئة",
    verificationStatus: "pending",
    provisioningStatus: "not_started",
    publicationStatus: "requested",
    reviewFeedback: null,
    capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: false },
    internalDomain: "store-tenant-1.eoshop.local",
    requestedDomain: "sanaa.eoshop.local",
    publicDomain: null,
    plan: { key: "starter", name: "البداية", activationMode: "automatic" },
    subscriptionStatus: "active",
    publicationBlockers: ["review_not_approved", "provisioning_not_ready"],
    createdAt: null,
    activeAt: null,
    publishedAt: null,
    ...overrides,
  };
}

function props(stores: StoreSubmission[]) {
  return {
    user,
    stores,
    loading: false,
    error: null,
    onReload: vi.fn(),
    onCreateStore: vi.fn(),
    onOpenBuilder: vi.fn(),
    onCorrectStore: vi.fn(),
    onPublish: vi.fn(async () => undefined),
    onUnpublish: vi.fn(async () => undefined),
    onLogout: vi.fn(),
    onCopyPublicUrl: vi.fn(),
  };
}

afterEach(() => cleanup());

describe("MerchantPortal", () => {
  it("shows a durable empty state and starts the creation journey", async () => {
    const callbacks = props([]);
    render(<MerchantPortal {...callbacks} />);
    expect(screen.getByRole("heading", { name: "ابدأ متجرك الأول" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "إنشاء متجر" }));
    expect(callbacks.onCreateStore).toHaveBeenCalledOnce();
  });

  it("shows a safe rejection reason with the server-authorized correction action", async () => {
    const rejected = store({ verificationStatus: "rejected", reviewFeedback: "أكمل رقم التواصل الصحيح", capabilities: { workspaceManage: false, catalogManage: false, inventoryView: false, inventoryManage: false, ordersView: false, ordersManage: false, draftEdit: true, resubmit: true, publish: false, unpublish: false } });
    const callbacks = props([rejected]);
    render(<MerchantPortal {...callbacks} />);
    expect(screen.getAllByText("أكمل رقم التواصل الصحيح").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "إدارة المتجر" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "تصحيح الطلب" }));
    expect(callbacks.onCorrectStore).toHaveBeenCalledWith(rejected);
  });

  it("opens the builder for a ready store", async () => {
    const ready = store({
      verificationStatus: "approved",
      provisioningStatus: "active",
      publicationBlockers: [],
    });
    const callbacks = props([ready]);
    render(<MerchantPortal {...callbacks} />);
    await userEvent.click(screen.getByRole("button", { name: "إدارة المتجر" }));
    expect(callbacks.onOpenBuilder).toHaveBeenCalledWith(ready);
  });

  it("shows staff module capabilities without exposing the full workspace editor", () => {
    const staffStore = store({
      verificationStatus: "approved",
      provisioningStatus: "active",
      capabilities: { workspaceManage: false, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: false },
    });
    render(<MerchantPortal {...props([staffStore])} />);

    expect(screen.getByText("غير متاح: إعدادات وتصميم المتجر")).toBeTruthy();
    expect(screen.getByText("متاح: المنتجات")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "إدارة المتجر" })).toBeNull();
  });

  it("switches between stores without inventing lifecycle actions", async () => {
    const pending = store();
    const failed = store({ id: "tenant-2", storeName: "متجر تعز", verificationStatus: "approved", provisioningStatus: "failed" });
    render(<MerchantPortal {...props([pending, failed])} />);

    await userEvent.click(screen.getByRole("button", { name: /متجر تعز/ }));

    expect(screen.getByRole("heading", { name: "توقف تجهيز المتجر بأمان" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "إدارة المتجر" })).toBeNull();
  });

  it("shows copy and open actions only for a server-confirmed public domain", async () => {
    const published = store({
      verificationStatus: "approved",
      provisioningStatus: "active",
      publicationStatus: "published",
      publicDomain: "sanaa.lvh.me",
      publicationBlockers: [],
      publishedAt: "2026-08-19T10:00:00Z",
    });
    const callbacks = props([published]);
    render(<MerchantPortal {...callbacks} />);
    const open = screen.getByRole("link", { name: "فتح" });
    expect(open.getAttribute("href")).toContain("sanaa.lvh.me");
    await userEvent.click(screen.getByRole("button", { name: "نسخ" }));
    expect(callbacks.onCopyPublicUrl).toHaveBeenCalledWith(expect.stringContaining("sanaa.lvh.me"));
  });

  it("exposes only the server-authorized merchant publication transition", async () => {
    const ready = store({
      verificationStatus: "approved",
      provisioningStatus: "active",
      publicationBlockers: [],
      capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: true, unpublish: false },
    });
    const callbacks = props([ready]);
    const { rerender } = render(<MerchantPortal {...callbacks} />);

    await userEvent.click(screen.getByRole("button", { name: "نشر المتجر" }));
    expect(callbacks.onPublish).toHaveBeenCalledWith(ready);
    expect(screen.queryByRole("button", { name: "إلغاء النشر" })).toBeNull();

    const published = store({
      ...ready,
      publicationStatus: "published",
      publicDomain: "sanaa.lvh.me",
      capabilities: { ...ready.capabilities, publish: false, unpublish: true },
    });
    rerender(<MerchantPortal {...callbacks} stores={[published]} />);
    await userEvent.click(screen.getByRole("button", { name: "إلغاء النشر" }));
    expect(callbacks.onUnpublish).toHaveBeenCalledWith(published);
    expect(screen.queryByRole("button", { name: "نشر المتجر" })).toBeNull();
  });
});
