import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUuid } from "./randomUuid";

afterEach(() => vi.unstubAllGlobals());

describe("randomUuid", () => {
  it("uses the native secure UUID implementation when available", () => {
    const native = vi.fn(() => "11111111-1111-4111-8111-111111111111" as `${string}-${string}-${string}-${string}-${string}`);
    vi.stubGlobal("crypto", { randomUUID: native, getRandomValues: vi.fn() });
    expect(randomUuid()).toBe("11111111-1111-4111-8111-111111111111");
    expect(native).toHaveBeenCalledOnce();
  });

  it("creates an RFC 4122 v4 UUID from secure bytes when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (target: Uint8Array) => {
        target.set(Array.from({ length: 16 }, (_, index) => index));
        return target;
      },
    });
    expect(randomUuid()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
  });

  it("fails closed when no secure random source exists", () => {
    vi.stubGlobal("crypto", {});
    expect(() => randomUuid()).toThrow("مولد أرقام عشوائية آمنًا");
  });
});
