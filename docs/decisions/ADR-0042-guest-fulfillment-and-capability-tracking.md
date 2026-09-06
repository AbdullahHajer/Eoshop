# ADR 0042 — Guest fulfillment and capability tracking

- Status: Accepted for WP 5.28B
- Date: 2026-09-06
- Depends on: ADR 0013, ADR 0014 and WP 5.28A

## Context

Eoshop already owns prices, orders, inventory reservations and merchant order transitions on the server. `OrderStatus` describes the commercial order, but it cannot honestly prove when a parcel left for delivery or when the customer received it. The public receipt also has no secure way to reopen an order after checkout. Requiring a customer account would expand V1, while lookup by order number or phone would permit enumeration and expose personal data.

## Decision

### Separate fulfillment authority

`OrderStatus` remains the commercial lifecycle. A tenant-owned fulfillment aggregate adds `unfulfilled`, `preparing`, `dispatched` and `delivered`. `legacy_completed` is an internal terminal adoption state for orders completed before this contract; it is never produced by a live mutation and never represented as proof of delivery.

The supported V1 sequence is:

1. checkout creates `submitted + unfulfilled`;
2. merchant acceptance commits the existing inventory reservation and produces `accepted + unfulfilled`;
3. starting fulfillment atomically produces `processing + preparing`;
4. dispatch produces `processing + dispatched`;
5. delivery confirmation atomically produces `completed + delivered`.

The general status writer no longer creates `processing` or `completed`. A dedicated fulfillment writer owns those coupled transitions. Cancellation and system expiry remain limited to `submitted`; cancellation after committed stock, returns, partial fulfillment and refunds remain outside V1.

Every fulfillment change appends an immutable, ordered event. Coupled order and fulfillment changes share one idempotent operation and database transaction. Deferred constraints verify the current aggregate against both histories. Existing `processing` rows adopt `preparing`; existing `completed` rows adopt `legacy_completed` with an explicit system adoption event, not a fabricated dispatch or delivery.

### Bearer capability

Every new order receives a versioned bearer capability containing 256 random bits. The tenant schema stores only its SHA-256 digest for lookup and an application-encrypted copy required to reproduce the exact same checkout response on an idempotent replay. The raw capability is never stored in the immutable order-operation result.

The browser URL uses `/track#token=<capability>`. URL fragments are not sent in HTTP requests. The client submits the capability in a dedicated request header to a fixed same-origin tracking endpoint; it is never placed in an HTTP path or query, browser storage, analytics attributes or visible page text. Responses use private no-store/no-referrer protections.

Missing, malformed, forged, cross-tenant and expired capabilities share one 404 contract. The public reader returns only order number, current commercial and fulfillment states, public stage timestamps and last update. It never reuses the merchant resource and never returns PII, order UUID, line items, totals, coupons, payment data, actor IDs, operation IDs or internal reasons.

The capability remains valid while the order is active. Once delivered, cancelled or expired it remains valid for 90 days from the authoritative terminal timestamp; reads do not extend this window. There is no rotation or recovery-by-order-number in V1.

### Continuity after unpublish

An existing customer must not lose tracking because a merchant temporarily unpublishes the catalog or a subscription expires. Tracking therefore uses a dedicated exact-domain tenancy boundary: the host must still be the tenant's recorded published domain, the schema and order-tracking tables must be operational, and the domain must not have been reassigned. It does not require the catalog to be currently published and does not depend on `ORDER_CHECKOUT_ENABLED`. Unknown, central or reassigned hosts fail closed.

### Merchant and client surfaces

The existing `tenant.orders.view` permission exposes fulfillment facts and history. `tenant.orders.manage` is required and rechecked under lock for the single allowed next mutation. The public receipt exposes the private link only after a real server-created order; previews and legacy receipts do not invent one. The tracking page renders recorded events only, supports manual refresh, and makes no carrier, ETA or live-location claim.

## Consequences

- Revenue-defining `completed` is produced for new orders only with authoritative `delivered` evidence.
- Inventory remains committed after acceptance; later fulfillment transitions never decrement or release it again.
- Idempotent checkout can reproduce one stable private link without plaintext token persistence.
- Tracking continues independently of catalog publication but remains bound to the original tenant host and schema.
- A separate aggregate, events table, capability table, middleware and tests are required.

## Rejected alternatives

- Reinterpreting all historical `completed` rows as delivered: rejected because it fabricates evidence.
- Adding shipping meanings directly to `OrderStatus`: rejected because commercial and fulfillment states have different transition needs.
- Lookup by order number, phone or email: rejected because identifiers are guessable and expose personal data.
- Token in path or query: rejected because it reaches server and proxy URLs and can leak through logs or referrers.
- Storing the raw token in `order_operation_results`: rejected because that table is plaintext JSON and immutable.
- Expiring active-order links after a fixed issue date: rejected because a delayed order could become untrackable before delivery.
- Customer accounts, carrier integration and live polling: rejected as unnecessary expansion of V1.

## Deployment and rollback

Deploy with checkout disabled while tenant migration `000010` expands every schema and backfills explicit adoption states. Deploy compatible backend and frontend, verify a canary tenant, then re-enable checkout. Once fulfillment or guest-access evidence exists, down migration refuses destructive rollback; operational rollback keeps the schema/data and disables new checkout or UI entry points while a forward fix is applied.
