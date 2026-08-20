import { afterEach, describe, expect, it, vi } from "vitest";
import { mapSubmission, provisioningApi } from "./provisioningApi";
import { apiClient } from "./apiClient";
import { ELEGANT_PRESET } from "../types";

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
});

describe("provisioningApi", () => {
  it("fails closed when a lifecycle enum or critical projection field is malformed", () => {
    expect(() => mapSubmission({
      id: "tenant-invalid",
      storeName: "Invalid store",
      businessType: "retail",
      verificationStatus: "secret_future_state",
      provisioningStatus: "active",
      publicationStatus: "published",
      reviewFeedback: null,
      capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: false },
      internalDomain: null,
      requestedDomain: null,
      publicDomain: "invalid.example.test",
      plan: null,
      subscriptionStatus: "active",
      publicationBlockers: [],
      createdAt: null,
      activeAt: null,
      publishedAt: null,
    })).toThrow(/عقد طلب المتجر/);
  });

  it("submits the store with CSRF and a durable idempotency key", async () => {
    const response = {
      data: {
        id: "tenant-1",
        storeName: "Store One",
        businessType: "retail",
        verificationStatus: "pending",
        provisioningStatus: "not_started",
        publicationStatus: "requested",
        reviewFeedback: null,
        capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: false },
        internalDomain: "store-tenant-1.eoshop.local",
        requestedDomain: "store-one.eoshop.local",
        publicDomain: null,
        plan: { key: "starter", name: "Starter", activationMode: "automatic" },
        subscriptionStatus: "active",
        publicationBlockers: ["review_not_approved", "provisioning_not_ready"],
        createdAt: "2026-08-14T00:00:00Z",
        activeAt: null,
        publishedAt: null,
      },
      meta: { replayed: false },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "store-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(response), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });

    await expect(provisioningApi.submit({
      storeName: "Store One",
      businessType: "retail",
      themeStyle: "elegant",
      handle: "store-one",
      planKey: "starter",
      config: { marker: "one" },
    })).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/register-store",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "11111111-1111-4111-8111-111111111111",
          "X-CSRF-TOKEN": "store-csrf",
        }),
      }),
    );
    expect(JSON.parse((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string)).toMatchObject({
      handle: "store-one",
      planKey: "starter",
    });
  });

  it("saves and maps the authenticated server draft with its optimistic revision", async () => {
    const legacyConfig = {
      ...ELEGANT_PRESET,
      enableBankTransfer: true,
      bankName: "Demo Bank",
      bankAccountName: "Demo Owner",
      bankAccountNumber: "123456789012",
      enableOnlineCard: true,
      enableApplePay: true,
      enableStcPay: true,
      enableEWallets: true,
      customWallets: [{ id: "Wallet-One", name: "Demo", accountNumber: "0501234567", accountName: "Demo", active: true }],
      enableCoupons: true,
      customCoupons: [{ code: "WELCOME10", discountPercent: 10, active: true }],
    };
    const draft = {
      data: {
        id: "draft-1",
        tenantId: null,
        status: "draft",
        revision: 1,
        storeName: "Store Draft",
        businessType: "retail",
        themeStyle: "elegant",
        handle: "store-draft",
        planKey: "starter",
        config: legacyConfig,
        savedAt: "2026-08-19T12:00:00Z",
        submittedAt: null,
      },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "draft-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(draft), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await provisioningApi.saveDraft({
      expectedRevision: 0,
      storeName: "Store Draft",
      businessType: "retail",
      themeStyle: "elegant",
      handle: "store-draft",
      planKey: "starter",
      config: { marker: "server" },
    });

    expect(result.config).toMatchObject({
      enableBankTransfer: false,
      enableOnlineCard: false,
      enableApplePay: false,
      enableStcPay: false,
      enableEWallets: false,
      enableCoupons: false,
    });
    expect((result.config.customWallets as Array<{ active: boolean }>)[0].active).toBe(false);
    expect((result.config.customCoupons as Array<{ active: boolean }>)[0].active).toBe(false);

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/merchant/store-draft",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(JSON.parse((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string)).toMatchObject({
      expectedRevision: 0,
      handle: "store-draft",
      planKey: "starter",
    });
  });

  it("reuses the persisted key after an ambiguous network failure", async () => {
    const values = new Map<string, string>();
    const localStorageMock = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
    } as unknown as Storage;
    const response = {
      data: {
        id: "tenant-2",
        storeName: "Store Two",
        businessType: "retail",
        verificationStatus: "pending",
        provisioningStatus: "not_started",
        publicationStatus: "requested",
        reviewFeedback: null,
        capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true, draftEdit: false, resubmit: false, publish: false, unpublish: false },
        internalDomain: "store-tenant-2.eoshop.local",
        requestedDomain: "store-two.eoshop.local",
        publicDomain: null,
        plan: { key: "pro", name: "Pro", activationMode: "manual" },
        subscriptionStatus: "pending_activation",
        publicationBlockers: ["review_not_approved"],
        createdAt: "2026-08-15T00:00:00Z",
        activeAt: null,
        publishedAt: null,
      },
      meta: { replayed: true },
    };
    let mutations = 0;
    const fetchMock = vi.fn((path: string, _options?: RequestInit) => {
      if (path === "/api/auth/csrf") {
        return Promise.resolve(new Response(JSON.stringify({ csrf_token: "durable-csrf" }), { status: 200 }));
      }
      mutations += 1;
      return mutations === 1
        ? Promise.reject(new TypeError("ambiguous network failure"))
        : Promise.resolve(new Response(JSON.stringify(response), { status: 200 }));
    });
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("crypto", { randomUUID: () => "22222222-2222-4222-8222-222222222222" });
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      storeName: "Store Two",
      businessType: "retail",
      themeStyle: "tech" as const,
      handle: "store-two",
      planKey: "pro",
      config: { marker: "two" },
    };

    await expect(provisioningApi.submit(input)).rejects.toMatchObject({ category: "network" });
    await expect(provisioningApi.submit(input)).resolves.toEqual(response);

    const mutationHeaders = fetchMock.mock.calls
      .filter(([path]) => path === "/api/register-store")
      .map(([, options]) => (options as RequestInit).headers as Record<string, string>);
    expect(mutationHeaders).toHaveLength(2);
    expect(mutationHeaders[0]["Idempotency-Key"]).toBe(mutationHeaders[1]["Idempotency-Key"]);
    expect(localStorageMock.setItem).toHaveBeenCalled();
    expect(localStorageMock.removeItem).toHaveBeenCalled();
  });
});
