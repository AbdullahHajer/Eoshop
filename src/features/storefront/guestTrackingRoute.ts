export const GUEST_TRACKING_PATH = "/track";

const CAPABILITY_PATTERN = /^eot1_[A-Za-z0-9_-]{43}$/;

export interface GuestTrackingRoute {
  capability: string | null;
  invalidCapability: boolean;
}

export function isGuestTrackingCapability(value: string): boolean {
  return CAPABILITY_PATTERN.test(value);
}

export function parseGuestTrackingLocation(pathname: string, hash: string): GuestTrackingRoute | null {
  if (pathname !== GUEST_TRACKING_PATH && pathname !== `${GUEST_TRACKING_PATH}/`) return null;

  if (hash === "" || hash === "#") {
    return { capability: null, invalidCapability: false };
  }

  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  const parameters = new URLSearchParams(fragment);
  const capability = parameters.get("token");
  const validShape = parameters.size === 1
    && capability !== null
    && isGuestTrackingCapability(capability)
    && fragment === `token=${capability}`;

  return validShape
    ? { capability, invalidCapability: false }
    : { capability: null, invalidCapability: true };
}

export function parseGuestTrackingUrl(value: string, origin: string): string | null {
  const trimmed = value.trim();
  if (isGuestTrackingCapability(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin || url.search !== "") return null;

  const route = parseGuestTrackingLocation(url.pathname, url.hash);
  return route && !route.invalidCapability ? route.capability : null;
}

export function trackingUrlForCapability(capability: string, origin: string): string {
  if (!isGuestTrackingCapability(capability)) throw new Error("Invalid guest tracking capability.");
  const url = new URL(GUEST_TRACKING_PATH, origin);
  url.hash = new URLSearchParams({ token: capability }).toString();
  return url.toString();
}

export function normalizeServerTrackingUrl(value: string): string | null {
  if (!value.startsWith(`${GUEST_TRACKING_PATH}#`)) return null;
  const route = parseGuestTrackingLocation(GUEST_TRACKING_PATH, value.slice(GUEST_TRACKING_PATH.length));
  return route && !route.invalidCapability ? value : null;
}
