export interface BrowserLocation {
  protocol: string;
  port: string;
}

export function publicStoreUrl(domain: string, location: BrowserLocation = window.location): string {
  const canonicalDomain = domain.trim().toLowerCase();
  if (!canonicalDomain || canonicalDomain.includes(":")) {
    throw new Error("A canonical public store domain is required.");
  }

  const protocol = location.protocol === "https:" ? "https:" : "http:";
  const port = location.port ? `:${location.port}` : "";

  return `${protocol}//${canonicalDomain}${port}`;
}
