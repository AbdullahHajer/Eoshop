import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "./apiClient";

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function headersAt(fetchMock: ReturnType<typeof vi.fn>, call: number): Headers {
  return new Headers((fetchMock.mock.calls[call][1] as RequestInit).headers);
}

describe("apiClient", () => {
  it.each([
    [401, "unauthenticated"],
    [403, "forbidden"],
    [409, "conflict"],
    [419, "csrf"],
    [429, "throttled"],
  ] as const)("normalizes HTTP %s as %s", async (status, category) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "safe" }), { status })));

    await expect(apiClient.request("/api/test")).rejects.toEqual(expect.objectContaining({
      name: "ApiError",
      status,
      category,
    }));
  });

  it("preserves structured validation fields and uses their first message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: "invalid",
      errors: { email: ["البريد غير صالح"], ignored: "not-an-array" },
    }), { status: 422 })));

    await expect(apiClient.request("/api/test")).rejects.toEqual(expect.objectContaining({
      category: "validation",
      message: "البريد غير صالح",
      errors: { email: ["البريد غير صالح"] },
    }));
  });

  it("preserves a safe machine code used to distinguish 409 contracts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: "stale",
      code: "workspace_revision_conflict",
    }), { status: 409 })));

    await expect(apiClient.request("/api/test")).rejects.toMatchObject({
      category: "conflict",
      status: 409,
      code: "workspace_revision_conflict",
    });
  });

  it("sanitizes 5xx text while retaining request correlation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: "SQLSTATE secret detail",
      stack: "sensitive",
    }), { status: 500, headers: { "X-Request-Id": "server-request-id" } })));

    const failure = await apiClient.request("/api/test").catch((error) => error) as ApiError;

    expect(failure).toMatchObject({ category: "server", status: 500, requestId: "server-request-id", retryable: true });
    expect(failure.message).not.toContain("SQLSTATE");
    expect(failure).not.toHaveProperty("stack", "sensitive");
  });

  it("uses the logical request UUID when the server does not echo correlation", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));

    await expect(apiClient.request("/api/test")).rejects.toMatchObject({
      category: "server",
      requestId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("parses Retry-After seconds and HTTP dates", async () => {
    const now = new Date("2026-08-15T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "Retry-After": "7" } }))
      .mockResolvedValueOnce(new Response("{}", {
        status: 429,
        headers: { "Retry-After": new Date(now.getTime() + 15_000).toUTCString() },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.request("/api/one")).rejects.toMatchObject({ retryAfterSeconds: 7 });
    await expect(apiClient.request("/api/two")).rejects.toMatchObject({ retryAfterSeconds: 15 });
  });

  it("shares one CSRF request between concurrent mutations", async () => {
    let releaseCsrf!: (response: Response) => void;
    const csrfResponse = new Promise<Response>((resolve) => { releaseCsrf = resolve; });
    const fetchMock = vi.fn((path: string) => path === "/api/auth/csrf"
      ? csrfResponse
      : Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);

    const first = apiClient.request("/api/first", { method: "POST", body: {} });
    const second = apiClient.request("/api/second", { method: "POST", body: {} });
    await Promise.resolve();
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/auth/csrf")).toHaveLength(1);
    releaseCsrf(new Response(JSON.stringify({ csrf_token: "shared-token" }), { status: 200 }));

    await expect(Promise.all([first, second])).resolves.toEqual([{ ok: true }, { ok: true }]);
  });

  it("clears a rejected CSRF single-flight so a later request can recover", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "failed" }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "recovered" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.request("/api/first", { method: "POST", body: {} })).rejects.toMatchObject({ category: "server" });
    await expect(apiClient.request("/api/second", { method: "POST", body: {} })).resolves.toEqual({ ok: true });
  });

  it("replays a 419 exactly once with a new CSRF token and the same logical headers", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "old-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "expired" }), { status: 419 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "new-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.request("/api/store", {
      method: "POST",
      body: { name: "store" },
      headers: { "Idempotency-Key": "idem-key" },
    })).resolves.toEqual({ ok: true });

    const mutationCalls = fetchMock.mock.calls
      .map((call, index) => ({ call, index }))
      .filter(({ call }) => call[0] === "/api/store");
    expect(mutationCalls).toHaveLength(2);
    const firstHeaders = headersAt(fetchMock, mutationCalls[0].index);
    const secondHeaders = headersAt(fetchMock, mutationCalls[1].index);
    expect(firstHeaders.get("X-Request-ID")).toBe(secondHeaders.get("X-Request-ID"));
    expect(firstHeaders.get("Idempotency-Key")).toBe("idem-key");
    expect(secondHeaders.get("Idempotency-Key")).toBe("idem-key");
    expect(firstHeaders.get("X-CSRF-TOKEN")).toBe("old-token");
    expect(secondHeaders.get("X-CSRF-TOKEN")).toBe("new-token");
  });

  it("shares one CSRF refresh across concurrent 419 responses", async () => {
    let refreshes = 0;
    const attempts = new Map<string, number>();
    const fetchMock = vi.fn((path: string) => {
      if (path === "/api/auth/csrf") {
        refreshes += 1;
        return Promise.resolve(new Response(JSON.stringify({ csrf_token: `token-${refreshes}` }), { status: 200 }));
      }
      const attempt = (attempts.get(path) ?? 0) + 1;
      attempts.set(path, attempt);
      return Promise.resolve(attempt === 1
        ? new Response("{}", { status: 419 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(Promise.all([
      apiClient.request("/api/first", { method: "POST", body: {} }),
      apiClient.request("/api/second", { method: "POST", body: {} }),
    ])).resolves.toEqual([{ ok: true }, { ok: true }]);

    expect(refreshes).toBe(2);
  });

  it("does not refresh or replay after the caller aborts a 419 request", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "token" }), { status: 200 }))
      .mockImplementationOnce(() => {
        controller.abort();
        return Promise.resolve(new Response("{}", { status: 419 }));
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.request("/api/mutation", {
      method: "POST",
      body: {},
      signal: controller.signal,
    })).rejects.toMatchObject({ category: "aborted" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not replay a second 419 or automatically retry network failures", async () => {
    const csrfThenFailures = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "one" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 419 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "two" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 419 }));
    vi.stubGlobal("fetch", csrfThenFailures);
    await expect(apiClient.request("/api/mutation", { method: "POST", body: {} }))
      .rejects.toMatchObject({ category: "csrf" });
    expect(csrfThenFailures.mock.calls.filter(([path]) => path === "/api/mutation")).toHaveLength(2);

    apiClient.clearCsrfToken();
    const networkFailure = vi.fn().mockRejectedValue(new TypeError("ambiguous failure"));
    vi.stubGlobal("fetch", networkFailure);
    await expect(apiClient.request("/api/read")).rejects.toMatchObject({ category: "network", retryable: true });
    expect(networkFailure).toHaveBeenCalledTimes(1);
  });

  it("marks mutation failures retryable only with an explicit idempotency contract", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "mutation-csrf" }), { status: 200 }))
      .mockRejectedValueOnce(new TypeError("ambiguous mutation"))
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValueOnce(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.request("/api/unsafe", { method: "POST", body: {} }))
      .rejects.toMatchObject({ category: "network", retryable: false });
    await expect(apiClient.request("/api/unsafe", { method: "POST", body: {} }))
      .rejects.toMatchObject({ category: "server", retryable: false });
    await expect(apiClient.request("/api/idempotent", {
      method: "POST",
      body: {},
      headers: { "Idempotency-Key": "stable-key" },
      retrySafety: "idempotent",
    })).rejects.toMatchObject({ category: "server", retryable: true });

    await expect(apiClient.request("/api/invalid", {
      method: "POST",
      body: {},
      retrySafety: "idempotent",
    })).rejects.toMatchObject({ category: "unexpected" });
  });

  it("aborts a caller waiting on shared CSRF without cancelling it or sending the mutation", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_path: string) => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    const request = apiClient.request("/api/mutation", {
      method: "POST",
      body: {},
      signal: controller.signal,
    });
    await Promise.resolve();
    controller.abort();

    await expect(request).rejects.toMatchObject({ category: "aborted", retryable: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/csrf");
  });

  it("propagates aborts and rejects malformed successful JSON", async () => {
    const controller = new AbortController();
    const abort = new DOMException("aborted", "AbortError");
    const fetchMock = vi.fn().mockImplementation((_path: string, options: RequestInit) => {
      controller.abort();
      return Promise.reject(options.signal?.reason ?? abort);
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiClient.request("/api/read", { signal: controller.signal }))
      .rejects.toMatchObject({ category: "aborted", retryable: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })));
    await expect(apiClient.request("/api/read")).rejects.toMatchObject({ category: "unexpected" });
  });

  it.each(["https://evil.example/api", "//evil.example/api", "/\\evil", "/%5Cevil", "/api/test#fragment"])(
    "rejects an unsafe request target: %s",
    async (path) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await expect(apiClient.request(path)).rejects.toMatchObject({ category: "unexpected" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("does not allow callers to replace protected transport headers", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.request("/api/read", { headers: { Accept: "text/html" } }))
      .rejects.toMatchObject({ category: "unexpected" });
    await expect(apiClient.request("/api/read", { headers: { "X-CSRF-TOKEN": "forged" } }))
      .rejects.toMatchObject({ category: "unexpected" });
    await expect(apiClient.request("/api/read", { headers: { "X-Request-ID": "forged" } }))
      .rejects.toMatchObject({ category: "unexpected" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forbids fetch redirects for requests carrying credentials and bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.request("/api/read");

    expect(fetchMock).toHaveBeenCalledWith("/api/read", expect.objectContaining({ redirect: "error" }));
  });

  it("sends FormData without overriding the browser multipart boundary", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "multipart-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.append("idempotencyKey", "upload-key");

    await apiClient.request("/api/upload", {
      method: "POST",
      body: form,
      headers: { "Idempotency-Key": "upload-key" },
      retrySafety: "idempotent",
    });

    const request = fetchMock.mock.calls[1][1] as RequestInit;
    expect(request.body).toBe(form);
    expect(new Headers(request.headers).has("Content-Type")).toBe(false);
  });
});
