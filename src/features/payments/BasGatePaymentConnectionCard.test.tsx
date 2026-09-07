// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaymentConnection } from "../../contracts/paymentConnection";
import { ApiError } from "../../services/apiClient";
import BasGatePaymentConnectionCard from "./BasGatePaymentConnectionCard";

const paymentApi = {
  load: vi.fn(),
  configure: vi.fn(),
};

const unconfigured = {
  provider: "basgate" as const,
  environment: null,
  state: "unconfigured" as const,
  revision: 0,
  canAcceptOnlinePayments: false,
  lastVerificationCode: null,
  lastVerifiedAt: null,
  updatedAt: null,
};

const draft: PaymentConnection = {
  ...unconfigured,
  environment: "sandbox" as const,
  state: "draft" as const,
  revision: 1,
  updatedAt: "2026-09-07T12:00:00Z",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function fillCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("App ID"), "11111111-1111-4111-8111-111111111111");
  await user.type(screen.getByLabelText("Merchant Key"), "merchant-key");
  await user.type(screen.getByLabelText("Client ID"), "22222222-2222-4222-8222-222222222222");
  await user.type(screen.getByLabelText("Client Secret"), "client-secret");
}

afterEach(() => {
  cleanup();
  paymentApi.load.mockReset();
  paymentApi.configure.mockReset();
  vi.unstubAllGlobals();
});

