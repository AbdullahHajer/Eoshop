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
      meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 },
    }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    const result = await adminApi.listStores({ attention: "review", page: 2 });
    expect(result.items).toEqual([store]);
    expect(result.items[0]).not.toHaveProperty("databasePassword");
    expect(result.pagination).toEqual({ currentPage: 1, lastPage: 1, perPage: 25, total: 1 });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/stores?attention=review&page=2", expect.objectContaining({
      credentials: "same-origin",
    }));
  });

  it("maps the overview and allowlisted audit projection", async () => {
    const overview = {
      generatedAt: "2026-08-21T12:00:00Z",
      stores: {
        total: 4,
        verification: { pending: 1, approved: 2, rejected: 1, suspended: 0 },
        provisioning: { notStarted: 1, queued: 0, provisioning: 0, retrying: 0, active: 2, failed: 1 },
        publication: { requested: 2, published: 1, unpublished: 1, rejected: 0 },
      },
      attention: { review: 1, provisioning: 1, subscription: 1, publication: 2 },
    };
    const audit = {
      id: 17,
      actorUserId: "01ADMIN",
      tenantId: store.id,
      action: "platform.store.verification_status.changed",
      subjectType: "tenant",
      subjectId: store.id,
      changedFields: ["verification_status"],
      ipAddress: null,
      requestId: "11111111-1111-4111-8111-111111111111",
      occurredAt: "2026-08-21T12:01:00Z",
    };
    const fetchMock = vi.fn((path: string) => Promise.resolve(new Response(JSON.stringify(
      path === "/api/admin/overview"
        ? { data: overview }
        : { data: [{ ...audit, oldValues: { secret: true }, userAgent: "must-not-escape" }], meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 } },
    ), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(adminApi.overview()).resolves.toEqual(overview);
    const events = await adminApi.listAuditLogs({ search: "verification", page: 1 });
    expect(events.items).toEqual([audit]);
    expect(events.items[0]).not.toHaveProperty("oldValues");
    expect(events.items[0]).not.toHaveProperty("userAgent");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/admin/audit-logs?search=verification&page=1");
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
