# ADR 0014 — Server-authoritative orders, pricing snapshots and inventory coupling

- Status: Accepted for WP 4.3
- Date: 2026-08-16
- Depends on: ADR 0012 and ADR 0013

## Context

The current checkout is a browser-only demonstration. It trusts product objects already held by React, calculates coupon, shipping and cash-on-delivery fees in the browser, generates a random order number and displays success without persisting an order. The legacy tenant `orders` table stores a client-supplied total and an opaque `items_json` payload. Neither path is commerce authority.

WP 4.1 established exact server-owned product prices and currency. WP 4.2 established guarded inventory balances and internal atomic reserve, release, commit and expiry primitives. WP 4.3 must compose those authorities without trusting any client total or creating a transaction gap between an order and its inventory reservation.

## Decision

### Authority and legacy isolation

- The server is the only authority for product eligibility, unit price, discount, shipping, fee, tax, currency and total.
- The checkout request contains product IDs and positive quantities only; client prices, names, inventory and totals are ignored or rejected.
- The existing `orders` table is renamed and retained as a read-only legacy archive with `origin=legacy_unverified`. Its original decimal total and `items_json` are preserved byte-for-byte; a deterministic minor-unit projection may support display, but those rows never create reservations, inventory movements or authoritative history because their totals cannot be proven.
- New authoritative tables and API money fields use non-negative integer minor-unit values. The UI alone formats them as decimal currency, so binary floating-point values never cross the pricing contract.

### Pricing formula

The single checkout-policy source is the `config_json` of the one `store_configs.is_current=true` row, and its authority version is that row's existing `revision`. There is no second materialized checkout-policy table. Merchant workspace saving updates the policy JSON and revision atomically in the existing workspace transaction. Catalog authority remains `catalog_settings` and its own revision.

The request carries the public `workspaceRevision` and `catalogRevision` last displayed to the shopper. Within one tenant transaction the service locks the current store-config row, catalog settings and products in canonical UUID order. A revision mismatch returns `409 order_quote_stale` before an order or reservation exists. Only published products are orderable. The effective unit price is the current server sale price when present, otherwise the base price.

Checkout money settings accept no more than two fractional digits. Coupon codes are canonical uppercase identifiers, unique after canonicalization and never receive implicit demonstration fallbacks such as `WELCOME10`. Only explicitly enabled methods/coupons are eligible.

For the MVP percentage coupon policy:

1. `items_subtotal = sum(unit_price_minor * quantity)`.
2. `discount = round_half_up(items_subtotal * coupon_basis_points / 10000)`.
3. `discounted_items = items_subtotal - discount`.
4. The minimum-order rule is evaluated against `discounted_items`.
5. Free shipping is evaluated against `discounted_items`; otherwise the configured flat shipping amount applies.
6. `tax = round_half_up(discounted_items * tax_basis_points / 10000)`.
7. An enabled cash-on-delivery method may add its configured fee. Offline bank or wallet reporting adds no hidden client-controlled fee.
8. `grand_total = discounted_items + shipping + tax + payment_fee`.

Every component, the applied coupon and the normalized checkout-policy revision are copied into immutable order snapshots. Later product or store changes do not rewrite history.

An order accepts at most 50 distinct lines and quantity 1–99 per line. Unit prices already obey the catalog maximum `9,999,999,999` minor units. Checked multiplication/addition runs before every arithmetic operation, and both item subtotal and grand total may not exceed `100,000,000,000,000` minor units. Breach returns `422 order_amount_limit_exceeded`; PostgreSQL uses signed `BIGINT` plus matching non-negative/maximum checks.

### Order lifecycle

Authoritative states are:

- `submitted`: created with an active inventory reservation when at least one line tracks stock.
- `accepted`: merchant accepted the order and any reservation was committed to on-hand stock.
- `processing`: fulfillment started after acceptance.
- `completed`: fulfillment finished.
- `cancelled`: merchant rejected a submitted order and released its reservation.
- `expired`: the system expired a submitted order and released its reservation.

Allowed transitions are `submitted -> accepted|cancelled|expired`, `accepted -> processing|completed`, and `processing -> completed`. Terminal states never transition. Cancellation after inventory commit is intentionally excluded; a future returns/refunds package must model that as a separate compensating business event.

Every transition appends an immutable history row containing a unique positive per-order sequence, previous/next state, actor type/user, reason, request ID and database time. The sequence, rather than wall-clock precision or a random UUID, is the authoritative event order. Exact no-ops do not append history.

### Atomic inventory and idempotency

