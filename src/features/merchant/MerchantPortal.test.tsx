// @vitest-environment jsdom

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoreDraft, StoreSubmission, UserProfile } from "../../adapters/uiAdapters";
import { ELEGANT_PRESET } from "../../types";
import MerchantPortal from "./MerchantPortal";

const user: UserProfile = {
  id: "user-1",
  fullName: "تاجر تجريبي",
  email: "merchant@example.test",
  phone: "",
  profileRevision: 1,
  createdAt: null,
  updatedAt: null,
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
    draft: null as StoreDraft | null,
    draftLoading: false,
    draftError: null as string | null,
    loading: false,
    error: null,
    onReload: vi.fn(),
    onCreateStore: vi.fn(),
    onOpenStore: vi.fn(),
    onCorrectStore: vi.fn(),
    onPublish: vi.fn(async () => undefined),
    onUnpublish: vi.fn(async () => undefined),
    onLogout: vi.fn(),
    onCopyPublicUrl: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("MerchantPortal", () => {
  it("refreshes pending lifecycle state automatically and stops once the store is ready", async () => {
    vi.useFakeTimers();
    const callbacks = props([store()]);
    const view = render(<MerchantPortal {...callbacks} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(callbacks.onReload).toHaveBeenCalledTimes(1);

    view.rerender(<MerchantPortal
      {...callbacks}
      stores={[store({ verificationStatus: "approved", provisioningStatus: "active", publicationBlockers: [] })]}
    />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(callbacks.onReload).toHaveBeenCalledTimes(1);
  });

  it("exposes a keyboard skip target and compact narrow-screen navigation", () => {
    render(<MerchantPortal {...props([])} />);

    expect(screen.getByRole("link", { name: "تجاوز التنقل والانتقال إلى المحتوى الرئيسي" }).getAttribute("href")).toBe("#merchant-portal-main");
    expect(document.getElementById("merchant-portal-main")?.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("navigation", { name: "تنقل بوابة التاجر" }).className).toContain("overflow-x-auto");
    expect(screen.getByText("نظرة عامة").getAttribute("aria-current")).toBe("page");
  });

  it("shows a durable empty state and starts the creation journey", async () => {
    const callbacks = props([]);
    render(<MerchantPortal {...callbacks} />);
    expect(screen.getByRole("heading", { name: "ابدأ متجرك الأول" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "إنشاء متجر" }));
    expect(callbacks.onCreateStore).toHaveBeenCalledOnce();
  });

  it("shows the authoritative unfinished draft and resumes it instead of claiming the account is empty", async () => {
    const callbacks = props([]);
    callbacks.draft = {
      id: "draft-1",
      tenantId: null,
      status: "draft",
      revision: 2,
      onboardingStage: "design",
      onboardingReadiness: { business: true, design: true, review: false, blockers: ["domain_unavailable"] },
      nextRequiredStep: "review",
      storeName: "متجر قيد الإنشاء",
      businessType: "تجزئة",
      themeStyle: "elegant",
      handle: null,
      planKey: null,
      config: ELEGANT_PRESET,
      savedAt: "2026-08-24T14:28:46Z",
      submittedAt: null,
    };

    render(<MerchantPortal {...callbacks} />);

    expect(screen.getByRole("heading", { name: "متجر قيد الإنشاء" })).toBeTruthy();
    expect(screen.getByText("مسودة محفوظة — لم تُرسل للمراجعة")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "ابدأ متجرك الأول" })).toBeNull();
    await userEvent.click(screen.getAllByRole("button", { name: /متابعة إنشاء المتجر/ }).at(-1)!);
    expect(callbacks.onCreateStore).toHaveBeenCalledOnce();
  });

  it("does not claim there is no draft when draft recovery fails independently", async () => {
    const callbacks = props([]);
    callbacks.draftError = "انقطع الاتصال أثناء قراءة المسودة.";

    render(<MerchantPortal {...callbacks} />);

    expect(screen.getByRole("alert").textContent).toContain("تعذر التحقق من المسودة المحفوظة");
    expect(screen.queryByRole("heading", { name: "ابدأ متجرك الأول" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(callbacks.onReload).toHaveBeenCalledOnce();
  });

  it("shows a safe rejection reason with the server-authorized correction action", async () => {
    const rejected = store({ verificationStatus: "rejected", reviewFeedback: "أكمل رقم التواصل الصحيح", capabilities: { workspaceManage: false, catalogManage: false, inventoryView: false, inventoryManage: false, ordersView: false, ordersManage: false, draftEdit: true, resubmit: true, publish: false, unpublish: false } });
    const callbacks = props([rejected]);
    render(<MerchantPortal {...callbacks} />);
    expect(screen.getAllByText("أكمل رقم التواصل الصحيح").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "فتح مركز المتجر" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "تصحيح الطلب" }));
    expect(callbacks.onCorrectStore).toHaveBeenCalledWith(rejected);
  });

  it("opens the operations center for a ready store", async () => {
    const ready = store({
      verificationStatus: "approved",
      provisioningStatus: "active",
      publicationBlockers: [],
    });
    const callbacks = props([ready]);
    render(<MerchantPortal {...callbacks} />);
    await userEvent.click(screen.getByRole("button", { name: "فتح مركز المتجر" }));
    expect(callbacks.onOpenStore).toHaveBeenCalledWith(ready);
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
    expect(screen.getByRole("button", { name: "فتح مركز المتجر" })).toBeTruthy();
  });

  it("switches between stores without inventing lifecycle actions", async () => {
    const pending = store();
    const failed = store({ id: "tenant-2", storeName: "متجر تعز", verificationStatus: "approved", provisioningStatus: "failed" });
    render(<MerchantPortal {...props([pending, failed])} />);

    await userEvent.click(screen.getByRole("button", { name: /متجر تعز/ }));

    expect(screen.getByRole("heading", { name: "توقف تجهيز المتجر بأمان" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "فتح مركز المتجر" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "نشر المتجر" })).toBeNull();
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
