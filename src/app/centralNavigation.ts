import type { AppView } from "./appTypes";

export type MerchantStoreSection = "overview" | "products" | "orders" | "inventory" | "design" | "checkout" | "pages";

export type CentralRoute =
  | { name: "landing" }
  | { name: "merchant" }
  | { name: "merchant-new" }
  | { name: "merchant-store"; tenantId: string; section: MerchantStoreSection }
  | { name: "merchant-correction"; tenantId: string }
  | { name: "admin" }
  | { name: "auth-flow" }
  | { name: "unknown" };

export function parseCentralRoute(pathname: string): CentralRoute {
  if (pathname === "/" || pathname === "") return { name: "landing" };
  if (pathname === "/app" || pathname === "/app/") return { name: "merchant" };
  if (pathname === "/app/new" || pathname === "/app/new/") return { name: "merchant-new" };
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return { name: "admin" };
  if (pathname === "/reset-password") return { name: "auth-flow" };

  const store = pathname.match(/^\/app\/stores\/([^/]+)(?:\/(overview|products|orders|inventory|design|checkout|pages))?\/?$/);
  if (store) {
    try {
      return {
        name: "merchant-store",
        tenantId: decodeURIComponent(store[1]),
        section: (store[2] || "overview") as MerchantStoreSection,
      };
    } catch {
      return { name: "unknown" };
    }
  }

  const correction = pathname.match(/^\/app\/stores\/([^/]+)\/correction\/?$/);
  if (correction) {
    try {
      return { name: "merchant-correction", tenantId: decodeURIComponent(correction[1]) };
    } catch {
      return { name: "unknown" };
    }
  }

  return { name: "unknown" };
}

export function merchantStorePath(tenantId: string, section: MerchantStoreSection = "overview"): string {
  const root = `/app/stores/${encodeURIComponent(tenantId)}`;
  return section === "overview" ? root : `${root}/${section}`;
}

export function centralPathForView(view: AppView, tenantId?: string): string {
  if (view === "merchant_dashboard") return "/app";
  if (view === "merchant_store" && tenantId) return merchantStorePath(tenantId);
  if (view === "builder" && tenantId) return `/app/stores/${encodeURIComponent(tenantId)}/design`;
  if (view === "landing") return "/";
  return window.location.pathname;
}

export function replaceCentralPath(path: string): void {
  if (window.location.pathname !== path) window.history.replaceState({}, "", path);
}

export function pushCentralPath(path: string): void {
  if (window.location.pathname !== path) window.history.pushState({}, "", path);
}
