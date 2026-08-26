import { afterEach, describe, expect, it, vi } from "vitest";
import { requestFingerprint } from "./requestFingerprint";

afterEach(() => vi.unstubAllGlobals());

describe("requestFingerprint", () => {
  it("preserves the SHA-256 path when SubtleCrypto is available", async () => {
    const digest = vi.fn(async () => Uint8Array.from({ length: 32 }, (_, index) => index).buffer);
    vi.stubGlobal("crypto", { subtle: { digest } });

    await expect(requestFingerprint("payload")).resolves.toBe(
      "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
    );
    expect(digest).toHaveBeenCalledWith("SHA-256", expect.any(Uint8Array));
  });

  it("uses a deterministic non-sensitive comparison token without SubtleCrypto", async () => {
    vi.stubGlobal("crypto", {});

    const first = await requestFingerprint("same payload");
    await expect(requestFingerprint("same payload")).resolves.toBe(first);
    await expect(requestFingerprint("different payload")).resolves.not.toBe(first);
    expect(first).toMatch(/^portable-v1:[0-9a-f]{32}$/);
  });

  it("falls back when an exposed SubtleCrypto implementation rejects", async () => {
    vi.stubGlobal("crypto", { subtle: { digest: vi.fn(async () => { throw new Error("not available"); }) } });
    await expect(requestFingerprint("payload")).resolves.toMatch(/^portable-v1:[0-9a-f]{32}$/);
  });
});
