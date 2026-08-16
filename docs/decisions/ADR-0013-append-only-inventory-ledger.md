# ADR 0013 — Append-only inventory ledger and reservation boundary

- Status: Accepted for WP 4.2 implementation
- Date: 2026-08-16
- Depends on: ADR 0012 and WP 4.1

## Context

WP 4.1 established server-owned product identity, lifecycle and exact pricing, while intentionally retaining `products.stock_quantity` as a simple non-negative snapshot. The catalog and workspace writers can still overwrite that snapshot directly. That bridge cannot provide an audit trail, safe reservations or protection against two concurrent consumers taking the last unit.

WP 4.2 must establish inventory authority without enabling shopper order creation. Pricing snapshots, customer checkout, order records and order-to-reservation references remain WP 4.3 responsibilities.

## Decision

### Balance model

For a tracked product:

- `stock_quantity` is the authoritative on-hand snapshot.
- `reserved_quantity` is the authoritative active hold snapshot.
- `available_quantity = stock_quantity - reserved_quantity` is always derived by the server.
- `inventory_revision` is an optimistic concurrency token independent from catalog and workspace revisions.

PostgreSQL enforces `stock_quantity >= 0`, `reserved_quantity >= 0` and `reserved_quantity <= stock_quantity`. An untracked product retains its physical snapshot for later reactivation, but its public `availableQuantity` is `null`. A product cannot disable tracking, archive, or reduce on-hand below reserved stock while an active hold exists.

`manage_stock` and `low_stock_threshold` also belong to the inventory boundary. A policy change passes through the inventory service, records an immutable `inventory_policy_changes` row and increments `inventory_revision`, but creates no quantity movement. Catalog/workspace payloads may echo equal inventory projections for compatibility; a different on-hand, tracking or threshold value returns `409 inventory_adjustment_required`. New-product creation is the sole catalog path allowed to supply an opening quantity and policy.

### Single mutation authority

All changes to existing on-hand or reserved quantities pass through one inventory service. Catalog and workspace writes treat existing stock quantities as read-only and return `409 inventory_adjustment_required` if a caller attempts an absolute overwrite. A new product may declare an opening balance; the catalog service delegates its opening movement to the same inventory authority inside the product transaction.

Database triggers reject a product balance or `inventory_revision` update unless the transaction identifies an inventory operation through transaction-local `eoshop.inventory_operation_id` and an append-only movement for the same product exactly matches the old values, deltas, resulting values and revision transition. Mutation order is: insert immutable operation, lock products in UUID order, calculate balances, insert movements carrying before/delta/after values, set the transaction-local operation ID, then update product snapshots and revisions. The trigger verifies `before = OLD`, `delta = NEW - OLD`, `after = NEW` and the matching operation/product before accepting the update.

Policy updates use the same transaction-local operation ID. A separate trigger rejects changes to `manage_stock`, `low_stock_threshold` or their inventory revision unless one immutable `inventory_policy_changes` row for that operation/product exactly records old policy, new policy and revision transition. Quantity and policy endpoints are separate, so one product revision increment has exactly one matching movement or policy record.

New-product opening has an explicit sequence because the movement foreign key requires the product row: insert opening operation, insert the product temporarily at zero on-hand/reserved with inventory revision 1, insert its opening movement with before `(0,0)` and after `(opening,0)`, set the operation ID, then update the on-hand snapshot while keeping opening revision 1. Existing-product migration adoption inserts the same logical opening movement against the already preserved snapshot. A deferred constraint trigger requires every newly inserted product to have exactly one matching opening movement before commit.

Opening operations use UUIDv5 keys derived from `current_schema + product_id` in the fixed Eoshop inventory namespace. Migration adoption and post-migration product creation use the same helper and therefore converge on exactly one opening operation per product.

### Operations and movements

`inventory_operations` is an immutable command header. It stores a UUID, idempotency scope and key, canonical request fingerprint, operation kind, actor type, actor identifier when applicable, source, reason, bounded note, request ID and timestamp.

`inventory_movements` is an append-only child ledger. Every row stores product, optional reservation, movement kind, before balances, signed `on_hand_delta`, signed `reserved_delta`, resulting on-hand/reserved balances and timestamp. There is at most one movement per operation/product. Reservation movements use a composite foreign key `(reservation_id, product_id)` to an actual reservation item. PostgreSQL rejects updates and deletes of operation, movement, reservation-item and policy-change history.

Manual movement kinds are `opening`, `receive`, `issue`, `return` and `correction`. Reservation movement kinds are `reserve`, `release`, `commit` and `expire`:

- reserve: reserved increases; on-hand is unchanged;
- release/expire: reserved decreases; on-hand is unchanged;
- commit: on-hand and reserved decrease by the same quantity.

