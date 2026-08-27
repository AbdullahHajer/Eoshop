# ADR 0034 — Canonical merchant launch console

## Status

Accepted for WP 5.22 on 2026-08-27.

## Context

Eoshop already has a server-backed merchant portal, a route-owned store operations center and focused product, order, inventory and workspace editors. Creating another dashboard would duplicate navigation and state without improving the merchant journey. The launch product instead needs one obvious daily workspace with trustworthy numbers, actionable attention items and permission-aware links into those existing modules.

## Decision

1. `/app` remains the account-level merchant portal for store creation, lifecycle tracking and selecting one of the merchant's stores.
2. `/app/stores/{tenant}` remains the only store operations center. WP 5.22 upgrades its overview; it does not create a parallel dashboard or a second workspace writer.
3. One read-only endpoint, `/api/merchant/stores/{tenant}/dashboard`, projects the launch dashboard from the selected tenant database.
4. The endpoint aggregates product, inventory and order facts on the server. The browser never calculates authoritative sales, order or stock totals.
5. Every private fact and task is permission-scoped. A task is emitted only when the actor can open the corresponding operational action.
6. Recent-order summaries deliberately exclude customer identity, contact and address data. Those fields remain in the separately authorized order-detail workflow.
7. Dashboard failure is isolated from the existing focused modules and exposes an explicit retry. A stale response cannot cross a tenant switch.
8. Platform application review and active-store health remain a separate platform-owned work package. They must not reuse the merchant dashboard as an administrative back door.

## Consequences

- Merchants get one daily starting point instead of a third dashboard.
- The first page prioritizes tasks, today metrics, recent orders, seven-day completed sales and top products, then links to existing modules.
- Store selection and store operation have distinct, stable responsibilities.
- The endpoint executes a bounded set of indexed aggregate queries and returns a strict, minimal frontend contract.
- An additive tenant migration adds four dashboard query indexes; no duplicated business state is introduced.
- Customer directory, staff/team management, advanced reporting and platform review expansion remain later bounded work packages.
