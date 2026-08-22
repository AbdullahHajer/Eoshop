const reservedPrefixes = [
  "/api/store-assets/",
  "/api/catalog-media/",
  "/api/platform-assets/",
] as const;

function canonicalPath(pathname: string): string | null {
  let path = pathname;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      return null;
    }
    if (decoded === path) break;
    path = decoded;
  }
  try {
    if (decodeURIComponent(path) !== path) return null;
  } catch {
    return null;
  }

  const segments: string[] = [];
  path.split("/").forEach((segment) => {
    if (!segment || segment === ".") return;
    if (segment === "..") {
      segments.pop();
      return;
    }
    segments.push(segment);
  });

  return `/${segments.join("/")}${path.endsWith("/") ? "/" : ""}`;
}

export function isSafePlatformLogoUrl(value: string | null): boolean {
  if (value === null) return true;
  if (!value || value.length > 2048 || /[\u0000-\u001F\u007F\\]/u.test(value)) return false;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password || parsed.hash) return false;

  const path = canonicalPath(parsed.pathname);
  return path !== null && reservedPrefixes.every((prefix) => !path.startsWith(prefix));
}
