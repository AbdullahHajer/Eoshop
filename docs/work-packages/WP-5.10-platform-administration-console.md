# WP 5.10 — Platform administration console foundation

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.10 |
| Status | T5 — Evidence and delivery |
| Started | 2026-08-21 |
| Branch | `codex/wp-5.10-platform-admin-console` |
| Base | Protected `main` at `f4074ae` |
| Dependencies | WP 1.1–1.3; WP 2.2–2.3; WP 3.1–3.3; WP 5.9 |
| Decision | [ADR 0022](../decisions/ADR-0022-platform-administration-console-foundation.md) |

## Objective

Replace the transient store-review modal with a route-owned platform operations console that gives authorized operators a truthful overview, scalable store queues and a readable audit trail while preserving every existing server authorization and mutation boundary.

## Baseline

- `/admin` opens a large modal over the public application instead of a durable administration product shell.
- The browser loads only the first paginated store response but treats it as the complete platform and performs search/counts locally.
- Review, provisioning retry, subscription activation and publication actions are real server operations, but they are mixed into store cards without a platform overview or operational queue model.
- The protected audit endpoint exists but has no platform interface.
- Platform user management permission exists, while no safe user-management endpoint or lifecycle UI contract exists yet.
- Platform settings do not have explicit schemas, authorization or audit contracts and must not be invented in browser state.

## Scope

- Create a full-page, route-owned administration console for `/admin` with permission-aware overview, stores and audit sections.
- Add a protected server overview endpoint with authoritative store and operational counts.
- Add validated server-side store search, exact status/queue filters and bounded pagination.
- Add validated server-side audit search and bounded pagination without exposing secrets or tenant workspace configuration.
- Preserve the existing review, suspension, provisioning retry, entitlement activation and publication services as the only mutation paths.
- Move administration loading, filtering, pagination and mutation orchestration out of `App.tsx` into the administration feature boundary.
- Present loading, empty, error, permission-denied and mutation-pending states explicitly.
- Keep the console responsive and keyboard-labelled without performing a broad storefront redesign.

## Out of scope

- Creating, suspending, deleting or reassigning platform users and roles; this requires a dedicated lifecycle package.
- Writable platform settings, branding, feature flags, plan editing or secret management.
- Destructive tenant/schema deletion or retention automation.
- Payment verification, refunds, fulfillment, shipping, returns or advanced analytics.
- Production metrics/alerting, Redis, backup and scale infrastructure.

## Safety and product invariants

- Every endpoint remains central-domain, database-session, CSRF and policy protected.
- Overview and store data require `platform.stores.view`; audit data requires `platform.audit.view` independently.
- Reviewer and manager capabilities are derived from permission keys, never role names or browser state.
- Search and queue filters execute on the central server; client counts never claim to represent rows not loaded.
- Console entry requires `platform.stores.view` or `platform.audit.view`; it never depends on `platform_super_admin` or any other role key.
- Pagination is bounded and deterministic; malformed filters fail with 422 and do not silently broaden access.
- Overview counts share the exact server predicates used by list attention filters and are read from one PostgreSQL repeatable-read snapshot.
- Audit list output is an allowlisted projection. It exposes changed field names, not raw old/new JSON or User-Agent values, and never searches JSON payloads.
- Existing mutation services keep their row locks, transition authorization, audit transaction and idempotency behavior.
- No hard-delete action is added for users, stores, domains, subscriptions or schemas.
- The console must not show users/settings controls that imply unsupported backend capabilities.
- 401 expires the local administration context; 403 is a visible authorization boundary and never becomes an empty result.

## T0–T5

### T0 — Contract and baseline

- [x] Inventory current administration routes, resources, permissions and interface limitations.
- [x] Accept ADR 0022 route, query, permission and truthfulness boundaries.
- [x] Complete independent design review.

### T1 — Server read model

- [x] Add authoritative overview counts on the central connection.
- [x] Add validated store search/status/attention filters and bounded pagination.
- [x] Add validated audit search and bounded pagination.
- [x] Preserve all existing policy and Host boundaries.

### T2 — Platform console shell

- [x] Replace the modal presentation with a durable full-page administration shell.
- [x] Add permission-aware overview, operational queues, store workspace and audit explorer.
- [x] Move administration request orchestration out of `App.tsx`.
- [x] Preserve all existing server mutation actions and honest confirmations.

### T3 — Verification

- [x] Cover 401/403/422, central/tenant Host and permission-specific section boundaries.
- [x] Cover audit-only, stores-view-only, reviewer-without-super-admin-role and merchant direct-route behavior.
- [x] Cover authoritative counts, server filtering, pagination bounds and deterministic ordering.
- [x] Cover audit search, attribution presentation and absence of mutation controls.
- [x] Cover review/manage action visibility and mutation error/session-expiry behavior.
- [x] Cover responsive navigation, loading, empty and retry states.
- [x] Preserve authentication, merchant, provisioning, publication and storefront characterization.

### T4 — Gates

- [x] Pass focused frontend and PostgreSQL tests.
- [x] Pass frontend/backend quality, repository safety and isolated container integration.

### T5 — Evidence and delivery

- [x] Record exact evidence and retained user/settings/operations debt.
- [x] Obtain final independent read-only approval.
- [ ] Commit implementation and evidence separately, push, open PR, pass required CI and merge.

## Acceptance criteria

- An authorized operator opens `/admin` as a durable full-page console rather than a transient modal.
- Overview totals and queue counts come from the central server and are not inferred from one browser page.
- Search, status and attention filters return exact paginated server results and retain permission boundaries.
- A reviewer can inspect and decide pending stores but cannot see manager-only actions.
- A manager can use the already-supported retry, entitlement and publication operations with visible success/failure states.
- An audit-authorized operator can inspect attributable events; an operator without that permission cannot load or see the audit section.
- No user-management, platform-setting or destructive control claims a backend capability that WP 5.10 does not implement.

## Rollback

Revert the console and read-only overview/query endpoints together. Keep all historical audit records and existing store mutation APIs. The package adds no schema and does not alter tenant data, roles or permission assignments.
