// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminAuthModal from "./AdminAuthModal";
import AuthGateway from "./AuthGateway";
import DomainSetupModal from "./DomainSetupModal";
import ServerPricingPlans from "./ServerPricingPlans";
import { authApi, type AuthenticatedUser } from "../services/authApi";
import { plansApi, type StorePlan } from "../services/plansApi";
import { provisioningApi } from "../services/provisioningApi";

const merchant: AuthenticatedUser = {
  id: "01MERCHANT",
  name: "تاجر تجريبي",
  email: "merchant@example.com",
  phone: "+967700000000",
  status: "active",
  emailVerifiedAt: null,
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

describe("current interface behavior", () => {
  it("logs a merchant in once and returns the existing UI profile", async () => {
    const login = vi.spyOn(authApi, "login").mockResolvedValue(merchant);
    const onLoginSuccess = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <AuthGateway
        isOpen
        initialMode="login"
        currentUser={null}
        onClose={onClose}
        onLoginSuccess={onLoginSuccess}
        onLogout={vi.fn()}
        onStartStoreCreation={vi.fn()}
      />,
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
    vi.spyOn(authApi, "login").mockResolvedValue({
      ...merchant,
      platformRoles: ["platform_reviewer"],
      platformPermissions: [],
    });
    const logout = vi.spyOn(authApi, "logout").mockResolvedValue();
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    render(<AdminAuthModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />);

    await user.type(screen.getByPlaceholderText("name@example.com"), merchant.email);
    await user.type(screen.getByPlaceholderText("••••••••"), "very-secure-password");
    await user.click(screen.getByRole("button", { name: /تسجيل دخول المسؤول/ }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByText(/لا يملك صلاحية الدخول/)).toBeTruthy();
  });

  it("loads server plans, checks the handle and submits the current store once", async () => {
    vi.spyOn(plansApi, "list").mockResolvedValue([starterPlan]);
    const availability = vi.spyOn(plansApi, "domainAvailability").mockResolvedValue({
      handle: "my-shop",
      domain: "my-shop.eoshop.local",
      available: true,
    });
    const submit = vi.spyOn(provisioningApi, "submit").mockResolvedValue({
      data: {
        id: "01STORE",
        storeName: "متجري",
        businessType: "تجزئة",
        verificationStatus: "pending",
        provisioningStatus: "not_started",
        publicationStatus: "requested",
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

    render(
      <DomainSetupModal
        isOpen
        onClose={vi.fn()}
        storeName="متجري"
        businessType="تجزئة"
        themeStyle="elegant"
        config={{ storeName: "متجري" }}
        onSubmitted={onSubmitted}
      />,
    );

    expect(await screen.findByText("البداية")).toBeTruthy();
    await user.type(screen.getByLabelText("عنوان المتجر داخل المنصة"), "my-shop");
    await waitFor(() => expect(availability).toHaveBeenCalledWith("my-shop"), { timeout: 1500 });
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
    vi.spyOn(plansApi, "list").mockResolvedValue([starterPlan]);

    render(<ServerPricingPlans onStart={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "الباقات والأسعار" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "البداية" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /ابدأ تصميم المتجر/ })).toBeTruthy();
  });
});
