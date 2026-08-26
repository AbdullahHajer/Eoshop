# ADR 0032 — Merchant management entry and public storefront recovery

## Status

Accepted for WP 5.20 on 2026-08-25.

## Context

The merchant portal already contains the authoritative store list and the route-owned operations center, but its sidebar renders “My stores” as static text. The only management entry is labelled “Open store center”, which does not tell a merchant where visual editing lives. A transient public-storefront read also leaves the customer on a generic error screen whose retry reloads the complete application.

## Decision

1. “My stores” becomes an in-page navigation action that moves focus to the authoritative server-owned store list without creating a second stores screen.
2. The selected-store primary action is named “Manage and edit store” and opens the route-owned operations overview.
3. Capability-aware shortcuts open products, orders, design and pages through their existing routes. No shortcut bypasses server capabilities.
4. Public-storefront loading becomes an explicit cancellable task with an initial bounded retry for transient network/server failure and an in-place manual retry.
5. The public error state distinguishes an unavailable published address from a temporary connection/service failure without exposing internal diagnostics.

## Consequences

- Merchants gain a discoverable path to existing-store editing without duplicating management logic.
- Temporary startup/network failures can recover without a full page reload.
- Public-store authority, tenant routing, permissions and persisted contracts remain unchanged.
- Broad public-storefront responsive, keyboard and cross-browser acceptance moves to WP 5.21.
