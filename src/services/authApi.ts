export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "pending" | "active" | "suspended";
  email_verified_at: string | null;
  platform_roles: string[];
  platform_permissions: string[];
}

interface DataResponse<T> {
  data: T;
}

interface MessageResponse {
  message: string;
}

interface ErrorResponse {
  message?: string;
  errors?: Record<string, string[]>;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

let csrfToken: string | null = null;

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as ErrorResponse & T;

  if (!response.ok) {
    const firstValidationMessage = Object.values(payload.errors ?? {})[0]?.[0];
    throw new AuthApiError(
      firstValidationMessage ?? payload.message ?? "تعذر إكمال الطلب. حاول مرة أخرى.",
      response.status,
      payload.errors,
    );
  }

  return payload;
}

async function establishCsrf(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const payload = await parseResponse<{ csrf_token: string }>(response);
  csrfToken = payload.csrf_token;

  return csrfToken;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });

  return parseResponse<T>(response);
}

export async function apiMutation<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body: Record<string, unknown>,
  options: { headers?: Record<string, string>; retry?: boolean } = {},
): Promise<T> {
  const retry = options.retry ?? true;
  const token = csrfToken ?? await establishCsrf();
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": token,
      ...options.headers,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 419 && retry) {
    csrfToken = null;
    await establishCsrf();

    return apiMutation<T>(path, method, body, { ...options, retry: false });
  }

  return parseResponse<T>(response);
}

export const authApi = {
  async session(): Promise<AuthenticatedUser | null> {
    const payload = await apiGet<DataResponse<AuthenticatedUser | null>>("/api/auth/session");

    return payload.data;
  },

  async register(input: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    passwordConfirmation: string;
  }): Promise<AuthenticatedUser> {
    const payload = await apiMutation<DataResponse<AuthenticatedUser>>("/api/auth/register", "POST", {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
    });

    return payload.data;
  },

  async login(email: string, password: string): Promise<AuthenticatedUser> {
    const payload = await apiMutation<DataResponse<AuthenticatedUser>>("/api/auth/login", "POST", {
      email,
      password,
    });

    return payload.data;
  },

  async logout(): Promise<void> {
    await apiMutation<MessageResponse>("/api/auth/logout", "POST", {});
    csrfToken = null;
  },

  async forgotPassword(email: string): Promise<string> {
    const payload = await apiMutation<MessageResponse>("/api/auth/forgot-password", "POST", { email });

    return payload.message;
  },

  async resetPassword(input: {
    token: string;
    email: string;
    password: string;
    passwordConfirmation: string;
  }): Promise<string> {
    const payload = await apiMutation<MessageResponse>("/api/auth/reset-password", "POST", {
      token: input.token,
      email: input.email,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
    });
    csrfToken = null;

    return payload.message;
  },
};

export function toUserProfile(user: AuthenticatedUser) {
  const isSuperAdmin = user.platform_roles.includes("platform_super_admin");

  return {
    id: user.id,
    fullName: user.name,
    email: user.email,
    phone: user.phone ?? "",
    role: isSuperAdmin ? "admin" as const : "merchant" as const,
    platformRoles: user.platform_roles,
    platformPermissions: user.platform_permissions,
    storeStatus: "none" as const,
  };
}
