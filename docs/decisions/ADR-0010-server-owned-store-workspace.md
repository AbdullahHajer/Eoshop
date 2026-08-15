# ADR 0010 — Server-owned store workspace

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-15 |
| Decision owners | Eoshop engineering |

## Context

Authentication, platform administration, provisioning, domains and subscriptions are already server-owned. The builder still treats `mobtaker_custom_store` in `localStorage` as the durable source for store presentation, products, prices and inventory. That state is device-local, user-controlled and can silently diverge from the published tenant schema.

## Decision

Laravel and the tenant schema become the authoritative store workspace.

1. The central application exposes authenticated merchant workspace read and update endpoints. They resolve an exact active tenant membership and then execute against that tenant's schema; callers never choose a database or schema.
2. A workspace is editable after review approval and successful technical provisioning. Publication is not required, so a merchant can prepare the store before it becomes public. Missing, foreign, incomplete or unowned schemas fail closed.
3. Store presentation remains in one current `store_configs` JSON document. Products, prices and inventory are materialized in the tenant `products` table and are composed into the workspace response. New writes do not duplicate products inside the configuration JSON.
4. Existing provisioned stores remain readable from their legacy `config_json.products`. Their first successful server save materializes those products atomically. The migration is therefore gradual and does not require rebuilding stores.
5. Every workspace carries a monotonically increasing revision. Updates lock the current configuration row and require the client's revision; stale writes return `409` and never overwrite a newer edit.
6. The selected plan's `max_products` entitlement is enforced on the server. Product identifiers are server UUIDs; browser preset identifiers are treated as draft-only and replaced when first persisted.
7. The public storefront reads through the same composition service. The old tenant-host configuration mutation is removed so there is one writer and one authorization contract.
8. The browser may retain only an unpublished local draft, the non-sensitive selected-tenant preference and the provisioning idempotency recovery record. It must not write authenticated workspace edits to browser storage or use browser data as proof of identity, membership, publication, price or inventory.
9. A local draft is never silently merged into server state. Import requires an explicit merchant action and the current server revision; conflicts preserve both the server copy and the local draft.
10. Image upload/object storage is not introduced here. Workspace media fields accept bounded HTTP(S) URLs (and the existing small icon text); data/blob URLs and oversized values remain local-draft-only until a media work package supplies managed storage.
11. A workspace PATCH is an accepted write checkpoint and always advances the revision, even when the submitted values are semantically unchanged. Validation, authorization, entitlement and stale-revision failures advance nothing.
12. Deployment is ordered: release legacy-compatible backend composition, preflight the platform-owned tenant fleet, migrate every tenant schema, then activate the frontend. Runtime readiness checks the new columns and current-row invariant, so a missed or foreign schema remains unavailable rather than falling back to central data.
13. Workspace conflicts expose stable machine codes. Only a stale revision enters recovery; recovery performs a three-way top-level merge, never overwrites a field changed by both writers, and retains both conflicting values until an explicit merchant decision.

## Consequences

- The same account sees the same saved workspace on another browser or device.
- Published presentation, product prices and displayed inventory come from the tenant database rather than mutable browser storage.
- The aggregate save is restricted to a merchant with both store-settings and product-management authority; later product-specific APIs can expose narrower staff workflows.
- Order creation remains disabled. Server-owned display data does not yet constitute order pricing, stock reservation or checkout authority; those belong to Phase 4.
- Tenant-database writes cannot be atomically combined with the central audit database. WP 3.2 therefore records request correlation in application logs and leaves a durable cross-database merchant activity outbox to a later package.

## Alternatives rejected

### Keep `localStorage` and periodically upload it

Rejected because the browser would remain the source of truth and last-writer-wins uploads could overwrite changes from another device.

### Store products only inside configuration JSON

Rejected because product price, SKU and stock need constrained, queryable server records for Phase 4.

### Require publication before editing

Rejected because review, provisioning, workspace preparation and public publication are deliberately independent lifecycle stages.

## Rollback

Frontend rollback may return to local drafts without deleting server data. Database rollback is allowed only before any workspace is materialized. Once a tenant has server-materialized products, rollback must use an explicit export/backfill procedure rather than dropping revision or materialization metadata.
