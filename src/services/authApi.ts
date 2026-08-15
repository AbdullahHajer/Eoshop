import { apiClient } from "./apiClient";
import { enumField, nullableStringField, record, stringArrayField, stringField } from "./apiContract";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "pending" | "active" | "suspended";
  emailVerifiedAt: string | null;
  platformRoles: string[];
  platformPermissions: string[];
}

function mapAuthenticatedUser(value: unknown): AuthenticatedUser {
  const dto = record(value, "المستخدم المصادق");

  return {
    id: stringField(dto, "id", "المستخدم المصادق"),
    name: stringField(dto, "name", "المستخدم المصادق"),
    email: stringField(dto, "email", "المستخدم المصادق"),
    phone: nullableStringField(dto, "phone", "المستخدم المصادق"),
    status: enumField(dto, "status", ["pending", "active", "suspended"] as const, "المستخدم المصادق"),
    emailVerifiedAt: nullableStringField(dto, "email_verified_at", "المستخدم المصادق"),
    platformRoles: stringArrayField(dto, "platform_roles", "المستخدم المصادق"),
    platformPermissions: stringArrayField(dto, "platform_permissions", "المستخدم المصادق"),
  };
}

export const authApi = {
  async session(): Promise<AuthenticatedUser | null> {
    const payload = record(await apiClient.request<unknown>("/api/auth/session"), "جلسة المستخدم");

    return payload.data === null ? null : mapAuthenticatedUser(payload.data);
  },

  async register(input: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    passwordConfirmation: string;
  }): Promise<AuthenticatedUser> {
    const payload = record(await apiClient.request<unknown>("/api/auth/register", {
      method: "POST",
      body: {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        password: input.password,
        password_confirmation: input.passwordConfirmation,
      },
    }), "تسجيل المستخدم");

    return mapAuthenticatedUser(payload.data);
  },

  async login(email: string, password: string): Promise<AuthenticatedUser> {
    const payload = record(await apiClient.request<unknown>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    }), "دخول المستخدم");

    return mapAuthenticatedUser(payload.data);
  },

  async logout(): Promise<void> {
    record(await apiClient.request<unknown>("/api/auth/logout", { method: "POST", body: {} }), "خروج المستخدم");
    apiClient.clearCsrfToken();
  },

  async forgotPassword(email: string): Promise<string> {
    const payload = record(await apiClient.request<unknown>("/api/auth/forgot-password", {
      method: "POST",
      body: { email },
    }), "استعادة كلمة المرور");

    return stringField(payload, "message", "استعادة كلمة المرور");
  },

  async resetPassword(input: {
    token: string;
    email: string;
    password: string;
    passwordConfirmation: string;
  }): Promise<string> {
    const payload = record(await apiClient.request<unknown>("/api/auth/reset-password", {
      method: "POST",
      body: {
        token: input.token,
        email: input.email,
        password: input.password,
        password_confirmation: input.passwordConfirmation,
      },
    }), "تحديث كلمة المرور");
    apiClient.clearCsrfToken();

    return stringField(payload, "message", "تحديث كلمة المرور");
  },
};

export function toUserProfile(user: AuthenticatedUser) {
  const isSuperAdmin = user.platformRoles.includes("platform_super_admin");

  return {
    id: user.id,
    fullName: user.name,
    email: user.email,
    phone: user.phone ?? "",
    role: isSuperAdmin ? "admin" as const : "merchant" as const,
    platformRoles: user.platformRoles,
    platformPermissions: user.platformPermissions,
    storeStatus: "none" as const,
  };
}
