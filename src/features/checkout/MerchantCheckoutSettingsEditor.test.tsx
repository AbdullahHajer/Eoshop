// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET } from "../../types";
import MerchantCheckoutSettingsEditor from "./MerchantCheckoutSettingsEditor";

const paymentApi = {
  load: vi.fn(),
  configure: vi.fn(),
};

afterEach(() => {
  cleanup();
  paymentApi.load.mockReset();
  paymentApi.configure.mockReset();
  vi.unstubAllGlobals();
});

describe("MerchantCheckoutSettingsEditor", () => {
  it("emits controlled operational changes and exposes no unsupported gateway switch", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MerchantCheckoutSettingsEditor config={{ ...ELEGANT_PRESET, enableCoupons: true }} paymentConnections={paymentApi} onChange={onChange} />);
    await user.click(screen.getByRole("switch", { name: "التحويل البنكي" }));
    expect(onChange).toHaveBeenCalledWith("enableBankTransfer", true);
    expect(screen.getByRole("spinbutton", { name: "نسبة الخصم الجديدة" }).getAttribute("step")).toBe("0.01");
    expect(screen.queryByRole("switch", { name: /Apple Pay|STC Pay|بطاقات/ })).toBeNull();
    expect(screen.getByText(/غير متاح حتى يتم ربط بوابة دفع حقيقية/)).toBeTruthy();
  });

  it("adds a canonical immutable wallet identifier", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MerchantCheckoutSettingsEditor config={{ ...ELEGANT_PRESET, enableEWallets: true }} paymentConnections={paymentApi} onChange={onChange} />);
    await user.type(screen.getByRole("textbox", { name: "اسم المحفظة الجديدة" }), "محفظتي");
    await user.type(screen.getByRole("textbox", { name: "رقم حساب المحفظة الجديدة" }), "999888777");
    await user.type(screen.getByRole("textbox", { name: "اسم مستفيد المحفظة الجديدة" }), "مالك المتجر");
    await user.click(screen.getByRole("button", { name: /إضافة محفظة/ }));
    expect(onChange).toHaveBeenCalledWith("customWallets", [expect.objectContaining({ id: "wallet-11111111-1111-4111-8111-111111111111", active: true })]);
    vi.unstubAllGlobals();
  });

  it("keeps BasGate credential saving outside StoreConfig changes", async () => {
    paymentApi.load.mockResolvedValue({
      provider: "basgate",
      environment: null,
      state: "unconfigured",
      revision: 0,
      canAcceptOnlinePayments: false,
      lastVerificationCode: null,
      lastVerifiedAt: null,
      updatedAt: null,
    });
    paymentApi.configure.mockResolvedValue({
      provider: "basgate",
      environment: "sandbox",
      state: "draft",
      revision: 1,
      canAcceptOnlinePayments: false,
      lastVerificationCode: null,
      lastVerifiedAt: null,
      updatedAt: "2026-09-07T12:00:00Z",
    });
    vi.stubGlobal("crypto", { randomUUID: () => "33333333-3333-4333-8333-333333333333" });
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<MerchantCheckoutSettingsEditor config={ELEGANT_PRESET} activeTenantId="tenant-a" paymentConnections={paymentApi} onChange={onChange} />);
    await screen.findByText("غير مهيأ");

    await user.type(screen.getByLabelText("App ID"), "11111111-1111-4111-8111-111111111111");
    await user.type(screen.getByLabelText("Merchant Key"), "merchant-key");
    await user.type(screen.getByLabelText("Client ID"), "22222222-2222-4222-8222-222222222222");
    await user.type(screen.getByLabelText("Client Secret"), "client-secret");
    await user.click(screen.getByRole("button", { name: "حفظ بيانات الربط" }));

    await waitFor(() => expect(paymentApi.configure).toHaveBeenCalledTimes(1));
    expect(onChange).not.toHaveBeenCalled();
  });
});
