import { afterEach, describe, expect, it, vi } from "vitest";
import { adminApi } from "./adminApi";
import { apiClient } from "./apiClient";

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
});

const store = {
  id: "store-test",
  storeName: "Test Store",
  ownerName: "Owner",
  ownerEmail: "owner@example.com",
  ownerPhone: null,
  businessType: "retail",
  verificationStatus: "pending" as const,
  provisioningStatus: "not_started" as const,
  publicationStatus: "requested" as const,
  rejectionReason: null,
  themeStyle: "elegant" as const,
  domains: ["store-test"],
  requestedDomain: "store-test.eoshop.local",
  publicDomain: null,
  publicationBlockers: ["review_not_approved"],
  subscription: {
    id: "subscription-test",
    status: "pending_activation" as const,
    endsAt: null,
    plan: { key: "pro", name: "Pro", activationMode: "manual" as const },
  },
  createdAt: "2026-08-13T00:00:00Z",
  activeAt: null,
  latestProvisioningRun: null,
};

describe("adminApi", () => {
  it("loads authoritative platform stores with same-origin credentials", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      data: [{ ...store, databasePassword: "must-not-escape" }],
    }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(adminApi.listStores()).resolves.toEqual([store]);
    expect((await adminApi.listStores())[0]).not.toHaveProperty("databasePassword");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/stores", expect.objectContaining({
      credentials: "same-origin",
    }));
  });

  it("uses CSRF and PATCH for a review decision", async () => {
    const approved = { ...store, verificationStatus: "approved" as const };
    const fetchMock = vi.fn((path: string, _options?: RequestInit) => Promise.resolve(path === "/api/auth/csrf"
      ? new Response(JSON.stringify({ csrf_token: "admin-csrf" }), { status: 200 })
      : new Response(JSON.stringify({
        data: approved,
        meta: { requestId: "11111111-1111-4111-8111-111111111111" },
      }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(adminApi.updateStoreStatus(store.id, "approved")).resolves.toEqual(approved);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/stores/store-test/status",
      expect.objectContaining({
        method: "PATCH",
        credentials: "same-origin",
        headers: expect.objectContaining({ "X-CSRF-TOKEN": "admin-csrf" }),
      }),
    );
  });

  it("queues a manage-only provisioning retry", async () => {
    const retrying = { ...store, verificationStatus: "approved" as const, provisioningStatus: "retrying" as const };
    const fetchMock = vi.fn((path: string) => Promise.resolve(path === "/api/auth/csrf"
      ? new Response(JSON.stringify({ csrf_token: "retry-csrf" }), { status: 200 })
      : new Response(JSON.stringify({ data: retrying, meta: { requestId: "11111111-1111-4111-8111-111111111111" } }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(adminApi.retryProvisioning(store.id)).resolves.toEqual(retrying);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/stores/store-test/provisioning/retry",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
  });

  it("calls the explicit subscription and publication lifecycle endpoints", async () => {
    const fetchMock = vi.fn((path: string, _options?: RequestInit) => Promise.resolve(path === "/api/auth/csrf"
      ? new Response(JSON.stringify({ csrf_token: "publication-csrf" }), { status: 200 })
      : new Response(JSON.stringify({ data: store, meta: { requestId: "request-id" } }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await adminApi.activateSubscription(store.id, "2026-09-15T00:00:00.000Z");
    await adminApi.publish(store.id);
    await adminApi.unpublish(store.id);

    const mutationPaths = fetchMock.mock.calls.map(([path]) => path).filter((path) => path !== "/api/auth/csrf");
    expect(mutationPaths).toEqual([
      "/api/admin/stores/store-test/subscription/activate",
      "/api/admin/stores/store-test/publication/publish",
      "/api/admin/stores/store-test/publication/unpublish",
    ]);
    expect(JSON.parse((fetchMock.mock.calls.find(([path]) => path.includes("subscription/activate"))?.[1] as RequestInit).body as string))
      .toEqual({ endsAt: "2026-09-15T00:00:00.000Z" });
  });
});
