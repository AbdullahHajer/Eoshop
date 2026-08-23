import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi, toUserProfile } from "./authApi";
import { apiClient } from "./apiClient";

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
});

describe("authApi", () => {
  it("establishes CSRF before login and uses same-origin credentials", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "csrf-value" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          id: "01TEST",
          name: "Merchant",
          email: "merchant@example.com",
          phone: null,
          profileRevision: 1,
          createdAt: "2026-08-23T00:00:00Z",
          updatedAt: "2026-08-23T00:00:00Z",
          status: "active",
          email_verified_at: null,
          platform_roles: [],
          platform_permissions: [],
        },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const user = await authApi.login("merchant@example.com", "secure-password");

    expect(user.email).toBe("merchant@example.com");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/csrf", expect.objectContaining({
      credentials: "same-origin",
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/login", expect.objectContaining({
      credentials: "same-origin",
      headers: expect.objectContaining({ "X-CSRF-TOKEN": "csrf-value" }),
    }));
  });

  it("surfaces server validation errors without fabricating a user", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "validation-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        message: "The given data was invalid.",
        errors: { email: ["بيانات الدخول غير صحيحة."] },
      }), { status: 422 })));

    await expect(authApi.login("wrong@example.com", "wrong-password"))
      .rejects.toEqual(expect.objectContaining({
        message: "بيانات الدخول غير صحيحة.",
        status: 422,
      }));
  });

  it("classifies permission-bearing platform operators without relying on a super-admin role name", () => {
    expect(toUserProfile({
      id: "01REVIEWER",
      name: "Reviewer",
      email: "reviewer@example.com",
      phone: null,
      profileRevision: 1,
      createdAt: null,
      updatedAt: null,
      status: "active",
      emailVerifiedAt: null,
      platformRoles: ["platform_reviewer"],
      platformPermissions: ["platform.stores.view", "platform.stores.review"],
    })).toEqual(expect.objectContaining({
      role: "admin",
      platformPermissions: ["platform.stores.view", "platform.stores.review"],
    }));

    expect(toUserProfile({
      id: "01ADMIN",
      name: "Admin",
      email: "admin@example.com",
      phone: null,
      profileRevision: 1,
      createdAt: null,
      updatedAt: null,
      status: "active",
      emailVerifiedAt: null,
      platformRoles: ["platform_super_admin"],
      platformPermissions: ["platform.stores.manage"],
    }).role).toBe("admin");
  });

  it("maps explicit user fields and rejects malformed successful contracts", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          id: "01USER",
          name: "User",
          email: "user@example.com",
          phone: null,
          profileRevision: 1,
          createdAt: "2026-08-23T00:00:00Z",
          updatedAt: "2026-08-23T00:00:00Z",
          status: "active",
          email_verified_at: null,
          platform_roles: [],
          platform_permissions: [],
          password_hash: "must-not-escape",
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: {
          id: "01USER",
          name: "User",
          email: "user@example.com",
          phone: null,
          profileRevision: 1,
          createdAt: "2026-08-23T00:00:00Z",
          updatedAt: "2026-08-23T00:00:00Z",
          status: "unknown",
          email_verified_at: null,
          platform_roles: [],
          platform_permissions: [],
        },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const user = await authApi.session();
    expect(user).not.toHaveProperty("password_hash");
    expect(user).toMatchObject({ platformRoles: [], emailVerifiedAt: null });
    await expect(authApi.session()).rejects.toMatchObject({ category: "unexpected" });
  });
});
