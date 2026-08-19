// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminAuthModal from "./AdminAuthModal";
import AuthGateway from "./AuthGateway";
import DomainSetupModal from "./DomainSetupModal";
import ServerPricingPlans from "./ServerPricingPlans";
import { UiAdaptersProvider } from "../adapters/UiAdaptersContext";
import type { StorePlan, UiAdapters, UserProfile } from "../adapters/uiAdapters";
import { createFakeUiAdapters } from "../adapters/testing/fakeUiAdapters";

const merchant: UserProfile = {
  id: "01MERCHANT",
  fullName: "تاجر تجريبي",
  email: "merchant@example.com",
  phone: "+967700000000",
  role: "merchant",
  platformRoles: [],
  platformPermissions: [],
};

const starterPlan: StorePlan = {
  key: "starter",
  name: "البداية",
  priceMinor: 0,
  currency: "YER",
  billingInterval: "monthly",
  activationMode: "automatic",
  maxStores: 1,
  maxProducts: 10,
  features: ["platform_subdomain"],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderInterface(node: React.ReactElement, adapters: UiAdapters) {
  return render(<UiAdaptersProvider adapters={adapters}>{node}</UiAdaptersProvider>);
}

describe("current interface behavior", () => {
  it("logs a merchant in once and returns the existing UI profile", async () => {
    const login = vi.fn().mockResolvedValue(merchant);
    const onLoginSuccess = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderInterface(
      <AuthGateway
        isOpen
        initialMode="login"
        currentUser={null}
        onClose={onClose}
        onLoginSuccess={onLoginSuccess}
        onLogout={vi.fn()}
        onStartStoreCreation={vi.fn()}
      />,
      createFakeUiAdapters({ auth: { login } }),
    );

    await user.type(screen.getByPlaceholderText("name@company.com"), merchant.email);
    await user.type(screen.getByPlaceholderText("••••••••"), "very-secure-password");
    await user.click(screen.getByRole("button", { name: /تسجيل الدخول للحساب/ }));

    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
    expect(login).toHaveBeenCalledWith(merchant.email, "very-secure-password");
    expect(onLoginSuccess).toHaveBeenCalledWith(expect.objectContaining({
      id: merchant.id,
      email: merchant.email,
      role: "merchant",
    }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ends an unauthorized platform session instead of opening administration", async () => {
    const login = vi.fn().mockResolvedValue({
      ...merchant,
      platformRoles: ["platform_reviewer"],
      platformPermissions: [],
    });
    const logout = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    renderInterface(
      <AdminAuthModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />,
      createFakeUiAdapters({ auth: { login, logout } }),
    );

    await user.type(screen.getByPlaceholderText("name@example.com"), merchant.email);
    await user.type(screen.getByPlaceholderText("••••••••"), "very-secure-password");
    await user.click(screen.getByRole("button", { name: /تسجيل دخول المسؤول/ }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText(/لا يملك صلاحية الدخول/)).toBeTruthy();
  });

  it("loads server plans, checks the handle and submits the current store once", async () => {
    const listPlans = vi.fn().mockResolvedValue([starterPlan]);
    const availability = vi.fn().mockResolvedValue({
      handle: "my-shop",
      domain: "my-shop.eoshop.local",
      available: true,
    });
    const submit = vi.fn().mockResolvedValue({
      data: {
        id: "01STORE",
        storeName: "متجري",
        businessType: "تجزئة",
        verificationStatus: "pending",
        provisioningStatus: "not_started",
        publicationStatus: "requested",
        reviewFeedback: null,
        capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true },
        internalDomain: null,
        requestedDomain: "my-shop.eoshop.local",
        plan: { key: "starter", name: "البداية", activationMode: "automatic" },
        subscriptionStatus: "active",
        publicationBlockers: [],
        createdAt: null,
      },
      meta: { replayed: false },
    });
    const onSubmitted = vi.fn();
    const user = userEvent.setup();

    renderInterface(
      <DomainSetupModal
        isOpen
        onClose={vi.fn()}
        storeName="متجري"
        businessType="تجزئة"
        themeStyle="elegant"
        config={{ storeName: "متجري" }}
        onSubmitted={onSubmitted}
      />,
      createFakeUiAdapters({
        plans: { list: listPlans, domainAvailability: availability },
        provisioning: { submit },
      }),
    );

    expect(await screen.findByText("البداية")).toBeTruthy();
    await user.type(screen.getByLabelText("عنوان المتجر داخل المنصة"), "my-shop");
    await waitFor(() => expect(availability).toHaveBeenCalledWith("my-shop", expect.any(AbortSignal)), { timeout: 1500 });
    expect(await screen.findByText(/my-shop\.eoshop\.local متاح/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "حجز العنوان وإرسال طلب المتجر" }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      storeName: "متجري",
      handle: "my-shop",
      planKey: "starter",
    }));
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it("retains the current server-pricing headings without a screen redesign", async () => {
    const listPlans = vi.fn().mockResolvedValue([starterPlan]);

    renderInterface(
      <ServerPricingPlans onStart={vi.fn()} />,
      createFakeUiAdapters({ plans: { list: listPlans } }),
    );

    expect(screen.getByRole("heading", { name: "الباقات والأسعار" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "البداية" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /ابدأ تصميم المتجر/ })).toBeTruthy();
  });

  it("ignores a stale domain response after the merchant changes the handle", async () => {
    const listPlans = vi.fn().mockResolvedValue([starterPlan]);
    let resolveFirst!: (value: { handle: string; domain: string; available: boolean }) => void;
    let resolveSecond!: (value: { handle: string; domain: string; available: boolean }) => void;
    const availability = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const user = userEvent.setup();

    renderInterface(
      <DomainSetupModal
        isOpen
        onClose={vi.fn()}
        storeName="متجري"
        businessType="تجزئة"
        themeStyle="elegant"
        config={{ storeName: "متجري" }}
      />,
      createFakeUiAdapters({
        plans: { list: listPlans, domainAvailability: availability },
      }),
    );

    const handleInput = screen.getByLabelText("عنوان المتجر داخل المنصة");
    await user.type(handleInput, "first-shop");
    await waitFor(() => expect(availability).toHaveBeenCalledTimes(1), { timeout: 1500 });
    await user.clear(handleInput);
    await user.type(handleInput, "second-shop");
    await waitFor(() => expect(availability).toHaveBeenCalledTimes(2), { timeout: 1500 });

    resolveSecond({ handle: "second-shop", domain: "second-shop.eoshop.local", available: true });
    expect(await screen.findByText(/second-shop\.eoshop\.local متاح/)).toBeTruthy();
    resolveFirst({ handle: "first-shop", domain: "first-shop.eoshop.local", available: true });

    await waitFor(() => expect(screen.queryByText(/first-shop\.eoshop\.local متاح/)).toBeNull());
    expect(screen.getByText(/second-shop\.eoshop\.local متاح/)).toBeTruthy();
  });
});
