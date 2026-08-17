# WP 4.3 — Server-authoritative orders

| Field | Value |
|---|---|
| Phase | Phase 4 — Commerce and orders core |
| Work Package | WP 4.3 |
| Status | T0–T4 complete; T5 delivery in progress |
| Started | 2026-08-16 |
| Branch | `codex/wp-4.3-orders` |
| Base | Protected `main` at `e185007` |
| Dependencies | WP 1.3; WP 2.1–2.3; WP 3.1–3.3; WP 4.1–4.2 |
| Decision | [ADR 0014](../decisions/ADR-0014-server-authoritative-orders.md) |

## Objective

Replace the simulated browser checkout and untrusted legacy order payload with durable server-priced orders, immutable snapshots, atomic inventory reservations and a permissioned merchant lifecycle.

## Delivery optimization without reduced rigor

WP 4.3 is implemented internally as four bounded slices: schema/adoption, pricing/order domain, HTTP/authorization, then interface integration. Each slice runs targeted tests immediately. The expensive full container gate runs after the slices converge, while the same repository, backend, frontend and container gates remain mandatory before merge. Acceptance cases are fixed in T0 so independent review does not discover basic gate omissions after implementation.

## Scope

- Authoritative orders, item snapshots, encrypted address/contact snapshots, payment-attempt records, operations/results and status history.
- Exact integer-minor pricing from current server catalog and checkout policy.
- Coupon, minimum order, flat/free shipping, tax and COD fee calculation on the server.
- Public same-origin idempotent order submission on a published tenant host.
- Atomic order/reservation creation and atomic accept/cancel/expire inventory transitions.
- Merchant list/detail and controlled state transitions using existing order permissions.
- Live-storefront bootstrap from `/api/store/config`; builder/template checkout remains preview-only.
- Scheduled expiry reconciliation for submitted orders.
- Preservation and isolation of untrusted legacy orders.

## Out of scope

- Real card/wallet charging, payment gateways, webhooks, refunds or chargebacks.
- Public customer accounts/order history, courier integrations and shipment tracking.
- Returns/restocking after acceptance, partial fulfillment, variants or multi-warehouse inventory.
- Analytics dashboards beyond data required by order list/detail.

## T0–T5

### T0 — Contract and threat baseline

- [x] Inventory current checkout, legacy table, routes, pricing fields, permissions and WP 4.2 reservation contract.
- [x] Define exact pricing formula, immutable snapshots and client/server authority boundary.
- [x] Define lifecycle, lock order, idempotency, privacy and payment boundaries.
- [x] Complete independent design review and resolve all blocking findings before migration.

### T1 — Schema and adoption

- [x] Preserve legacy orders as a non-authoritative archive.
- [x] Add authoritative order, item, address, payment, operation/result and history tables.
- [x] Add database checks, immutable-history guards and status/history coupling.
- [x] Add checkout-only readiness/feature flag, safe fleet migration and fail-safe rollback refusal without taking storefront browsing offline.

### T2 — Order authority

- [x] Implement exact server pricing and immutable snapshots.
- [x] Implement atomic idempotent create/reserve and transition/terminal inventory coupling.
- [x] Implement order-owned expiry and prevent the generic inventory scheduler from racing it.
- [x] Implement merchant read/manage authorization with lock-time membership revalidation.

### T3 — Interface integration

- [x] Add typed storefront/order adapters and strict DTO validation.
- [x] Bootstrap the published storefront from its tenant API.
- [x] Replace live simulated success with server submission and durable response.
- [x] Preserve preview behavior while clearly preventing real writes from builder/template previews.

### T4 — Gates

- [x] Pass targeted schema, pricing, lifecycle, concurrency, HTTP and interface tests.
- [x] Pass repository safety, backend quality and frontend quality gates.
- [x] Pass PostgreSQL migration/rollback/reapply and full container/live-host gates.
- [x] Obtain independent read-only approval with no blocking findings.

### T5 — Evidence and delivery

- [ ] Record exact commands, counts, concurrency, migration, HTTP and cleanup evidence.
- [ ] Commit implementation and evidence separately.
- [ ] Push, open PR, pass all four required checks, merge and verify protected-main CI.
- [ ] Close delivery through a documentation-only protected PR.

## Acceptance criteria

- Changing client prices, totals, names, coupon percentages, shipping, tax or fees cannot change the server result; those fields are absent from the request allowlist.
- Stale `workspaceRevision` or `catalogRevision` returns `409 order_quote_stale` without an order or reservation.
- Public bootstrap returns both revisions with the config and obtains CSRF on the same tenant host before mutation.
- Prices and totals use non-negative integer minor-unit values in storage and on the wire; decimal formatting is a UI-only concern.
- The stored total equals the deterministic sum of its immutable components and item snapshots.
- The same idempotency key/fingerprint returns the same order; different content returns `409` without another order or reservation.
- Order creation and reservation are all-or-nothing under failure injection.
- Two concurrent submissions for the last unit produce one durable order and one insufficient-stock response.
- Concurrent accept/cancel/expire transitions have exactly one winner and matching inventory/history.
- Submitted cancellation/expiry releases stock; acceptance commits it exactly once.
- Unsupported/disabled payment methods and coupons fail closed; coupons are canonical/unique with no demo fallback, and no card data or payment-success claim is accepted.
- Tracked lines reserve stock, untracked lines do not, mixed orders reserve only the tracked subset, and `allowOrdersWhenOutOfStock` never overrides tracked availability.
- A deferred database invariant ties each order to its exact order-owned reservation, tracked item subset and compatible lifecycle state.
- Orders accept at most 50 distinct lines, quantity 1–99 per line and subtotal/grand total no greater than `100,000,000,000,000` minor units; checked overflow returns `422` before mutation.
- Merchant view/manage permissions, active membership and tenant A/B isolation are enforced under lock.
- Customer PII and offline references are encrypted at rest and absent from logs/API fields not requiring them.
- Legacy order data remains preserved but never appears as a server-authoritative order.
- Builder/template preview cannot create an order; a published tenant host can.
- No accepted-order cancellation/refund or external payment integration is accidentally exposed.

## Required gates

- Pricing vectors: sale/base, zero/100% coupon, rounding, threshold boundaries, disabled coupon/method, tax/COD/shipping and overflow.
- Database checks: totals, quantities, currency, unique order number, immutable snapshots/history, legal transition/history coupling and PII ciphertext.
- Idempotency and failure injection before/after order, items, reservation and result storage.
- Real separate-connection races: last unit, duplicate request, accept/cancel and accept/expiry.
- HTTP `404/409/419/422/429`, body limits, malformed IDs, tenant host boundary and merchant `401/403`.
- Route assertion that live checkout exists only in tenant routes and no public inventory mutation/payment-success route exists.
- Frontend tests for server total rendering, pending/double-submit, ambiguous-network retry with the same key, conflict/stock failure, tenant storefront bootstrap and preview-only behavior.
- Populated legacy migration preserving raw totals/items as `legacy_unverified`, empty rollback/reapply, rollback refusal after the first authoritative order and long-lived scheduler cleanup.
- Order feature-flag/readiness rollout proving storefront GET remains available while checkout alone returns structured `503` before fleet migration.

## Rollback

Before the first authoritative order, the new schema may be removed and the preserved legacy table restored. Once an authoritative order operation exists, rollback refuses. Operational rollback leaves order and inventory history intact and reverts application traffic only until a compatible forward migration is deployed.
