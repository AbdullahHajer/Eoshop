# WP 4.3 verification evidence

- Date: 2026-08-17
- Branch: `codex/wp-4.3-orders`
- Base: protected `main` at `e18500712e7580dc3644e03c8cec3773eec54352`
- Scope: server-authoritative pricing, orders, immutable snapshots, inventory coupling and merchant lifecycle
- Delivery: implementation and local gates complete; protected Git delivery in progress

## Order authority and data model

- The live tenant checkout sends product IDs, quantities and authority revisions only; the server derives every price, discount, fee, tax, shipping amount, currency and total.
- Authoritative money is stored and transferred as bounded integer minor units. Immutable item, checkout-policy, address and payment snapshots preserve the accepted quote.
- Customer contact, address, notes and offline transfer references use encrypted application casts and are excluded from structured logs.
- A database-bound create operation guards initial child inserts; immutable triggers reject later insertion, update or deletion of order snapshots and history.
- A positive unique per-order history sequence defines deterministic event order independently of second-level timestamp binding or random UUID ordering; the deferred invariant also requires a gapless chain.
- Deferred PostgreSQL invariants bind each tracked order line to its exact order-owned reservation and couple order status to reservation status.
- The legacy client-priced orders table is retained as an isolated `legacy_unverified` archive and never enters authoritative reads or inventory flows.
- Rollback succeeds before authoritative use and refuses once authoritative order operations exist.

## Backend quality

Environment: freshly rebuilt backend application and `eoshop/backend-quality:wp43` images from the final working tree.

Result: **PASS**.

- Composer validation passed.
- Pint: **187 files** passed.
- Larastan/PHPStan passed with no errors.
- Non-database PHPUnit: **3 tests, 6 assertions**.
- Order pricing, request allowlisting, payment policy, idempotency, authorization and lifecycle tests passed.

## Frontend quality

Result: **PASS — 19 test files, 85 tests**.

- TypeScript type checking and the Vite production build passed.
- Strict order DTO parsing and API error/idempotency behavior passed.
- A live tenant checkout proved server-receipt rendering, one-write double-submit protection and bank-transfer submission.
- A deferred stale-quote refresh preserved a cart quantity changed while the refresh was pending.
- Builder/template checkout remained explicitly preview-only and produced no server write.
- Merchant status controls retained one stable idempotency key after ambiguous failure and rejected duplicate clicks while a transition was pending.

## PostgreSQL and container integration

Final command: `scripts/ci/integration-gate.ps1 -ProjectName eoshop-wp43-sequence-final -Port 18097`, after rebuilding both backend application and backend quality images from the current tree.

Result: **PASS**.

- Database PHPUnit: **91 tests, 858 assertions**.
- Central migrations, seeding, ordered rollback/reapply and route cache/clear passed.
- Tenant migrations passed through `2026_08_16_000007_create_authoritative_orders` for new and adopted schemas.
- Legacy rows remained byte-preserved and isolated; empty rollback/reapply passed and populated authoritative rollback refused.
- Direct SQL attempts to append zero-value snapshot children after commit were rejected by PostgreSQL.
- Failure injection at operation-result storage rolled back the order, snapshots, reservation, movements and idempotency result together.
- A forked separate-connection final-unit race produced one durable order and one insufficient-stock result.
- Creation, merchant transition and system expiry history proved deterministic sequences under database row locks; the system-expiry targeted rerun passed **1 test, 9 assertions** before the final full gate.
- Idempotent replay, different-fingerprint conflict, stale quote, amount limits, payment policy, tenant isolation and customer-PII projection passed.
- Live HTTP probes passed for tenant-host checkout, CSRF, validation/conflict/error contracts and merchant authentication/authorization.
- The real Compose worker and scheduler processed their database-backed work, and the order-expiry path converged without racing generic inventory expiry.
- Gate cleanup removed every container, network and named volume.

Expected error logs from negative audit, provisioning and explicit failure-injection tests appeared while the suite remained green.

## Repository safety and configuration

- `git diff --check`: passed; only the existing PowerShell LF/CRLF conversion notice was emitted.
- Pinned `actionlint`: passed.
- Pinned Gitleaks scan: passed with no leaks.
- `docker compose ... config --quiet` passed with the same temporary CI-only required variables used by the integration gate.
- The frontend central-domain allowlist and tenant base domain are explicit Vite/Docker build arguments rather than development-only defaults.

## Runtime and interface behavior

- `GET /api/store/config` returns the authoritative workspace and catalog revisions needed by checkout.
- `POST /api/store/orders` exists only on a published runtime-ready tenant host and has no public order lookup, payment-success or inventory-mutation companion route.
- Exact idempotent replay returns the stored order receipt; a reused key with different content returns `409` without mutation.
- Submitted cancellation/expiry releases the reservation, acceptance commits it exactly once, and later fulfillment transitions never rewrite the pricing snapshot.
- Merchant list/detail and transitions require the matching order permission plus an active exact-tenant membership revalidated under lock.
- The UI renders totals from the durable server receipt and does not claim a real order from a builder/template preview.

## Review and delivery

- Independent read-only final review: **APPROVE**, with no blocking findings after the final fixes.
- Implementation commit: `4d34f4c` (`feat(wp4.3): establish authoritative order lifecycle`).
- Deterministic-history correction: `55222fa` (`fix(wp4.3): make order history sequencing deterministic`).
- Pull request and required checks: pending.
- Protected-main merge and push CI verification: pending.
- Documentation-only closeout PR: pending.