Only `opening` may carry `(0, 0)`, which is required to adopt zero-stock and untracked products. `receive` and `return` have positive on-hand delta; `issue` has negative on-hand delta; `correction` has a non-zero signed on-hand delta; reserve has positive reserved delta; release/expire have negative reserved delta; commit has equal negative on-hand and reserved deltas. Database checks enforce these signs and the resulting balance equations.

The ledger is the durable audit record. Application logs carry only redacted operation/request correlation metadata and never inventory payload bodies.

### Reservation boundary

A reservation has immutable identity, reference, expiry and product items. Every item quantity is a positive integer and `(reservation_id, product_id)` is its primary key, preventing duplicate products. A deferred constraint trigger rejects an empty reservation at commit. Only reservation state, `terminal_operation_id` and `terminal_at` are mutable. Its state is `active`, then exactly one of `committed`, `released` or `expired`; PostgreSQL enforces that active rows have no terminal fields and terminal rows have both. Each terminal operation points back to the same reservation, and a unique terminal operation prevents double finalization. Creation locks all referenced products in stable UUID order and either reserves every item or none. Terminal transitions lock the reservation before the same sorted product set.

`expires_at` is a required UTC `timestamptz`, calculated against PostgreSQL `CURRENT_TIMESTAMP`. New holds must expire between one and thirty minutes after database time. The expiry command derives a deterministic UUIDv5 idempotency key from `reservation_id + expire`; repeated workers converge on the same terminal result.

The reservation service is internal-only in WP 4.2. No shopper reservation, cart, checkout or order route is exposed. WP 4.3 may call the service with its own reference after establishing server-side pricing and order idempotency.

Expired holds are released by an idempotent command using bounded batches and `SKIP LOCKED`. Maintenance remains allowed for safely provisioned suspended tenants so a suspension cannot strand inventory holds.

### Idempotency and concurrency

Every mutation has an `Idempotency-Key`. The key is unique within a stable actor/system scope and operation kind. The canonical payload fingerprint is stored with the operation. A repeat with the same fingerprint reconstructs the original movement result; reuse with different content returns `409 inventory_idempotency_conflict`.

Merchant lock order is central tenant, membership, then tenant reservation header when present, then product rows sorted by UUID. Availability is checked only after `FOR UPDATE`; there is no check-then-update path. Concurrent requests for the final unit therefore have exactly one winner.

### Authorization

Inventory has separate tenant permissions:

- `tenant.inventory.view` for balances and history;
- `tenant.inventory.manage` for manual adjustments.

System owner and staff roles receive both permissions during adoption. Merchant HTTP mutations additionally require an active exact-tenant membership, CSRF protection and throttling. Internal reservation and expiry calls use an explicit `system` actor marker rather than impersonating a user.

### Read models

Merchant inventory responses expose on-hand, reserved, available, tracking state, threshold, inventory revision and paginated redacted movement history. Merchant workspace/catalog product DTOs carry `stockQuantity` as the on-hand compatibility projection plus explicit `reservedQuantity`, `availableQuantity` and `inventoryRevision`; stale echoed projections can never write a balance. Public product composition keeps legacy `stockQuantity` only as the server-derived available quantity, exposes `availableQuantity`, and never exposes on-hand, reserved, movement, actor or reservation data. Reads use one repeatable-read snapshot.

### Merchant HTTP contract

- `GET /api/merchant/stores/{tenant}/inventory` returns one repeatable-read balance snapshot.
- `GET /api/merchant/stores/{tenant}/inventory/movements` returns bounded page-based history, optionally filtered by product.
- `POST /api/merchant/stores/{tenant}/inventory/adjustments` accepts `lines[]` of `{productId, expectedInventoryRevision, movementKind, delta}`, a required reason code and optional bounded note. `movementKind` is one of `receive`, `issue`, `return` or `correction`; receive/return require a positive delta, issue a negative delta and correction any non-zero signed delta. Product IDs must be distinct, and all lines commit or roll back together.
- `PATCH /api/merchant/stores/{tenant}/inventory/products/{product}/policy` accepts `expectedInventoryRevision`, `manageStock` and `lowStockThreshold` and records an immutable policy change.

Both mutations require a UUID `Idempotency-Key`. Machine conflicts are `inventory_revision_conflict`, `inventory_insufficient_available`, `inventory_tracking_conflict`, `inventory_adjustment_required`, `inventory_product_missing`, `inventory_idempotency_conflict` and `inventory_not_ready`. Validation remains `422`; authentication/authorization/CSRF/throttling remain `401/403/419/429`.

## Consequences

- Stock adjustments become auditable and replay-safe.
- WP 4.3 receives atomic reserve/release/commit primitives without prematurely exposing checkout.
- Existing absolute-stock UI actions must become explicit server adjustments with conflict recovery.
- Migration creates deterministic opening operations and movements for every existing product, including zero and untracked products.
- Rollback refuses once any post-adoption operation, reservation or revision exists; operational rollback preserves the ledger and reverts application code only.
