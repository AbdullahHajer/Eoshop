# WP 3.2 verification evidence

- Date: 2026-08-15
- Branch: `codex/wp-3.2-server-owned-state`
- Base: protected `main` at `d2eb1892`
- Scope: server-owned store workspace, product materialization, revision conflicts, plan enforcement and explicit browser drafts

## Authority and migration contract

- The authenticated merchant API is `GET/PATCH /api/merchant/stores/{tenant}/workspace`; the old tenant-host writer was removed and the public host retains a read-only composition route.
- Reads require an exact active membership. Aggregate writes additionally require both `tenant.store.manage` and `tenant.products.manage`, with tenant and membership reauthorization under central row locks.
- The tenant migration establishes one deterministic current configuration, positive monotonic revisions, product positions, bounded media arrays, non-negative price/stock fields and case-insensitive non-empty SKU uniqueness.
- Newly provisioned stores materialize their validated submission immediately. Existing stores retain legacy `config_json.products` reads until the first atomic save.
- Runtime and publication fail closed when schema provenance, required tenant columns, the current-row invariant or materialization are absent.
- Destructive tenant migration rollback is refused once materialized product state exists; a database test verifies the refusal and preservation of the workspace columns.
- Successful workspace reads and writes emit structured, redacted application logs containing request UUID, actor, tenant and revision metadata only; configuration, product content and credentials are excluded.

## Backend quality

Environment: `eoshop/backend-quality:ci`, rebuilt from the current tree with `docker/php/Dockerfile` target `quality`.

Result: **PASS**.

- Composer validation: valid.
- Composer locked audit: no security advisories.
- Pint: **139 files** passed.
- Larastan: **113 files**, no errors.
- Non-database PHPUnit: **3 tests, 6 assertions**.

## Frontend quality

Environment: pinned `node:22.23.1-alpine3.24` with `npm ci` from the lockfile.

Result: **PASS — 10 test files, 54 tests**.

- TypeScript `tsc --noEmit`: passed.
- Strict workspace DTO mapping and save payload tests: passed.
- Vite production build: passed (2,097 modules transformed).
- Dependency audit: **0 vulnerabilities** at the high threshold.
- The existing large-chunk warning remains non-blocking and belongs to interface decomposition/performance work.

## PostgreSQL and container integration

Command: `scripts/ci/integration-gate.ps1 -ProjectName eoshop-wp32-final-local3 -Port 18082` with freshly rebuilt WP 3.2 backend and quality images.

Result: **PASS**.

- Database PHPUnit: **67 tests, 495 assertions**.
- Central migrations/seeding and ordered rollback/reapply: passed.
- Tenant migration and legacy adoption: passed.
- Atomic materialization, UUID replacement, product quota, invalid media, inactive membership and stale revision `409`: passed.
- A real second PostgreSQL connection commits between configuration and product reads; the public response remains one repeatable-read snapshot.
- Legacy queued submissions above the locked plan limit or containing unmanaged media fail before materialization.
- Destructive rollback refusal after materialization: passed.
- Route cache/clear, public read-only route, central/tenant Host boundaries and context restoration: passed.
- Database queue worker and live provisioned tenant Host: passed.
- Gate cleanup removed its containers, network and named volumes.

Expected error logs from negative audit, rollback, unowned-schema and injected provisioning-failure tests were present while the suite remained green.

## Browser-state boundary

- Authenticated workspace edits call the server API and do not update `mobtaker_custom_store`.
- Browser storage is limited to an unpublished draft when no editable server workspace exists, a non-sensitive active-tenant preference, and the existing provisioning idempotency recovery record.
- A discovered local draft is shown separately and requires explicit import against the current server revision. It is removed only after a confirmed import; `409`, validation, network and server failures preserve it.
- Logout, session loss and account switching invalidate in-flight loads and restore only the local draft or clean preset; tenant-owned configuration, cart and selection state are cleared.
- Only `workspace_revision_conflict` opens recovery; quota/readiness/entitlement `409` responses remain ordinary domain errors.
- Revision recovery freezes the editor, reloads the server copy and applies only non-conflicting fields through a three-way merge. Conflicting server/draft values remain visible in a separate recovery review until the merchant explicitly archives or discards them.
- Dirty edits, pending conflicts and conflict-review snapshots all protect store switching, logout and `beforeunload`. Workspace GET and AI results are rejected when a later edit, load, save, logout or account reset makes them stale.

## Review and delivery

- Early independent review found six blocking design gaps; the implementation addressed all six before the final gates.
- Final independent read-only verdict: **APPROVE**, with no blocking findings.
- Implementation commit, PR, required checks, merge and protected-main verification: pending delivery.
