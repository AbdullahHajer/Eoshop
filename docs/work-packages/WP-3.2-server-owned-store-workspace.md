# WP 3.2 — Replace browser storage with server-owned store data

| Field | Value |
|---|---|
| Phase | Phase 3 — Connect the interface to the backend |
| Work Package | WP 3.2 |
| Status | Implementation and gates complete; delivery pending |
| Started | 2026-08-15 |
| Branch | `codex/wp-3.2-server-owned-state` |
| Base | Protected `main` at `d2eb1892` |
| Dependencies | WP 1.2–1.3; WP 2.1–2.3; WP 3.1 |
| Decision | [ADR 0010](../decisions/ADR-0010-server-owned-store-workspace.md) |

## Objective

Make the tenant database the durable source for store presentation, products, prices and inventory while preserving the current builder and allowing safe unpublished local drafts.

## Scope

- Authenticated central merchant workspace read/update APIs with exact tenant authorization.
- Tenant workspace readiness independent of public publication.
- Revision-based optimistic concurrency and atomic configuration/product saves.
- Backward-compatible reading and first-write materialization of legacy `config_json.products`.
- Server enforcement of product limits and bounded configuration/product validation.
- Public storefront reads from the same server composition path.
- Frontend workspace DTOs, server load/save, explicit local-draft import and multi-device recovery.
- Removal of authenticated business-state writes to `mobtaker_custom_store`.

## Out of scope

- Orders, server-calculated checkout totals, stock reservations and payment processing (Phase 4).
- Product variants, media upload/object storage and image transformation.
- Autosave, offline mutation queues or collaborative real-time editing.
- Screen redesign or decomposition of the large React components (WP 3.3 / Phase 5).
- Product-specific staff workflows; the aggregate workspace writer requires both relevant tenant permissions.

## T0–T5

### T0 — Contract and baseline

- [x] Inventory remaining browser business state and existing server data paths.
- [x] Define authority, readiness, legacy adoption, conflict and rollback contracts.
- [x] Complete early independent design review.

### T1 — Tenant data contract

- [x] Add workspace revision/materialization metadata and product media fields.
- [x] Implement fail-closed workspace readiness and one tenant composition service.
- [x] Preserve legacy configuration reads and atomically materialize products on first save.

### T2 — Protected server APIs

- [x] Add merchant workspace read/update resources and bounded request validation.
- [x] Enforce membership, permissions, revision and plan product limits.
- [x] Remove the duplicate tenant-host writer and use the shared service for public reads.

### T3 — Interface migration

- [x] Add typed workspace service and strict DTO mapping.
- [x] Restore merchant stores/workspace from the server after authentication.
- [x] Save authenticated edits to the server and keep local drafts only when no editable workspace exists.
- [x] Require explicit import for a pre-existing local draft and preserve it on conflict/failure.

### T4 — Gates

- [x] Prove tenant isolation, authorization, readiness and central-context restoration.
- [x] Prove legacy adoption, UUID replacement, product limits, transaction rollback and stale-revision `409`.
- [x] Prove public reads and cross-device reload return the same saved data.
- [x] Prove local drafts are not silently uploaded or erased and authenticated edits are not written locally.
- [x] Pass frontend tests/build, backend quality, PostgreSQL integration and repository safety.

### T5 — Evidence and delivery

- [x] Record verification evidence and rollback observations.
- [x] Complete independent read-only review with no blocking findings.
- [ ] Commit, push, open PR, pass the four required checks and merge.

## Acceptance criteria

- An authenticated merchant can open the same provisioned workspace from a second browser and see the same saved configuration and products.
- A merchant cannot read or update another tenant, and inactive memberships fail closed.
- Two editors using the same revision cannot silently overwrite each other; the second save receives `409`.
- A legacy provisioned store remains readable before its first save and is materialized without duplicate products.
- A failed product/config save changes neither configuration nor product rows.
- The public store reads the server-owned composition and no protected tenant-host configuration writer remains.
- No identity, permission, price, inventory or authenticated workspace record is authoritative in `localStorage`.

## Risks and controls

- **Lost updates:** locked revision comparison and atomic revision increments.
- **Cross-tenant access:** central route model binding plus exact membership/permission checks and deterministic schema readiness.
- **Legacy data loss:** read-through compatibility followed by transactionally checkpointed first-write materialization.
- **Oversized/unmanaged media:** bounded URL-only media fields; local drafts retain unsupported images until media storage exists.
- **Plan bypass:** server derives the current plan and enforces `max_products`; the client never submits entitlements.
- **False commerce authority:** order mutation remains disabled until Phase 4 owns pricing and stock reservation.

## Rollback

Before materialization, the tenant migration can be rolled back normally. After materialization, the migration refuses destructive rollback; an explicit export/backfill must first embed product records into a compatible document. Frontend rollback does not delete any server workspace and local drafts are never cleared until a confirmed server save/import.

Deployment order is backend code capable of legacy composition, tenant fleet preflight, `tenants:migrate` across every platform-owned schema, then frontend activation. New provisioning always runs the latest tenant migrations and materializes the submitted workspace before activation. Every accepted PATCH, including a semantic no-op, advances the revision; rejected, invalid and stale requests do not.
