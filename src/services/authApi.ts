export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "pending" | "active" | "suspended";
  email_verified_at: string | null;
  platform_roles: string[];
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

async function mutate<T>(path: string, body: Record<string, unknown>, retry = true): Promise<T> {
  const token = csrfToken ?? await establishCsrf();
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": token,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 419 && retry) {
    csrfToken = null;
    await establishCsrf();

    return mutate<T>(path, body, false);
  }

  return parseResponse<T>(response);
}

export const authApi = {
  async session(): Promise<AuthenticatedUser | null> {
    const response = await fetch("/api/auth/session", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const payload = await parseResponse<DataResponse<AuthenticatedUser | null>>(response);

    return payload.data;
  },

  async register(input: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    passwordConfirmation: string;
  }): Promise<AuthenticatedUser> {
    const payload = await mutate<DataResponse<AuthenticatedUser>>("/api/auth/register", {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      password: input.password,
      password_confirmation: input.passwordConfirmation,
    });

    return payload.data;
  },

  async login(email: string, password: string): Promise<AuthenticatedUser> {
    const payload = await mutate<DataResponse<AuthenticatedUser>>("/api/auth/login", {
      email,
      password,
    });

    return payload.data;
  },

  async logout(): Promise<void> {
    await mutate<MessageResponse>("/api/auth/logout", {});
    csrfToken = null;
  },

  async forgotPassword(email: string): Promise<string> {
    const payload = await mutate<MessageResponse>("/api/auth/forgot-password", { email });

    return payload.message;
  },

  async resetPassword(input: {
    token: string;
    email: string;
    password: string;
    passwordConfirmation: string;
  }): Promise<string> {
    const payload = await mutate<MessageResponse>("/api/auth/reset-password", {
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
    storeStatus: "none" as const,
  };
}
