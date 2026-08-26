function portableFingerprint(value: string): string {
  let h1 = 0x6a09e667;
  let h2 = 0xbb67ae85;
  let h3 = 0x3c6ef372;
  let h4 = 0xa54ff53a;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 0x9e3779b1);
    h2 = Math.imul(h2 ^ code, 0x85ebca77);
    h3 = Math.imul(h3 ^ code, 0xc2b2ae3d);
    h4 = Math.imul(h4 ^ code, 0x27d4eb2f);
    h1 ^= h2 >>> 13;
    h2 ^= h3 >>> 11;
    h3 ^= h4 >>> 17;
    h4 ^= h1 >>> 15;
  }

  const words = [
    Math.imul(h1 ^ (h3 >>> 16), 0x85ebca77),
    Math.imul(h2 ^ (h4 >>> 13), 0xc2b2ae3d),
    Math.imul(h3 ^ (h1 >>> 16), 0x9e3779b1),
    Math.imul(h4 ^ (h2 >>> 13), 0x27d4eb2f),
  ];

  return words.map((word) => (word >>> 0).toString(16).padStart(8, "0")).join("");
}

/**
 * Produces only a local retry-comparison token. The server-owned idempotency
 * key remains a cryptographically random UUID and protects the real mutation.
 */
export async function requestFingerprint(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (typeof subtle?.digest === "function") {
    try {
      const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    } catch {
      // Non-secure HTTP contexts can expose crypto without a usable SubtleCrypto implementation.
    }
  }

  return `portable-v1:${portableFingerprint(value)}`;
}
