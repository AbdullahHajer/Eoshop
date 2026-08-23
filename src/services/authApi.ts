import { apiClient, ApiError } from "./apiClient";
import { enumField, nullableStringField, record, stringArrayField, stringField } from "./apiContract";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  profileRevision: number;
  createdAt: string | null;
  updatedAt: string | null;
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
    profileRevision: (() => {
      const revision = dto.profileRevision;
      if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 1) {
        throw new ApiError("استجابة المستخدم لا تحتوي نسخة ملف شخصي صالحة.", "unexpected", 200);
      }
      return revision;
    })(),
    createdAt: nullableStringField(dto, "createdAt", "المستخدم المصادق"),
    updatedAt: nullableStringField(dto, "updatedAt", "المستخدم المصادق"),
    status: enumField(dto, "status", ["pending", "active", "suspended"] as const, "المستخدم المصادق"),
    emailVerifiedAt: nullableStringField(dto, "email_verified_at", "المستخدم المصادق"),
    platformRoles: stringArrayField(dto, "platform_roles", "المستخدم المصادق"),
    platformPermissions: stringArrayField(dto, "platform_permissions", "المستخدم المصادق"),
  };
}

export const authApi = {
  async session(signal?: AbortSignal): Promise<AuthenticatedUser | null> {
    const payload = record(await apiClient.request<unknown>("/api/auth/session", { signal }), "جلسة المستخدم");

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

  async updateProfile(input: { expectedRevision: number; name: string; phone: string | null }, signal?: AbortSignal): Promise<AuthenticatedUser> {
    const payload = record(await apiClient.request<unknown>("/api/account/profile", {
      method: "PUT",
      body: input,
      signal,
    }), "تحديث الملف الشخصي");

    return mapAuthenticatedUser(payload.data);
  },

  async changePassword(input: { currentPassword: string; password: string; passwordConfirmation: string }, signal?: AbortSignal): Promise<string> {
    const payload = record(await apiClient.request<unknown>("/api/account/password", {
      method: "PUT",
      body: {
        currentPassword: input.currentPassword,
        password: input.password,
        password_confirmation: input.passwordConfirmation,
      },
      signal,
    }), "تغيير كلمة المرور");
    apiClient.clearCsrfToken();

    return stringField(payload, "message", "تغيير كلمة المرور");
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
  const isPlatformOperator = user.platformPermissions.some((permission) => permission.startsWith("platform."));

  return {
    id: user.id,
    fullName: user.name,
    email: user.email,
    phone: user.phone ?? "",
    profileRevision: user.profileRevision,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    role: isPlatformOperator ? "admin" as const : "merchant" as const,
    platformRoles: user.platformRoles,
    platformPermissions: user.platformPermissions,
    storeStatus: "none" as const,
  };
}