describe("BasGatePaymentConnectionCard", () => {
  it("saves through the independent API and clears every write-only field after success", async () => {
    paymentApi.load.mockResolvedValue(unconfigured);
    paymentApi.configure.mockResolvedValue(draft);
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    const user = userEvent.setup();

    render(<BasGatePaymentConnectionCard activeTenantId="tenant-a" paymentConnections={paymentApi} />);
    await screen.findByText("غير مهيأ");
    await fillCredentials(user);
    await user.click(screen.getByRole("button", { name: "حفظ بيانات الربط" }));

    await waitFor(() => expect(paymentApi.configure).toHaveBeenCalledWith(
      "tenant-a",
      {
        environment: "sandbox",
        expectedRevision: 0,
        credentials: {
          appId: "11111111-1111-4111-8111-111111111111",
          merchantKey: "merchant-key",
          clientId: "22222222-2222-4222-8222-222222222222",
          clientSecret: "client-secret",
        },
      },
      "11111111-1111-4111-8111-111111111111",
      expect.any(AbortSignal),
    ));
    expect(await screen.findByText(/تم حفظ بيانات الربط بصورة آمنة/)).toBeTruthy();
    for (const label of ["App ID", "Merchant Key", "Client ID", "Client Secret"]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
    }
    expect(document.body.textContent).not.toContain("client-secret");
  });

  it("accepts the general UUID shape used by the backend, including UUID v7", async () => {
    paymentApi.load.mockResolvedValue(unconfigured);
    paymentApi.configure.mockResolvedValue(draft);
    const user = userEvent.setup();

    render(<BasGatePaymentConnectionCard activeTenantId="tenant-a" paymentConnections={paymentApi} />);
    await screen.findByText("غير مهيأ");
    await user.type(screen.getByLabelText("App ID"), "0199aabc-7def-7000-8000-0123456789ab");
    await user.type(screen.getByLabelText("Merchant Key"), "merchant-key");
    await user.type(screen.getByLabelText("Client ID"), "0199aabd-7def-7000-8000-0123456789ab");
    await user.type(screen.getByLabelText("Client Secret"), "client-secret");
    await user.click(screen.getByRole("button", { name: "حفظ بيانات الربط" }));

    await waitFor(() => expect(paymentApi.configure).toHaveBeenCalledOnce());
    expect(paymentApi.configure.mock.calls[0][1].credentials.appId).toBe("0199aabc-7def-7000-8000-0123456789ab");
    expect(paymentApi.configure.mock.calls[0][1].credentials.clientId).toBe("0199aabd-7def-7000-8000-0123456789ab");
  });

  it("matches backend credential limits and clears client-side validation failures", async () => {
    paymentApi.load.mockResolvedValue(unconfigured);
    const user = userEvent.setup();

    render(<BasGatePaymentConnectionCard activeTenantId="tenant-a" paymentConnections={paymentApi} />);
    await screen.findByText("غير مهيأ");
    const appId = screen.getByLabelText("App ID") as HTMLInputElement;
    const merchantKey = screen.getByLabelText("Merchant Key") as HTMLInputElement;
    const clientId = screen.getByLabelText("Client ID") as HTMLInputElement;
    const clientSecret = screen.getByLabelText("Client Secret") as HTMLInputElement;
    expect(appId.maxLength).toBe(36);
    expect(clientId.maxLength).toBe(36);
    expect(merchantKey.minLength).toBe(8);
    expect(merchantKey.maxLength).toBe(512);
    expect(clientSecret.minLength).toBe(8);
    expect(clientSecret.maxLength).toBe(512);
    for (const field of [appId, merchantKey, clientId, clientSecret]) {
      expect(field.autocomplete).toBe("new-password");
    }

    await user.type(appId, "not-a-uuid");
    await user.type(merchantKey, "merchant-key");
    await user.type(clientId, "22222222-2222-4222-8222-222222222222");
    await user.type(clientSecret, "client-secret");
    await user.click(screen.getByRole("button", { name: "حفظ بيانات الربط" }));

    expect(await screen.findByText(/بصيغة UUID صحيحة/)).toBeTruthy();
    expect(paymentApi.configure).not.toHaveBeenCalled();
    for (const field of [appId, merchantKey, clientId, clientSecret]) expect(field.value).toBe("");

    await user.type(appId, "11111111-1111-4111-8111-111111111111");
    await user.type(merchantKey, "1234567");
    await user.type(clientId, "22222222-2222-4222-8222-222222222222");
    await user.type(clientSecret, "client-secret");
    await user.click(screen.getByRole("button", { name: "حفظ بيانات الربط" }));

    expect(await screen.findByText(/8 إلى 512/)).toBeTruthy();
    expect(paymentApi.configure).not.toHaveBeenCalled();
    for (const field of [appId, merchantKey, clientId, clientSecret]) expect(field.value).toBe("");
  });

  it.each([
    ["zero-width character", `merchant\u200Bkey`],
    ["non-breaking space", `\u00A0merchant-key`],
  ])("rejects a Unicode %s in opaque credentials", async (_label, invalidSecret) => {
    paymentApi.load.mockResolvedValue(unconfigured);
    const user = userEvent.setup();

    render(<BasGatePaymentConnectionCard activeTenantId="tenant-a" paymentConnections={paymentApi} />);
    await screen.findByText("غير مهيأ");
    await user.type(screen.getByLabelText("App ID"), "11111111-1111-4111-8111-111111111111");
    await user.type(screen.getByLabelText("Merchant Key"), invalidSecret);
    await user.type(screen.getByLabelText("Client ID"), "22222222-2222-4222-8222-222222222222");
    await user.type(screen.getByLabelText("Client Secret"), "client-secret");
    await user.click(screen.getByRole("button", { name: "حفظ بيانات الربط" }));

    expect(await screen.findByText(/مسافات أو محارف غير مرئية/)).toBeTruthy();
    expect(paymentApi.configure).not.toHaveBeenCalled();
    for (const label of ["App ID", "Merchant Key", "Client ID", "Client Secret"]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
    }
  });

  it("clears secrets and explains a revision conflict without claiming a save", async () => {
    paymentApi.load.mockResolvedValue(unconfigured);
    paymentApi.configure.mockRejectedValue(new ApiError("raw conflict", "conflict", 409, {}, null, null, false, { code: "payment_connection_revision_conflict" }));
    vi.stubGlobal("crypto", { randomUUID: () => "22222222-2222-4222-8222-222222222222" });
    const user = userEvent.setup();

    render(<BasGatePaymentConnectionCard activeTenantId="tenant-a" paymentConnections={paymentApi} />);
    await screen.findByText("غير مهيأ");
    await fillCredentials(user);
    await user.click(screen.getByRole("button", { name: "حفظ بيانات الربط" }));

    expect(await screen.findByText(/تغيّرت حالة الربط في جلسة أخرى/)).toBeTruthy();
    expect(screen.queryByText(/تم حفظ بيانات الربط بصورة آمنة/)).toBeNull();
    for (const label of ["App ID", "Merchant Key", "Client ID", "Client Secret"]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
    }
    expect(document.body.textContent).not.toContain("client-secret");
  });

  it.each([
    ["unauthenticated", 401, "انتهت جلسة الدخول"],
    ["forbidden", 403, "لا تملك صلاحية إدارة ربط الدفع"],
  ] as const)("renders a safe %s load failure", async (category, status, message) => {
    paymentApi.load.mockRejectedValue(new ApiError("provider details", category, status));

    render(<BasGatePaymentConnectionCard activeTenantId="tenant-a" paymentConnections={paymentApi} />);

    expect(await screen.findByText(new RegExp(message))).toBeTruthy();
    expect(screen.queryByText("provider details")).toBeNull();
  });

  it("retries a failed redacted load", async () => {
    paymentApi.load
      .mockRejectedValueOnce(new ApiError("offline", "network", null))
      .mockResolvedValueOnce(unconfigured);
    const user = userEvent.setup();

    render(<BasGatePaymentConnectionCard activeTenantId="tenant-a" paymentConnections={paymentApi} />);
    await screen.findByText(/تعذر تحميل حالة ربط BasGate/);
    await user.click(screen.getByRole("button", { name: /تحديث الحالة/ }));

    expect(await screen.findByText("غير مهيأ")).toBeTruthy();
    expect(paymentApi.load).toHaveBeenCalledTimes(2);
  });

  it("reuses one idempotency key for an ambiguous save retry while clearing the form", async () => {
    paymentApi.load.mockResolvedValue(unconfigured);
    paymentApi.configure
      .mockRejectedValueOnce(new ApiError("offline", "network", null))
      .mockResolvedValueOnce(draft);
    vi.stubGlobal("crypto", { randomUUID: () => "44444444-4444-4444-8444-444444444444" });
    const user = userEvent.setup();

    render(<BasGatePaymentConnectionCard activeTenantId="tenant-a" paymentConnections={paymentApi} />);
    await screen.findByText("غير مهيأ");
    await fillCredentials(user);
    await user.click(screen.getByRole("button", { name: "حفظ بيانات الربط" }));
    await screen.findByText(/تعذر تأكيد حفظ بيانات الربط/);
    for (const label of ["App ID", "Merchant Key", "Client ID", "Client Secret"]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
    }
    await waitFor(() => expect((screen.getByRole("button", { name: "حفظ بيانات الربط" }) as HTMLButtonElement).disabled).toBe(false));

    await fillCredentials(user);
    expect((screen.getByLabelText("App ID") as HTMLInputElement).value).toBe("11111111-1111-4111-8111-111111111111");
    expect((screen.getByLabelText("Client ID") as HTMLInputElement).value).toBe("22222222-2222-4222-8222-222222222222");
    await user.click(screen.getByRole("button", { name: "حفظ بيانات الربط" }));
    await screen.findByText(/تم حفظ بيانات الربط بصورة آمنة/);

    expect(paymentApi.configure).toHaveBeenCalledTimes(2);
    expect(paymentApi.configure.mock.calls[0][2]).toBe("44444444-4444-4444-8444-444444444444");
    expect(paymentApi.configure.mock.calls[1][2]).toBe("44444444-4444-4444-8444-444444444444");
  });

  it("aborts and ignores an old tenant response while clearing entered secrets", async () => {
    const tenantA = deferred<typeof draft>();
    const tenantB = deferred<typeof draft>();
    paymentApi.load.mockReturnValueOnce(tenantA.promise).mockReturnValueOnce(tenantB.promise);
    const user = userEvent.setup();
    const view = render(<BasGatePaymentConnectionCard activeTenantId="tenant-a" paymentConnections={paymentApi} />);
    tenantA.resolve(draft);
    await screen.findByText("محفوظ دون تحقق");
    await user.type(screen.getByLabelText("Client Secret"), "temporary-secret");

    const firstSignal = paymentApi.load.mock.calls[0][1] as AbortSignal;
    view.rerender(<BasGatePaymentConnectionCard activeTenantId="tenant-b" paymentConnections={paymentApi} />);
    expect(firstSignal.aborted).toBe(true);
    tenantB.resolve({ ...draft, environment: "production", revision: 7 });

    await waitFor(() => expect((screen.getByRole("combobox", { name: "البيئة" }) as HTMLSelectElement).value).toBe("production"));
    expect((screen.getByLabelText("Client Secret") as HTMLInputElement).value).toBe("");
  });

  it("clears detached secret inputs when the card unmounts", async () => {
    paymentApi.load.mockResolvedValue(unconfigured);
    const user = userEvent.setup();
    const view = render(<BasGatePaymentConnectionCard activeTenantId="tenant-a" paymentConnections={paymentApi} />);
    await screen.findByText("غير مهيأ");
    const secret = screen.getByLabelText("Client Secret") as HTMLInputElement;
    await user.type(secret, "temporary-secret");

    view.unmount();

    expect(secret.value).toBe("");
  });
});
