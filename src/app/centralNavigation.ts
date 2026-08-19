import type { AppView } from "./appTypes";

export type CentralRoute =
  | { name: "landing" }
  | { name: "merchant" }
  | { name: "merchant-new" }
  | { name: "merchant-design"; tenantId: string }
  | { name: "admin" }
  | { name: "auth-flow" }
  | { name: "unknown" };

export function parseCentralRoute(pathname: string): CentralRoute {
  if (pathname === "/" || pathname === "") return { name: "landing" };
  if (pathname === "/app" || pathname === "/app/") return { name: "merchant" };
  if (pathname === "/app/new" || pathname === "/app/new/") return { name: "merchant-new" };
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return { name: "admin" };
  if (pathname === "/reset-password") return { name: "auth-flow" };

  const design = pathname.match(/^\/app\/stores\/([^/]+)\/design\/?$/);
  if (design) {
    try {
      return { name: "merchant-design", tenantId: decodeURIComponent(design[1]) };
    } catch {
      return { name: "unknown" };
    }
  }

  return { name: "unknown" };
}

export function centralPathForView(view: AppView, tenantId?: string): string {
  if (view === "merchant_dashboard") return "/app";
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
