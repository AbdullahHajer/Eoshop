import { afterEach, describe, expect, it, vi } from "vitest";
import { adminApi } from "./adminApi";

afterEach(() => {
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
  rejectionReason: null,
  themeStyle: "elegant" as const,
  domains: ["store-test"],
  createdAt: "2026-08-13T00:00:00Z",
  activeAt: null,
  latestProvisioningRun: null,
};

describe("adminApi", () => {
  it("loads authoritative platform stores with same-origin credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [store] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(adminApi.listStores()).resolves.toEqual([store]);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/stores", expect.objectContaining({
      credentials: "same-origin",
    }));
  });

  it("uses CSRF and PATCH for a review decision", async () => {
    const approved = { ...store, verificationStatus: "approved" as const };
    const fetchMock = vi.fn((path: string) => Promise.resolve(path === "/api/auth/csrf"
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
});
