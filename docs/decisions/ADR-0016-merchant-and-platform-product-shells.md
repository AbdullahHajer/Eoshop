# ADR 0016 — Merchant and platform product shells

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-19 |
| Decision owners | Eoshop product and engineering |

## Context

Eoshop now has server-owned identity, tenant isolation, store review, recoverable provisioning, subscriptions, publication, workspaces, catalog, inventory and orders. The interface still exposes those capabilities through a landing page, transient modals and one large store builder. An authenticated merchant has no durable application home, store lifecycle timeline or explicit published-link handoff. The platform administration surface is a store-review modal rather than an operational console.

The product must become understandable without weakening the existing server authority or rebuilding the commerce core.

## Decision

1. Keep one Laravel server and one React codebase, with two route-owned product shells: `/app` for merchants and `/admin` for platform operators.
2. Authentication pages lead deterministically to the correct shell. Modal authentication may remain only as a compatibility entry during migration, not as the final navigation authority.
3. The merchant shell owns account context, store selection, lifecycle state and navigation. The current builder becomes the design module of a selected store rather than the merchant application itself.
4. Store lifecycle is presented as explicit stages: draft, submitted/review, approved, provisioning, ready, publication and published. Every state exposes one truthful next action, an owner for that action and a durable explanation when blocked.
5. WP 5.5 will introduce a server-owned store draft and correction/resubmission flow. Browser storage remains optional recovery material and is never the cross-device source of truth.
6. Platform approval establishes store eligibility. After approval, successful provisioning and an active subscription, the merchant owner may publish or unpublish the store through a new server-authorized ability. Platform operators retain suspend and forced-unpublish authority.
7. The platform shell becomes a route-owned console with server-side search/pagination, review and provisioning queues, store detail/timeline, users/roles, audit visibility and operational status.
8. Platform appearance and behavior settings are typed, versioned, validated and audited. No raw JSON, arbitrary code or unrestricted key/value editor is exposed.
9. Existing UI adapters remain the transport boundary. Feature screens receive typed view models and callbacks and may not call transport services directly.
10. Backend state machines, policies, CSRF/session controls, idempotency, tenant isolation, audit and concurrency rules remain authoritative. Interface convenience never bypasses them.
11. Automated gates continue during the rebuild. Human Pilot acceptance is paused until the merchant lifecycle shell is coherent enough to produce useful feedback.
12. Store projections expose explicit per-membership capabilities. The full workspace editor requires both store and product management; staff with narrower permissions see their available modules but never receive an implied owner capability.
13. Review feedback returned to a merchant is an intentional merchant-facing field and is returned only while the store is rejected. Internal operational notes, security details, stack traces and provisioning diagnostics remain in restricted audit/log surfaces.
14. Publication readiness uses the same materialized-workspace invariant as the publish transaction. A provisioned schema without a current materialized workspace is blocked with `workspace_not_ready`.

## Consequences

- The interface can be rebuilt incrementally around stable server contracts instead of replacing the backend.
- A small number of API projections and abilities must be added, including merchant-visible rejection/publication data and later draft/resubmission/publication actions.
- Route and shell ownership reduce the global state currently concentrated in `App.tsx`.
- Platform settings require explicit schemas and audit behavior before a corresponding administration screen is enabled.
- Existing builder and storefront behavior remain available while ownership moves behind the merchant shell.

## Alternatives rejected

### Rewrite the backend and frontend together

Rejected because server authority and lifecycle safety already exist and a rewrite would add risk without solving the information-architecture problem faster.

### Restyle the existing modals and builder only

Rejected because visual refinement would not create durable navigation, lifecycle ownership, store profiles or platform operations.

### Give platform operators permanent control of ordinary merchant publication

Rejected because it creates an avoidable operational bottleneck after the platform has already approved the store. Platform override remains available for safety and policy enforcement.

### Store pre-submission work only in the browser

Rejected because it is not cross-device, cannot support a durable lifecycle and can be lost before submission.

## Rollback

Route-shell and presentation changes can be reverted without reverting server-owned commerce data. Any later draft or publication schema change must define its own forward-compatible rollback/refusal contract in the work package that introduces it.
