# WP 4.2 — Inventory ledger, reservations and concurrency

| Field | Value |
|---|---|
| Phase | Phase 4 — Commerce and orders core |
| Work Package | WP 4.2 |
| Status | Complete and merged |
| Started | 2026-08-16 |
| Branch | `codex/wp-4.2-inventory-ledger` |
| Base | Protected `main` at `d6110c3` |
| Dependencies | WP 1.3; WP 2.1–2.3; WP 3.1–3.3; WP 4.1 |
| Decision | [ADR 0013](../decisions/ADR-0013-append-only-inventory-ledger.md) |

## Objective

Replace absolute stock overwrites with a server-owned append-only ledger, explicit reservations and deterministic locking that prevent negative or oversold inventory while preserving the current merchant interface.

## Scope

- On-hand, reserved and server-derived available balances with a per-product inventory revision.
- Immutable inventory operation and movement history with actor/source/reason attribution.
- Explicit receive, issue, return and correction operations for authorized merchants.
- Inventory-owned tracking/threshold policy changes with immutable before/after history.
- Internal multi-product reserve, release, commit and expiry primitives for WP 4.3.
- Idempotent mutations with payload fingerprints and exact replay behavior.
- Stable row-lock ordering and all-or-nothing multi-product operations.
- Separate inventory view/manage permissions.
- Migration adoption with opening movements for existing products.
- Inventory UI backed by server adjustments rather than catalog stock overwrites.

## Out of scope

- Shopper cart, checkout, order creation or public reservation routes.
- Order, customer, payment or pricing references; these belong to WP 4.3.
- Multi-warehouse locations, purchase orders, suppliers, lot/serial tracking and transfers.
- Backorders or selling below available stock.
- Automated low-stock notifications and external warehouse integrations.

## T0–T5

### T0 — Contract and inventory baseline

- [x] Inventory current stock writers, UI actions, permissions and public projections.
- [x] Define on-hand/reserved/available semantics and lock order.
- [x] Separate internal reservations from WP 4.3 shopper/order scope.
- [x] Complete independent design review and resolve blocking findings.

### T1 — Schema and adoption

- [x] Add product reserved balance and inventory revision constraints.
- [x] Add immutable operation, movement, reservation and reservation-item tables.
- [x] Add database guards tying snapshot changes to matching ledger movements.
- [x] Adopt every existing product with a deterministic opening movement.
- [x] Add fail-safe rollback refusal after inventory becomes authoritative.

### T2 — Inventory authority

- [x] Add separate inventory view/manage permissions and policy abilities.
- [x] Implement manual adjustment, read and paginated history APIs.
- [x] Implement internal multi-product reserve/release/commit service.
- [x] Add bounded idempotent expiration maintenance.
- [x] Make catalog/workspace stock read-only for existing products and delegate opening balances.

### T3 — Interface integration

- [x] Replace direct stock edits and bulk overwrite alerts with typed inventory adjustments.
- [x] Display on-hand, reserved, available and revision values from the server.
- [x] Preserve dirty catalog edits while inventory requests load, fail or conflict.
- [x] Remove claims that automatic order decrement/backorders are already enabled.

### T4 — Gates

- [x] Prove PostgreSQL constraints, append-only guards, adoption and rollback refusal.
- [x] Prove last-unit and multi-product concurrency with independent connections.
- [x] Prove idempotency replay/conflict and reserve/commit/release/expiry races.
- [x] Pass authorization, tenant isolation, CSRF, throttling and DTO/public-boundary tests.
- [x] Pass frontend tests/build/audit plus repository and container gates.

### T5 — Evidence and delivery

- [x] Record migration, backend, frontend, concurrency, rollback and cleanup evidence.
- [x] Obtain independent read-only approval with no blocking findings.
- [x] Commit, push, open PR, pass the four required checks and merge.

## Acceptance criteria

- Existing product quantities are adopted without changing visible stock.
- Every balance mutation has exactly one immutable operation and matching movement rows.
- Direct SQL cannot create negative/over-reserved balances, mutate ledger history or change a snapshot without its movement.
- A repeated idempotency key with the same fingerprint returns the original result; different content returns `409` without mutation.
- Manual adjustment lines use distinct product IDs, explicit movement kinds, per-product expected revisions and correctly signed non-zero deltas; the whole batch is atomic.
- Two concurrent reservations for the final unit produce one success and one insufficient-stock conflict.
- A multi-product reservation either holds all requested items or none.
- Release, commit and expiry are mutually exclusive terminal transitions and are safe under races/retries.
- Catalog/workspace saves cannot overwrite existing stock and do not silently split catalog and inventory writes.
- Catalog/workspace compatibility projections expose merchant on-hand/reserved/available/revision values, while the public legacy stock quantity equals available rather than on-hand.
- An outsider, suspended member or role missing the inventory permission cannot view or mutate inventory.
- Public composition exposes only server-derived availability for published tracked products.
- WP 4.2 exposes no shopper order, checkout or reservation route.

## Required evidence

- Forward migration and deterministic opening-ledger adoption on populated tenant schemas.
- Direct SQL negative tests for balances, snapshot/ledger coupling and append-only triggers.
- Separate-connection concurrency tests for the final unit and opposite product ordering.
- Idempotency, multi-item atomicity, adjustment-versus-reservation and terminal-race tests.
- HTTP 401/403/419/422/429/409 boundaries and tenant A/B isolation.
- Frontend adjustment, conflict, stale response and failed-save characterization tests.
- Full local CI parity and protected-branch GitHub evidence.

## Rollback

An empty, unadopted inventory migration may roll back normally. Once opening or later operations, reservations, movements or inventory revisions exist, rollback refuses instead of erasing audit history or restoring unsafe absolute overwrites. Operational rollback keeps the tenant schema and ledger intact and reverts application code only until an explicit export/reconciliation procedure is approved.
