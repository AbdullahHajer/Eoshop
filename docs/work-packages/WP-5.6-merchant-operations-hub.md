# WP 5.6 — Merchant operations hub

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.6 |
| Status | In progress |
| Started | 2026-08-19 |
| Branch | `codex/wp-5.6-merchant-operations-hub` |
| Base | Protected `main` at `7e05ec5` |
| Dependencies | WP 3.1–3.3; WP 4.1–4.3; WP 5.4–5.5 |
| Decision | [ADR 0018](../decisions/ADR-0018-route-owned-merchant-operations.md) |

## Objective

Turn each eligible store into a clear operational workspace. A merchant should enter one store, see its truthful operational state, and reach products, orders, inventory, design and commercial settings through explicit routes instead of discovering them as unrelated tabs inside the visual builder.

## Baseline

- `App.tsx`: 2,746 lines / 137,458 bytes.
- `ControlPanel.tsx`: 3,534 lines / 221,881 bytes.
- `MerchantPortal.tsx`: 393 lines / 24,638 bytes.
- Orders and inventory already have server-authoritative APIs, but their UI is nested inside the design builder.
- The merchant portal exposes lifecycle actions but no dedicated store operations home.

## Scope

- Add a store-level route-owned shell under `/app/stores/{tenant}`.
- Add direct store routes for overview, products, orders, inventory, design, checkout and pages.
- Add real module cards driven by the route/authority matrix in ADR 0018 and server-projected store capabilities.
- Load and present server order and inventory summaries for the exact selected store.
- Add server-projected order `allowedTransitions` and move order orchestration out of `ControlPanel` into a reusable operational boundary.
- Add a focused inventory operations panel using ledger-backed adjustments and policy updates.
- Continue routing products/design/checkout/pages through the existing builder with an explicit initial tab.
- Preserve lifecycle, correction, publication, public-link and dirty-workspace protections.
- Cover direct URL restoration, store switching, stale-response isolation and mutation errors.

## Out of scope

- New commerce tables, new mutation endpoints or database migrations. A narrow order-list DTO extension is in scope.
- Full product editor or settings editor extraction.
- Account profile mutation, team invitations or ownership transfer.
- Revenue analytics not currently owned by a server contract.
- Payment verification, fulfillment, shipping, returns or platform administration.
- Public storefront redesign.

## Product and safety invariants

- Account navigation and store navigation are separate levels.
- A module is never enabled from role names or frontend assumptions; it uses exact server capabilities.
- Order actions come only from server-projected `allowedTransitions`; the frontend does not reconstruct the state machine.
- An unrelated, inactive, suspended or deleted membership cannot load operational data.
- Switching stores aborts or invalidates previous overview, order and inventory requests.
- Order updates preserve one idempotency key per tenant/order/target/reason until confirmed success and never auto-retry an unsafe alternate payload.
- Inventory changes use expected inventory revisions and ledger endpoints only, preserving one key per mutation fingerprint until confirmed success.
- Replayed order/inventory receipts trigger an authoritative reload; reads and mutations are serialized so an older snapshot cannot regress the visible state.
- Design/workspace dirty-state guards remain in force when leaving the builder.
- The overview labels counts as operational snapshots, not analytics.
- An unavailable/denied overview card is never displayed as zero.
- WP 5.6 uses order lists only; customer/address detail is neither requested nor persisted.
- A published link appears only from the exact server-projected public domain.

## T0–T5

### T0 — Contract and baseline

- [x] Record the current portal, builder and operational API baseline.
- [x] Accept ADR 0018 route, permission and state-ownership decisions.
- [x] Complete independent design re-review after incorporating the route/capability, transition and retry findings.

### T1 — Store operations shell

- [x] Add deterministic store-level route parsing and direct-entry restoration.
- [x] Add store header, lifecycle context, public-link action and module navigation.
- [x] Keep account/store selection and logout behavior coherent.

### T2 — Operational modules

- [x] Add order summary/list/actions through the existing order API and state machine.
- [x] Add inventory summary/adjustment/policy actions through ledger-backed APIs.
- [x] Route product reads to their own summary and product edits, design, checkout and pages into the existing builder.
- [x] Remove duplicate order orchestration from `ControlPanel`.

### T3 — Verification

- [x] Cover route parsing, reload/direct entry and unauthorized module recovery.
- [x] Cover the route × capability × lifecycle matrix for owner and narrower staff permissions.
- [x] Cover loading, empty, error, stale response and store-switch states.
- [x] Cover order idempotency and inventory revision conflicts without false success claims.
- [x] Cover reversed response order during store/account switches and exact 401/403/404/409 handling.
- [x] Preserve existing builder, draft, publication and storefront characterization.

### T4 — Gates

- [x] Pass frontend tests, production build and dependency audit.
- [x] Pass backend quality, repository safety and isolated PostgreSQL/container integration.
- [x] Complete a local browser smoke path for store overview, products, orders, inventory and design.

### T5 — Evidence and delivery

- [x] Record exact evidence and remaining extraction debt.
- [x] Obtain final independent read-only approval.
- [ ] Commit implementation and evidence separately, push, open PR, pass required CI and merge.

## Acceptance criteria

- A merchant can open a store operations home from `/app` and return without losing lifecycle context.
- Refreshing a direct store-module URL restores the exact store and module after session validation.
- Products, orders, inventory, design, checkout and pages have explicit destinations and capability-aware states.
- Orders can be viewed and advanced only through allowed server transitions; failures remain visible and retryable with the same key.
- Inventory displays on-hand, reserved and available quantities and records adjustments through the ledger API.
- Rapid store switching cannot render data from the previous tenant.
- No module claims success before its server response, and no presentation component recreates authorization rules.
- Existing draft, correction/resubmission, publication and public storefront flows remain green.

## Rollback

WP 5.6 has no data migration. Reverting the route-owned operations shell and the additive order `allowedTransitions` projection restores the WP 5.5 portal and builder without changing central or tenant data. Existing durable operations remain compatible.
