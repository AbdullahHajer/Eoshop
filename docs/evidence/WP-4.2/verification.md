# WP 4.2 verification evidence

- Date: 2026-08-16
- Branch: `codex/wp-4.2-inventory-ledger`
- Base: protected `main` at `d6110c34eb81cd5d99f44a6a1740bbd1e9a62ab3`
- Scope: append-only inventory ledger, reservations, concurrency and server-backed inventory adjustments
- Delivery: implementation is locally verified; commit, PR and protected-branch evidence are pending T5

## Inventory authority and data model

- Each product stores server-owned on-hand and reserved snapshots plus a per-product inventory revision; available stock is derived as on-hand minus reserved.
- Every balance change is represented by an immutable operation and product movement with before, delta and after values.
- Tracking and low-stock policy changes use the inventory authority and their own immutable before/after records.
- Reservation identity/items are immutable, while active reservations may transition exactly once to committed, released or expired.
- Existing products receive deterministic opening operations, including zero/untracked products; newly created products receive the same provenance in their creation transaction.
- Database triggers reject direct snapshot writes, forged application receipts and mutation/deletion of ledger history.
- Rollback refuses once the ledger contains adopted or operational history instead of deleting authoritative records.

## Backend quality

Environment: `eoshop/backend-quality:ci`, rebuilt from the current tree with `docker/php/Dockerfile` target `quality`.

Result: **PASS**.

- Pint: **169 files** passed.
- Larastan: **142 files**, no errors.
- Non-database PHPUnit: **3 tests, 6 assertions**.
- Composer validation and locked dependency audit remain part of protected CI.

## Frontend quality

Result: **PASS — 15 test files, 75 tests**.

- TypeScript type checking passed.
- Typed inventory DTO/API, idempotency and error mapping tests passed.
- Adjustment, policy, explicit inventory-capability, stale-response, tenant-switch and pending-operation interface flows passed.
- Inventory mutations update both visible state and the accepted workspace baseline, preventing false dirty state.
- Save, store switching, reload and logout are guarded while an inventory mutation is in flight.
- Vite production build passed.

## PostgreSQL and container integration

Command: `scripts/ci/integration-gate.ps1 -ProjectName eoshop-wp42-acceptance4 -Port 18091` after rebuilding both backend application and quality images from the current tree.

Result: **PASS**.

- Database PHPUnit: **83 tests, 747 assertions**.
- Central migrations/seeding and ordered rollback/reapply passed.
- Tenant migrations passed through inventory ledger migration `2026_08_16_000006`.
- Populated tenant adoption preserved visible quantities and created opening ledger provenance.
- Destructive inventory rollback refusal and safe empty rollback/reapply behavior passed.
- Direct database guards rejected unbound snapshot mutations, forged receipts, late reservation items, duplicate opening movements, uncoupled policy history and append-only history changes.
- Manual adjustment batches proved revision checks, atomicity, exact idempotent replay and `409` on key reuse with different content.
- Multi-product reservation failure rolled back every line; release, commit and expiry remained mutually exclusive terminal transitions.
- Forked PHP processes using independent PostgreSQL connections and a shared start barrier proved one-winner final-unit reservation, mutually exclusive release/commit and deadlock-free canonical product locking.
- Inventory history count and page queries shared one `REPEATABLE READ` snapshot during a concurrent committed write.
- Permission projection tests hid private inventory fields and inventory UI from roles without `tenant.inventory.view`, while view-only roles could not mutate; outsider and suspended-member requests failed closed.
- Merchant routes exposed inventory read/history/adjustment/policy operations only; no shopper order or public reservation route was introduced.
- Route cache/clear and central/tenant Host boundaries passed.
- The Compose scheduler service processed a real due reservation and produced one system-attributed expiry operation.
- Live authenticated HTTP probes proved missing CSRF `419`, malformed payload `422`, throttle exhaustion `429` and permission boundaries; the real database queue worker also passed.
- Gate cleanup removed containers, network and named volumes.

Expected error logs from negative audit, invalid provisioning, unowned schema and injected failure tests appeared while the suite remained green.

## Runtime and interface behavior

- Catalog/workspace mutations cannot overwrite authoritative stock for existing products; new-product opening stock is delegated to the inventory ledger.
- Merchant catalog/workspace DTOs expose inventory projections only with the inventory view permission.
- Public legacy `stockQuantity` represents available stock and never exposes the reserved quantity.
- The inventory panel submits explicit signed deltas with expected per-product revisions, reason codes and idempotency keys.
- Failed or stale inventory responses do not claim success or overwrite the active tenant state.
- Automatic shopper/order decrement remains intentionally absent until WP 4.3.

## Review and delivery

- Independent read-only final review: **APPROVE**, with no blocking findings after the final integration pass.
- Implementation commit: `6d7d2bd` (`feat(wp4.2): establish inventory ledger and reservations`).
- Pull request and protected CI: pending.
- Merge and protected-main CI: pending.
