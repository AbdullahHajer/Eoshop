# WP 5.7 — Focused product editor and builder simplification

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.7 |
| Status | Complete and merged |
| Started | 2026-08-20 |
| Branch | `codex/wp-5.7-product-editor` |
| Base | Protected `main` at `ec662b8` |
| Dependencies | WP 3.2–3.3; WP 4.1–4.2; WP 5.5–5.6 |
| Decision | [ADR 0019](../decisions/ADR-0019-focused-product-editor.md) |

## Objective

Give a merchant one focused, truthful place to add and edit products while simplifying the design builder. Preserve the revisioned workspace as the only catalog write authority used by this editor, while retaining the narrower catalog API for authorized catalog-only clients, and keep inventory and orders in their WP 5.6 operational routes.

## Baseline

- `ControlPanel.tsx`: 3,497 lines and contains product, inventory and order implementations.
- The product editor occupies roughly 870 lines and mixes product metadata with inventory mutation controls.
- The builder navigation still exposes order and inventory tabs although route-owned modules now exist.
- The product route provides a server snapshot and opens the builder for authorized edits.

## Scope

- Add a typed focused product editor boundary.
- Preserve search, status, pricing, description, SKU/category, media selection/upload, add and archive actions.
- Make server-owned inventory values read-only in the product editor with a clear handoff to the inventory module.
- Key product mutations by stable ID with controlled App state and collision-safe `draft:${crypto.randomUUID()}` identities that are omitted before server creation.
- Replace misleading local “saved” language with dirty/edit language until workspace save succeeds.
- Remove order and inventory implementations and navigation from the design builder.
- Preserve the read-only product route for catalog-only staff and the complete workspace capability requirement for editing.
- Update characterization tests and dependency-direction checks.

## Out of scope

- Direct product CRUD endpoints, product variants or database migrations.
- Inventory adjustments or policy mutations from the product editor.
- Visual redesign of checkout, pages, branding or storefront.
- Team/profile management and the platform administration console.
- Payment, fulfillment, shipping, returns or advanced analytics.

## Product and safety invariants

- The workspace revision and catalog revision remain mandatory for every save.
- A stale workspace save remains a 409 with the existing explicit recovery flow.
- Existing product removal is archive-on-save; a draft-only product can be removed locally.
- A persisted product is excluded from `products` and included only in `archiveProductIds`; archive intent survives save failure and clears only on success.
- Product status controls public visibility; the browser does not publish a store or bypass publication readiness.
- Inventory quantities and revisions are displayed only when projected by `inventoryView`; otherwise no value or inventory link is invented.
- The inventory handoff is owned by `App`, shown only with `inventoryView` and uses the existing dirty-navigation confirmation.
- Media results are accepted only for the same account, tenant, product and media generation; archive/remove/switch/unmount/conflict reload invalidates them.
- Switching tenant/account or leaving a dirty workspace cannot apply a stale editor result.
- Catalog-only staff never enter the workspace editor.
- A parallel write through the catalog-only API causes `catalog_revision_conflict` and uses the existing explicit 409 recovery flow.

## T0–T5

### T0 — Contract and baseline

- [x] Record the current product/inventory/order builder ownership.
- [x] Accept ADR 0019 editor, persistence and inventory handoff decisions.
- [x] Complete independent design review.

### T1 — Product feature boundary

- [x] Extract product list, filters, form and archive confirmation.
- [x] Preserve media upload and stale-result guards.
- [x] Make inventory projections read-only and link responsibility to the inventory module.

### T2 — Builder simplification

- [x] Remove duplicate order and inventory hooks, panels and navigation from the builder.
- [x] Preserve design, checkout, pages, assistant, export and live preview behavior.
- [x] Keep product read/edit capability separation.

### T3 — Verification

- [x] Cover add, edit, pricing, status, archive and media behavior.
- [x] Cover ID-keyed edits during search/filter, rapid additions and controlled reload after conflict.
- [x] Cover first save of multiple draft-keyed products and replacement by server UUIDs.
- [x] Cover dirty language, save success/failure, retained archive intent and workspace/catalog revision-conflict recovery.
- [x] Cover catalog-only denial and tenant/account stale-result isolation.
- [x] Cover late media results after product archive/store switch and dirty inventory handoff confirmation.
- [x] Preserve existing storefront, portal, operations and workspace characterization.

### T4 — Gates

- [x] Pass frontend tests, production build and dependency audit.
- [x] Pass backend quality, repository safety and isolated container integration.

### T5 — Evidence and delivery

- [x] Record exact evidence and remaining builder debt.
- [x] Obtain final independent read-only approval.
- [x] Commit implementation and evidence separately, push, open PR, pass required CI and merge.

## Acceptance criteria

- The authorized merchant opens a focused product editor from the store product route.
- Product edits remain visibly unsaved until the workspace save response succeeds.
- Inventory is not mutable from the product editor and its dedicated route remains the only operational interface.
- Archiving a persisted product and removing a new draft product preserve the existing server contract.
- Save failure, reservation rejection or catalog revision conflict cannot silently discard archive intent or local edits.
- Orders and inventory no longer appear as duplicate builder tabs.
- Existing merchant lifecycle, public storefront and workspace conflict flows remain green.

## Rollback

No data migration exists. Revert the frontend extraction and restore the former builder sections; workspace, catalog, media and inventory data remain unchanged.
