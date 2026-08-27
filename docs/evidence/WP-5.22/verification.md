# WP 5.22 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.22 — Merchant launch console |
| Status | Final local gates passed; independent review and delivery in progress |
| Verified | 2026-08-27 |
| Branch | `codex/wp-5.22-merchant-launch-console` |
| Base | `f0ba6b88473d5d26be922338aca9918767176db9` |
| Decision | [ADR 0034](../../decisions/ADR-0034-canonical-merchant-launch-console.md) |
| Independent review | APPROVED — no P0/P1/P2 findings remain |

## Delivered boundary

- `/app` remains the account-level store selector and lifecycle portal.
- `/app/stores/{tenant}` remains the only route-owned operations center.
- A new read-only dashboard endpoint projects tenant-isolated metrics and actionable tasks.
- Product and order aggregate queries are bounded and indexed to avoid full historical scans.
- The frontend performs one cancellable dashboard load and rejects malformed successful responses.
- Recent-order projection is minimal and excludes customer/contact/address fields.
- Order, inventory, analytics, product-management and workspace-management visibility is derived from effective tenant permissions.
- Existing product, order, inventory and focused workspace editors are reused unchanged.
- One additive tenant migration adds dashboard query indexes; it does not change business data or API writers.

## Final local gates

- Locked Linux production Vite build: PASS; 2,150 modules transformed.
- Locked Linux Vitest: PASS; 57 files / 315 tests. An initial concurrent run exhausted timing budgets in one unrelated accessibility file; the file and then the full suite passed in isolated reruns.
- npm audit: PASS; zero known vulnerabilities.
- Frontend dashboard API contract: PASS; strict projection, abort handling and unsafe-counter rejection.
- Backend quality: PASS; Pint on 278 files, Larastan on 241 files with zero errors and PHPUnit 3 tests / 6 assertions.
- Composer validation and audit: PASS; lock file valid and zero known advisories.
- Focused PostgreSQL dashboard integration: PASS; 2 tests / 48 assertions, including authorization, restricted fields, no customer PII, indexes and the `Asia/Riyadh` business-day boundary.
- Complete isolated container integration: PASS; 163 database tests / 1,783 assertions plus HTTP, migration-adoption, tenant provisioning, worker and scheduler gates.
- The tenant migration `2026_08_27_000009_add_merchant_dashboard_indexes` applied successfully to both adoption and live tenant schemas in the integration gate.
- Repository gate, Docker Compose validation and `git diff --check`: PASS.

## Security and privacy assertions

- Route authorization requires an active tenant membership.
- The service gates private facts and actionable tasks using effective tenant permissions.
- Restricted members receive `null` for private metrics and empty private collections.
- Recent orders expose order number, state, payment state, currency, total and timestamp only.
- Tenant switching cannot apply a stale response to the next store.

## Pending delivery evidence

- Authenticated merchant browser acceptance in the retained Pilot; the isolated browser has no merchant session and no credentials were entered.
- Protected `main` merge.

## Independent review

- Initial review requested changes for permission-scoped product metrics, the configured business-day boundary and bounded/indexed historical queries.
- The final read-only re-review verified all three remediations in source, migration and PostgreSQL coverage.
- Result: **APPROVED** with no remaining P0, P1 or P2 findings.

## Retained Pilot

- Updated only the `eoshop-pilot` backend, worker, scheduler and web services to the tested WP 5.22 images; the PostgreSQL service and persistent volumes were preserved.
- Applied `2026_08_27_000009_add_merchant_dashboard_indexes` to the three active Pilot tenant schemas.
- Confirmed the lifecycle-aware `qa:migrate-active-tenants` command succeeds idempotently for all three active tenants and correctly excludes three `not_started` records that do not own schemas yet.
- Backend and web health checks: PASS; public Pilot HTTP check on `http://127.0.0.1:8010/`: 200.
- Public browser smoke check: PASS; the platform landing page loaded after deployment with the expected Arabic navigation and onboarding content.

## GitHub delivery

- Implementation commit: `04b33d1e60373dc5d273f29b2cf63a5f66f221b4`.
- CI-determinism follow-up: `7e6c8058b0e21314b329dbffcb89e4c55c6832f2`; an existing storefront test now waits for the accessible checkout heading instead of racing the animated cart drawer.
- Pull request: [#68](https://github.com/sas-prog1/Eoshop/pull/68).
- Required CI run `33037418893`: Repository safety PASS (14s), Frontend quality PASS (56s), Backend quality PASS (1m), Container integration PASS (5m 9s).
- The first CI attempt identified the existing storefront timing race and correctly skipped integration; the isolated same-version local rerun and the follow-up GitHub run both passed all 57 files / 315 frontend tests.

## Rollback

Restore the previous backend and web images. The additive dashboard indexes may remain safely; if an exact rollback is required, run the tenant migration rollback to remove only those four indexes.
