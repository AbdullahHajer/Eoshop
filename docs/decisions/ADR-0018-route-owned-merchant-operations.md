# ADR 0018 — Route-owned merchant operations

## Status

Accepted for WP 5.6.

## Context

The delivered merchant portal explains store lifecycle correctly, but routine operations still send an owner into one oversized design builder. Products, inventory, orders, checkout settings and visual design appear as peer tabs inside that builder even though they have different permissions, loading contracts and operational importance. This makes the product feel like a prototype and prevents narrower merchant roles from reaching the server capabilities they actually own.

The server already owns the catalog, inventory ledger, order state machine, workspace and publication contracts. WP 5.6 must improve product navigation without duplicating those rules or rebuilding the commerce core.

## Decision

1. `/app` remains the account-level merchant portal and store lifecycle surface.
2. `/app/stores/{tenant}` becomes the store-level operations home.
3. Orders and inventory become route-owned operational modules that call their existing typed APIs directly and do not require opening the design builder.
4. Products receive a route-owned read summary; their explicit edit action, plus visual design, checkout and pages, continue to use the delivered builder coordinator during this incremental step.
5. The store projection's server-owned capabilities decide whether a module is visible, viewable or mutable. Routes and buttons never widen authorization.
6. Direct URL entry must restore the authenticated account, locate the exact store and either open the permitted module or fail closed with a clear recovery path.
7. Module requests use abort/latest-operation guards. A response from a previously selected store must never overwrite the current store.
8. Order list DTOs expose `allowedTransitions` from the server. React renders those transitions and never duplicates the order state machine. WP 5.6 remains list-only and does not fetch customer/address detail or persist order PII in browser storage or logs.
9. Order transition idempotency remains stable for the tuple tenant/order/target/reason across an ambiguous failure and changes only after confirmed success.
10. Inventory adjustments remain ledger operations using expected per-product revisions; the operations UI owns one idempotency key per mutation fingerprint until confirmed success and never writes absolute stock through workspace metadata. A 409 is surfaced for reload/manual reconciliation and is never replayed automatically.
11. Every module load has an abort signal and a tenant+module sequence. Results apply only when both still match the visible route.
12. The operations overview loads only authorized cards independently. A denied or failed card is unavailable, never coerced to zero.
13. Direct routes are canonical under `/app/stores/{tenant}`. Unknown/malformed tenants or modules expose no previous-store data and return the user safely to `/app`; 401 clears tenant-owned state, while 403/404 remain non-destructive access/not-found states.
14. A replayed mutation receipt is historical evidence, not necessarily the latest projection. Order and inventory modules reload the authoritative snapshot before applying a replay, and serialize refresh/mutation activity so an older read cannot overwrite a newer result.

## Route and authority matrix

| Route | Lifecycle visibility | Read authority | Mutation authority | Destination |
|---|---|---|---|---|
| `/app/stores/{tenant}` | Any store returned by the active-membership merchant list | Active exact membership | None | Operations/lifecycle overview |
| `/products` | Approved + provisioned + operationally ready | Active exact membership through catalog GET | `catalogManage`; aggregate builder editing additionally requires `workspaceManage` | Read summary or existing products tab |
| `/orders` | Approved + provisioned + operationally ready | `ordersView` | `ordersManage` plus server-projected transition | Route-owned order module |
| `/inventory` | Approved + provisioned + operationally ready | `inventoryView` | `inventoryManage` | Route-owned inventory module |
| `/design` | Approved + provisioned + workspace ready | `workspaceManage` | `workspaceManage` | Existing design tab |
| `/checkout` | Approved + provisioned + workspace ready | `workspaceManage` | `workspaceManage` | Existing checkout tab |
| `/pages` | Approved + provisioned + workspace ready | `workspaceManage` | `workspaceManage` | Existing pages tab |

Rejected, pending, suspended, failed or not-materialized stores may open only the store overview and their lifecycle action. Operational endpoints remain fail-closed.

## Consequences

- Merchants gain one predictable store home and direct links to routine work.
- Orders and inventory are no longer visually subordinate to design customization.
- Existing catalog/workspace behavior remains compatible while later work packages extract product and settings editors.
- `App.tsx` retains orchestration temporarily, but route parsing and operational presentation move to feature boundaries.
- This package adds no database migration. Its narrow order-resource projection can be reverted with the frontend shell.

## Deferred

- Full product-editor extraction from `ControlPanel`.
- Account profile editing, invitations and ownership transfer.
- Revenue analytics, payment verification, fulfillment, shipping and returns.
- Platform administration-console redesign.
