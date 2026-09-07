import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./apiClient";
import { mapPaymentConnection, paymentConnectionApi } from "./paymentConnectionApi";

const redactedConnection = {
  provider: "basgate",
  environment: "sandbox",
  state: "draft",
  revision: 2,
  canAcceptOnlinePayments: false,
  lastVerificationCode: null,
  lastVerifiedAt: null,
  updatedAt: "2026-09-07T12:00:00Z",
};

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
});

describe("paymentConnectionApi", () => {
  it("maps only the redacted BasGate projection", () => {
    const result = mapPaymentConnection({
      data: {
        ...redactedConnection,
        credentialCiphertext: "must-not-escape",
        clientSecret: "must-not-escape",
      },
    });

    expect(result).toEqual(redactedConnection);
    expect(result).not.toHaveProperty("credentialCiphertext");
    expect(result).not.toHaveProperty("clientSecret");
  });

  it("accepts only coherent closed lifecycle states", () => {
    expect(mapPaymentConnection({ data: {
      ...redactedConnection,
      environment: null,
      state: "unconfigured",
      revision: 0,
      updatedAt: null,
    } })).toMatchObject({ state: "unconfigured", revision: 0, environment: null });

    expect(() => mapPaymentConnection({ data: { ...redactedConnection, state: "ready" } })).toThrow(/عقد اتصال بوابة الدفع/);
    expect(() => mapPaymentConnection({ data: { ...redactedConnection, state: "unconfigured" } })).toThrow(/عقد اتصال بوابة الدفع/);
    expect(() => mapPaymentConnection({ data: { ...redactedConnection, canAcceptOnlinePayments: true } })).toThrow(/عقد اتصال بوابة الدفع/);
    expect(() => mapPaymentConnection({ data: { ...redactedConnection, updatedAt: "yesterday" } })).toThrow(/تاريخ تحديث/);
  });

  it("loads the exact tenant-scoped route with cancellation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: redactedConnection }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(paymentConnectionApi.load("tenant/a", controller.signal)).resolves.toEqual(redactedConnection);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/merchant/stores/tenant%2Fa/payment-connections/basgate",
      expect.objectContaining({ method: "GET", signal: controller.signal, redirect: "error" }),
    );
  });

  it("sends credentials only in the independent revisioned idempotent PUT", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "payment-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: redactedConnection }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const credentials = {
      appId: "app-id",
      merchantKey: "merchant-key",
      clientId: "client-id",
      clientSecret: "client-secret",
    };
    await paymentConnectionApi.configure("tenant-1", {
      environment: "sandbox",
      expectedRevision: 1,
      credentials,
    }, "11111111-1111-4111-8111-111111111111");

    const [, request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(request.method).toBe("PUT");
    expect(request.headers).toMatchObject({
      "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
      "X-CSRF-TOKEN": "payment-csrf",
    });
    expect(JSON.parse(request.body as string)).toEqual({
      environment: "sandbox",
      expectedRevision: 1,
      credentials,
    });
  });
});