- Public creation and merchant transition each require a UUID `Idempotency-Key`, a scoped claim and a canonical request fingerprint. System expiry uses a deterministic key derived from the order ID.
- Reusing the same key with the same fingerprint returns the stored original response. Reusing it with different content returns `409` without mutation.
- An order row, its item/address/payment snapshots, its initial history row and the WP 4.2 inventory reservation are committed in one tenant transaction. The order may omit a reservation only when every line has `manage_stock=false`; mixed orders reserve exactly their tracked subset. `allowOrdersWhenOutOfStock` never bypasses WP 4.2 for tracked products.
- Snapshot child inserts are database-guarded by the bound create operation as well as immutable after insertion, so a later transaction cannot append a zero-value item, address or payment attempt to an existing order.
- `orders.reservation_id` has a database foreign key. Deferred database constraints additionally require `reference_type=order`, `reference_id=orders.id::text`, exact product/quantity equality between reservation items and order items whose immutable `tracked_at_submission=true`, and `reservation_id=null` only when every item was untracked.
- The same deferred constraint maps order and reservation state: submitted requires active; accepted/processing/completed require committed; cancelled requires released; expired requires expired. All-untracked orders are the explicit nullable-reservation exception.
- Accept/cancel/expire update the order and commit/release/expire its reservation in that same tenant transaction. There is no order-without-reservation or status-without-inventory window.
- WP 4.2 gains transaction-aware internal methods; public inventory routes remain absent.
- Order reservations are owned by the order expiry workflow. The generic inventory expiry command skips `reference_type=order` to prevent split lifecycle ownership.

### Lock order and concurrency

The fixed creation order is central tenant, order idempotency claim, current store config, catalog settings, inventory operation, products ordered by UUID, then order/items. Merchant transitions add the active membership lock after the central tenant and lock the order before its reservation and products. Concurrent duplicate submissions, accept/cancel races and expiry/accept races therefore have one deterministic winner.

### HTTP and authorization boundaries

- Live checkout exists only on the exact published, runtime-ready tenant host: `POST /api/store/orders`.
- `GET /api/store/config` returns `{data:{workspaceRevision,catalogRevision,config}}`; the public config remains backward-compatible in content but no longer discards the authoritative revisions. The storefront obtains CSRF from `GET /api/auth/csrf` on that same tenant host, using the existing host-only session cookie.
- It is guest-accessible but requires same-origin CSRF, a UUID `Idempotency-Key`, strict body allowlisting, request-size limits and a tenant/IP throttle. Its explicit failure contract includes `409`, `419`, `422`, `429` and checkout-only `503`.
- Builder/template previews remain explicitly non-persistent and must label themselves as previews.
- Merchant list/detail endpoints require `tenant.orders.view`; state mutation requires `tenant.orders.manage` and an active exact-tenant membership rechecked under lock.
- Public responses expose an order number, status and immutable totals but no internal operation IDs, inventory details or merchant-only notes. WP 4.3 exposes no public lookup endpoint; a future lookup must require a separate high-entropy capability token and a reduced projection.
- The frontend central-domain allowlist and tenant base domain are explicit Docker build arguments sourced from deployment environment values; production routing does not rely on Vite development defaults.

### Privacy and payment boundary

- Customer identity, contact, address, notes and offline transfer references are encrypted at the application boundary and are never written to logs.
- Payment state is separate from order fulfillment: `due_on_delivery` for COD or `transfer_submitted_unverified` for an offline bank/wallet report. Payment attempts record only the selected enabled method and an unverified encrypted offline reference. WP 4.3 does not collect card data, call a payment provider or claim that an offline transfer is paid.
- Logging is structured and redacted: tenant, order ID/number, state, operation, actor and request ID only.

### Deployment and rollback

- Order readiness is separate from storefront/runtime readiness. Browsing remains available while an unmigrated checkout returns structured `503 order_checkout_unavailable`; it never falls back to the legacy table.
- An order feature flag remains disabled while expand migrations run across the tenant fleet, then enables the new checkout after readiness verification.
- Existing legacy rows remain preserved in their archive table.
- Down migration succeeds only when no authoritative order operation/order exists. Otherwise it refuses rather than erase order, PII, pricing or inventory history.
- New provisioning automatically receives the latest tenant migrations.

## Out of scope

- Online card processing, payment webhooks, refunds and chargebacks.
- Customer accounts, public order history, shipment carriers and tracking integrations.
- Product variants, multi-warehouse fulfillment and partial shipments.
- Cancelling/restocking accepted orders; this requires an explicit returns model.

## Consequences

- The current visual checkout can be preserved while its success state becomes backed by a durable server response on live storefronts.
- Merchant order management becomes permissioned and auditable.
- More schema and orchestration are required, but price tampering, overselling and ambiguous retries fail closed.

## Rejected alternatives

- Keeping client totals and validating them approximately: rejected because the client remains pricing authority.
- Creating the order and reservation in separate transactions: rejected because crashes produce orphan orders or stock holds.
- Treating old `items_json` rows as authoritative: rejected because their provenance cannot be established.
- Committing stock immediately for every unreviewed order: rejected because spam or abandoned offline-payment orders would consume stock permanently.
