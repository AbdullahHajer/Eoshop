const defaultCentralFrontendDomains = "localhost,127.0.0.1,eoshop.local";

export function parseCentralFrontendDomains(value: string): string[] {
  return value
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

export function isCentralFrontendHost(
  hostname: string,
  configuredDomains = import.meta.env.VITE_CENTRAL_DOMAINS || defaultCentralFrontendDomains,
): boolean {
  return parseCentralFrontendDomains(configuredDomains).includes(hostname.trim().toLowerCase());
}
