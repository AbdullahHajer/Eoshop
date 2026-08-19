# WP 5.6 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.6 — Merchant operations hub |
| Status | Verified; delivery pending |
| Verified | 2026-08-19 |
| Branch | `codex/wp-5.6-merchant-operations-hub` |
| Base | `7e05ec56a12577f4e66e149db02d2740d9ac116d` |
| Implementation commit | `6180adfcc9c4746850d14f710d98ae0d9c609745` |

## Delivered product boundary

- Added a route-owned store operations home under `/app/stores/{tenant}` with direct routes for products, orders, inventory, design, checkout and pages.
- Kept lifecycle overview available to every active exact-store membership while protecting operational modules with server-projected capabilities.
- Added server-owned order transition projection; the browser no longer recreates the order state machine.
- Added order and inventory operational panels with tenant-switch cancellation, serialized reads/mutations, preserved idempotency keys and authoritative reload after replay.
- Kept product summary read-only for catalog-only staff and routed product editing through the existing builder only when the complete workspace capability is present.
- Preserved draft, correction, publication, dirty-workspace and public-link boundaries without introducing a migration or new mutation endpoint.

## Independent review

- Read-only review challenged publication-session handling, server transition authority, products-route privilege separation, lifecycle visibility, tenant switching, replay receipts and read/mutation races.
- Blocking findings were corrected with exact 401 recovery, server-projected transitions, route-level capability separation, keyed remount/abort behavior, replay reloads and serialized order/inventory operations.
- Final independent read-only verdict: **APPROVE**, with no blocking findings.

## Frontend quality gate

Environment: current WP 5.6 frontend quality/build image.

- TypeScript check: PASS.
- Vitest: **57 suites / 162 tests passed**.
- Vite production build: PASS; **2,122 modules transformed**.
- Built JavaScript bundle: **871.92 kB / 222.80 kB gzip**.
- `npm audit --audit-level=high`: **0 vulnerabilities**.
- Covered direct route restoration, capability/lifecycle matrices, tenant switching, stale response isolation, order transitions, ambiguous replay, inventory revision conflict and serialized multi-operation behavior.
- The production bundle remains above the 500 kB warning threshold; route-level code splitting is retained as explicit extraction debt rather than hidden by this WP.

## Backend quality gate

Environment: `eoshop/backend-quality:ci`, rebuilt from the final implementation tree.

- Composer validation and locked dependency audit: PASS; no vulnerability advisories.
- Laravel Pint: **204 files passed**.
- Larastan: **174 files / no errors**.
- Backend unit suite: **3 tests / 6 assertions passed**.

## Repository and container integration gates

- `scripts/ci/repository-gate.ps1`: PASS.
- `git diff --check`: PASS.
- Exact application images were rebuilt from the implementation tree as `eoshop/backend:ci`, `eoshop/web:ci` and `eoshop/backend-quality:ci` before the final gate.
- PostgreSQL/container integration: **106 tests / 1,045 assertions passed**.
- Covered central and tenant migrations, populated staged rollback/reapply, route cache, live Host boundaries, order/inventory authority, database worker and scheduler.
- Integration project `eoshop-wp56-final2`, its containers, network and volumes were removed after the successful run; the user's local Pilot stack was not touched.

## Local UI smoke

- Exact production web image returned HTTP 200 and `text/html` for `/app` and direct routes for products, orders, inventory and design under a store path.
- Component and jsdom route tests confirmed session restoration and route-owned module selection; the smoke did not mutate Pilot data.

## Product handoff and retained debt

- Merchants now enter a specific store operations center instead of discovering orders and inventory as unrelated builder tabs.
- Product editing, design, checkout and pages still reuse the large builder intentionally; full product/settings editor extraction remains the next frontend decomposition boundary.
- Team/profile management and the full platform administration console remain separate product work.
- Revenue/payment fulfillment, shipping/returns, external DNS/TLS and production observability remain deliberately deferred.

## Delivery status

- Implementation is recorded separately in `6180adfcc9c4746850d14f710d98ae0d9c609745`.
- Evidence is recorded in the following documentation-only commit.
- PR, required CI, merge and protected-main CI facts will be appended only after they exist.
