# WP 4.1 verification evidence

- Date: 2026-08-16
- Branch: `codex/wp-4.1-product-pricing-inventory`
- Base: protected `main` at `a50819c8ad92e2c152177b5ae6ab13e3c7645d28`
- Implementation commit: `f073b5e846897cb98c6b7e817f8a6124b86a17fc`
- Evidence commit: `15891128b5856cd63258a12fed434f45d2369832`
- Pull request: [#20](https://github.com/sas-prog1/Eoshop/pull/20) — merged
- Merge commit: `47ff4f47f5ab8a028368f1d04aa57e2e69fc0cd0`
- Scope: server-owned product lifecycle, exact pricing, managed media and inventory baseline

## Catalog authority and migration contract

- Each tenant owns one catalog settings row with an independent optimistic revision and an authoritative ISO currency code.
- Products have explicit `draft`, `published` and `archived` states; omission from a bulk payload never deletes or archives a product.
- Base and sale prices are persisted as integer minor units. The server validates decimal-string inputs and derives the effective public price.
- Existing materialized products are adopted with stable IDs, order, media and stock. Migration-only deterministic SKUs preserve legacy storefront behavior.
- Managed uploads are MIME-sniffed, bounded, tenant-prefixed and idempotent. Public delivery requires an attached asset, a published product, a runtime-ready tenant and the exact registered host.
- Inventory quantities and thresholds remain non-negative server-owned fields; movements, reservations and decrements remain explicitly deferred to WP 4.2.
- Destructive migration rollback refuses once authoritative catalog data or managed-media provenance exists.

## Backend quality

Environment: `eoshop/backend-quality:ci`, rebuilt from the current tree with `docker/php/Dockerfile` target `quality`.

Result: **PASS**.

- Pint: **154 files** passed.
- Larastan: **127 files**, no errors.
- Non-database PHPUnit: **3 tests, 6 assertions**.
- Composer validation and locked dependency audit are executed again by protected CI.

## Frontend quality

Environment: `eoshop/frontend-quality:ci`, pinned Node 22.23.1 image with the repository lockfile.

Result: **PASS — 14 test files, 71 tests**.

- TypeScript `tsc --noEmit`: passed.
- Catalog/workspace DTO, managed upload, stale response, tenant-switch, edit batching and conflict-preservation tests: passed.
- Vite production build: passed (**2,101 modules transformed**).
- Dependency audit: **0 vulnerabilities** at the high threshold.
- The existing large-chunk warning remains non-blocking and belongs to later interface decomposition/performance work.

## PostgreSQL and container integration

Command: `scripts/ci/integration-gate.ps1 -ProjectName eoshop-wp41-reviewfix2 -Port 18081` with current backend application, backend quality and web images.

Result: **PASS**.

- Database PHPUnit: **74 tests, 590 assertions**.
- Central migrations/seeding and ordered rollback/reapply: passed.
- Tenant catalog forward migration, populated-schema adoption and rollback refusal: passed.
- Direct database constraints for lifecycle, money, inventory, SKU, singleton catalog and media records: passed.
- Exact money, sale-price, currency immutability, product quota, direct archival recovery after plan downgrade and server-derived public price: passed.
- Dedicated catalog and composite workspace revision conflicts reject stale writes without partial mutation.
- Merchant/public DTO separation, draft/archive filtering, media authorization and central-host leak prevention: passed.
- Managed media MIME/size/pixel validation, idempotency conflict, tenant ownership, unsafe disk/path retention and attachment rules: passed.
- Two-phase orphan pruning, suspended-tenant maintenance and recovery from a retained cleanup tombstone after physical-file removal: passed.
- A real second PostgreSQL connection verifies repeatable-read snapshots during concurrent catalog and workspace writes.
- Active membership and product permission boundaries, tenant A/B isolation, CSRF, throttling and malformed identifiers: passed.
- Route cache/clear, live central and tenant Host boundaries, context restoration and the real database queue worker: passed.
- Gate cleanup removed its containers, network and named volumes.

Expected error logs from negative audit, invalid provisioning, unowned-schema and injected migration-failure tests were present while the suite remained green.

## Interface behavior

- The existing product and inventory panels now send typed catalog state to server APIs while retaining the familiar workspace workflow.
- Product status, SKU, authoritative base price, optional sale price, currency and stock values round-trip through server DTOs.
- Image upload uses bounded multipart data and never stores base64 bodies in product JSON.
- In-flight uploads are aborted or rejected as stale when the active tenant, product collection or editor lifetime changes.
- Atomic product-ID patches preserve base and sale price edits made in one React batch instead of overwriting either value.
- Catalog conflicts preserve explicit archive intent and dirty state; neither failures nor uploads display premature success.

## Review and delivery

- Independent read-only verdict: **APPROVE — no blocking findings**.
- Implementation commit: `f073b5e846897cb98c6b7e817f8a6124b86a17fc`.
- Evidence commit: `15891128b5856cd63258a12fed434f45d2369832`.
- PR #20 CI run [31957095898](https://github.com/sas-prog1/Eoshop/actions/runs/31957095898): all four required jobs passed on the final PR head.
- PR #20 merged to protected `main` as `47ff4f47f5ab8a028368f1d04aa57e2e69fc0cd0`.
- Protected-main CI run [31957287782](https://github.com/sas-prog1/Eoshop/actions/runs/31957287782): all four jobs passed on the merge commit.
