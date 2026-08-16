# ADR 0012 — Server-owned catalog, exact pricing and managed media

- Status: Accepted for WP 4.1 implementation
- Date: 2026-08-16
- Depends on: ADR 0010 and WP 3.2

## Context

WP 3.2 made product rows server-owned, but preserved the original workspace-shaped contract: one decimal `price`, implicit publication, image URLs inside product JSON and stock fields edited alongside page design. That was the correct migration bridge, not a sufficient commerce model. Orders and inventory movements must not be built on an ambiguous price or publication contract.

## Decision

### Catalog boundary

Each tenant schema owns exactly one catalog settings row. It carries the catalog revision and a three-letter uppercase ISO currency code. Product and media rows belong only to that tenant schema; central tables never contain tenant catalog bodies.

WP 4.1 exposes a dedicated catalog API whose writes require active membership plus `tenant.products.manage`, without requiring store-configuration permission. The current workspace endpoint remains a compatibility composition boundary for owners that hold both store and product permissions. It delegates product validation and persistence to the same catalog service inside one tenant transaction. This avoids a non-atomic two-request save while making the product-only role usable.

Workspace and catalog revisions are independent. A composite read returns both. A composite write locks the workspace row and catalog row in that order, verifies both expected values before any mutation, and increments only the aggregate that changed. A stale workspace value returns `workspace_revision_conflict`; a stale catalog value returns `catalog_revision_conflict`. The dedicated catalog API reads and checks only the catalog revision after the central tenant/membership locks.

### Product lifecycle

Products have `draft`, `published` or `archived` status.

- `draft` is editable and never public.
- `published` is public only when the tenant publication/runtime boundary is also ready.
- `archived` is retained for history and never public.

Existing materialized products are adopted as `published` to preserve storefront behavior. Missing legacy SKUs receive deterministic migration-only SKUs derived from their stable UUIDs. New writes require a nonblank SKU before publication.

The allowed lifecycle is `draft → published|archived`, `published → draft|archived`, and `archived → draft`. There is no hard delete in WP 4.1. Archive is an explicit command or explicit product state; omission from a bulk payload leaves the stored product unchanged.

### Exact pricing

The authoritative values are `base_price_minor` and optional `sale_price_minor`, stored as integers. HTTP write contracts use canonical decimal strings with no exponent notation and at most two fractional digits for the WP 4.1 currencies (`YER`, `SAR`, `USD`). Conversion is string-based; binary floating-point is not authoritative.

The sale price, when present, must be greater than zero and strictly less than the base price. The effective public price is `sale_price_minor ?? base_price_minor` and is always composed by the server. The legacy `price` field is a read-only effective-price projection for current UI compatibility; sending it cannot override the base/sale decision.

### Currency

The server stores one catalog currency code. `config.currency` becomes a server-derived compatibility projection, not an independent write authority. The interface may display a localized symbol, but the code is the persisted authority. Legacy values are adopted deterministically: known Saudi symbols/codes map to `SAR`, dollar symbols/codes to `USD`, and known Yemeni symbols/codes to `YER`. Unknown populated values make migration/adoption fail closed instead of guessing. Once any priced product exists, ordinary writes cannot change the currency; currency conversion requires a future explicit operation. Plan/subscription currency is unrelated and is never used as catalog currency.

### Media

Product media are ordered records. A record is either:

- a managed asset with a configured disk, generated path, MIME type, byte size and checksum; or
- an adopted HTTPS source URL retained for compatibility.

Uploads require authentication, active tenant membership and `tenant.products.manage`, plus an `Idempotency-Key`. The server MIME-sniffs JPEG, PNG or WebP content, limits files to 5 MiB and 25 megapixels, rejects malformed images, generates tenant-prefixed paths and never accepts caller paths. A repeated key with the same actor and checksum returns the same asset; reusing the key for different content returns `409 media_idempotency_conflict`. The service compensates a failed database insert by deleting the newly written file.

Unattached managed assets are private to authorized tenant members and cannot appear in public composition. Public serving requires an attached media row, a published product, a runtime-ready tenant and an exact registered tenant host (or authenticated central preview). Physical deletion is conservative: transactional catalog writes detach records but do not delete files. A cleanup command may claim an unattached asset only after 24 hours, under a row lock, after validating the configured disk and tenant path prefix. The claim is persisted as `cleanup_started_at` before physical deletion; catalog writes refuse to attach a claimed asset. A failure before physical deletion retains both row and file. A process or database failure after physical deletion retains the cleanup tombstone, and the next run converges by removing that tombstone after confirming the file is absent. Suspended but safely provisioned tenant schemas remain eligible for maintenance cleanup, and no cleanup path may escape the tenant prefix.

### Inventory boundary

`stock_quantity`, `manage_stock` and `low_stock_threshold` remain authoritative tenant fields with non-negative constraints. WP 4.1 does not promise reservation, decrement, return or oversell protection. Those operations require the append-only `inventory_movements` ledger and locking rules in WP 4.2. WP 4.1 exposes no shopper order mutation.

### Authorization and concurrency

Merchant reads require an active exact-tenant membership. Catalog writes and uploads additionally require `tenant.products.manage`; workspace writes continue to require both store and product permissions. Central lock order remains tenant, membership, publication/subscription/plan, then tenant workspace row, catalog row and product/media rows. Both expected revisions are checked before mutation. All catalog products, settings and media associations for a composite workspace save commit or roll back together.

### Public projection

The public storefront projection is read in one repeatable-read snapshot. It exposes only published products, ordered media URLs, catalog currency and server-derived effective prices. Draft/archived rows, storage paths, checksums, uploader identifiers, base64 bodies and internal revision metadata are not public.

## Consequences

- WP 4.2 and WP 4.3 receive an unambiguous product and money foundation.
- Existing UI can migrate without a redesign or a split-brain save.
- Managed local storage can later move to S3-compatible storage by configuration without changing catalog rows.
- Product variants remain deferred; stable product IDs and normalized media avoid blocking their later introduction.
- Rollback becomes fail-safe once exact-price/media adoption is authoritative.
