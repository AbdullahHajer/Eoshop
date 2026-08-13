import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi, toUserProfile } from "./authApi";

afterEach(() => {
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: "The given data was invalid.",
      errors: { email: ["بيانات الدخول غير صحيحة."] },
    }), { status: 422 })));

    await expect(authApi.login("wrong@example.com", "wrong-password"))
      .rejects.toEqual(expect.objectContaining({
        message: "بيانات الدخول غير صحيحة.",
        status: 422,
      }));
  });

  it("does not promote a platform reviewer to super admin", () => {
    expect(toUserProfile({
      id: "01REVIEWER",
      name: "Reviewer",
      email: "reviewer@example.com",
      phone: null,
      status: "active",
      email_verified_at: null,
      platform_roles: ["platform_reviewer"],
      platform_permissions: ["platform.stores.view", "platform.stores.review"],
    })).toEqual(expect.objectContaining({
      role: "merchant",
      platformPermissions: ["platform.stores.view", "platform.stores.review"],
    }));

    expect(toUserProfile({
      id: "01ADMIN",
      name: "Admin",
      email: "admin@example.com",
      phone: null,
      status: "active",
      email_verified_at: null,
      platform_roles: ["platform_super_admin"],
      platform_permissions: ["platform.stores.manage"],
    }).role).toBe("admin");
  });
});
