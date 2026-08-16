# WP 4.1 — Server-owned product, pricing and inventory model

| Field | Value |
|---|---|
| Phase | Phase 4 — Commerce and orders core |
| Work Package | WP 4.1 |
| Status | Complete and merged |
| Started | 2026-08-16 |
| Branch | `codex/wp-4.1-product-pricing-inventory` |
| Base | Protected `main` at `a50819c8` |
| Dependencies | WP 1.3; WP 2.1–2.3; WP 3.1–3.3 |
| Decision | [ADR 0012](../decisions/ADR-0012-server-owned-catalog-pricing-media.md) |

## Objective

Turn the materialized WP 3.2 product rows into a durable commerce catalog whose publication state, SKU, currency, base price, sale price, media and inventory baseline are enforced and composed by the server.

## Scope

- A singleton tenant catalog record with an optimistic revision independent from the workspace revision and one ISO 4217 currency code.
- Durable products with explicit `draft`, `published` and `archived` lifecycle states.
- Exact base and optional sale prices stored as integer minor units; the effective public price is derived by the server.
- Stable tenant-scoped SKU uniqueness and publication requirements.
- Ordered product media records supporting managed uploads and adopted HTTPS sources.
- Existing stock quantity, managed-stock flag and low-stock threshold kept server-owned with database non-negative constraints.
- A public projection that exposes only published products and never accepts price or stock from a shopper.
- Backward-compatible workspace composition so the current builder keeps its visible workflow while using the new catalog authority.
- A dedicated merchant catalog API requiring product permission only; the composite workspace route remains available to owners with both permissions.
- Explicit adoption of already-materialized WP 3.2 products without dropping identifiers or inventory.

## Out of scope

- Inventory movement ledger, reservations, concurrent decrement and returns; these belong to WP 4.2.
- Order creation, price snapshots, discounts, shipping, tax and checkout idempotency; these belong to WP 4.3.
- Variants and option matrices; the schema must leave room for them without implementing them.
- External object-storage/CDN deployment. WP 4.1 defines a disk-neutral managed-media contract and uses the configured Laravel disk locally.
- Payment methods and proof-of-transfer workflows.

## T0–T5

### T0 — Contract and adoption baseline

- [x] Inventory the WP 3.2 product, workspace and public-store contracts.
- [x] Separate WP 4.1 product/pricing responsibilities from WP 4.2 inventory movements and WP 4.3 orders.
- [x] Complete independent design review and resolve blocking findings.

### T1 — Tenant catalog schema

- [x] Add catalog singleton, product lifecycle, exact-price and media schema.
- [x] Adopt existing products deterministically and preserve IDs, order, images and stock.
- [x] Add fail-safe rollback rules after catalog data becomes authoritative.

### T2 — Server authority

- [x] Centralize catalog validation, money conversion and public effective-price composition.
- [x] Require active membership and product-management permission under a stable lock order.
- [x] Add a product-only catalog API with a distinct catalog revision and conflict code.
- [x] Keep aggregate workspace writes atomic, check workspace and catalog revisions before mutation and reject either stale revision without partial changes.
- [x] Store managed image uploads outside JSON/base64 payloads and bind them safely to products.

### T3 — Interface integration

- [x] Extend typed DTOs for status, base price, sale price, currency code and managed media.
- [x] Preserve current product/inventory panels while exposing publication and sale-price controls.
- [x] Replace product base64 persistence with the managed upload adapter.
- [x] Keep failed saves/uploads explicit and never claim publication or persistence prematurely.

### T4 — Gates

- [x] Pass schema adoption, constraint, rollback-refusal and tenant-isolation tests on PostgreSQL.
- [x] Pass authorization, CSRF, throttling, stale revision, malformed money and media tests.
- [x] Prove public catalog filtering and server-derived effective price.
- [x] Pass frontend contract/characterization tests, build, dependency audit and all repository gates.

### T5 — Evidence and delivery

- [x] Record migration, backend, frontend, integration and rollback evidence.
- [x] Obtain independent read-only approval with no blocking findings.
- [x] Commit, push, open PR, pass the four required checks and merge.

## Acceptance criteria

- A published product has a nonblank unique SKU, exact non-negative base price and valid catalog currency.
- A sale price is optional, greater than zero and strictly lower than the base price; clients cannot submit a separate effective price.
- Public responses expose the server-derived effective price and only `published` products.
- Existing WP 3.2 products are adopted as published products with stable IDs and unchanged displayed price/stock.
- Managed upload bodies are bounded image files; base64/data URLs cannot enter product JSON.
- An outsider, suspended member or role missing `tenant.products.manage` cannot mutate catalog data.
- A stale workspace revision produces `409 workspace_revision_conflict`; a stale catalog revision produces `409 catalog_revision_conflict`; neither path partially writes.
- Product removal is an explicit archive command. Missing a product from a bulk payload never deletes or archives it, and WP 4.1 performs no hard product deletion.
- Once the catalog contains a priced product, its currency cannot change through ordinary workspace or catalog writes.
- Stock quantities remain non-negative and server-owned, while reservation/decrement semantics are explicitly deferred to WP 4.2.
- No shopper-facing order endpoint is enabled by this package.

## Required evidence

- Forward migration and deterministic adoption on populated tenant schemas.
- Direct SQL negative tests for lifecycle, currency, money, SKU and media constraints.
- Public-versus-merchant DTO assertions for draft, archived and published products.
- Exact money boundary tests, including zero, two fractional digits and invalid precision.
- Media MIME sniffing, dimensions, size, idempotency, ownership, public-serving, orphan-cleanup and path-isolation tests.
- Sequential and concurrent stale-revision tests with one atomic winner.
- Full local CI parity and protected-branch GitHub evidence.

## Rollback

Before catalog authority is populated, the migration can roll back normally. After products or managed media have been adopted, rollback must refuse rather than erase lifecycle, exact-price or media provenance. Operational rollback keeps the schema and reverts application code until an explicit export/backfill procedure is approved.
