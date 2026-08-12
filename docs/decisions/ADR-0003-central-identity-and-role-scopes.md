# ADR 0003 — Central identity and scoped roles

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-12 |
| Decision owners | Eoshop engineering |
| Related work package | WP 1.1 |

## Context

Eoshop needs one server-owned identity for merchants and platform operators. A user may eventually manage more than one store, and their authority can differ per store. Platform administration authority must not be inferred from browser state or from a merchant's role in a tenant.

## Decision

Identity is stored in the central PostgreSQL schema. Eoshop uses first-party Laravel authentication contracts, Eloquent relationships and stable application-defined permission keys.

Roles have an explicit `platform` or `tenant` scope:

- `role_user` assigns platform roles to users.
- `tenant_user` assigns exactly one tenant role to a user within a specific tenant.
- `permission_role` maps reusable permission keys to roles only when both have the same explicit scope; composite database keys enforce that boundary.

Platform and tenant assignment pivots are likewise constrained to their declared role scope. Role assignment goes through a domain service that validates scope, requires a user actor, serializes concurrent changes for the target user and emits an audit record. Audit actor and tenant identifiers are retained as historical snapshots even if the source record is later hard-deleted. Authorization policies in WP 1.3 will consume this model; controllers and the browser must not assign roles directly.

No third-party role package is introduced in this work package. The initial model is small, explicit and covered by database integration tests. A package may be reconsidered later only if its operational benefits exceed the migration and abstraction cost.

## Consequences

### Positive

- Platform authority and tenant authority cannot be confused by a single global merchant role.
- Multi-store users are supported without complicating the MVP interface.
- Permission names remain stable when Arabic labels or UI wording changes.
- Laravel policies can query one authoritative model in WP 1.3.
- Audit attribution exists before sensitive administration endpoints are enabled.

### Trade-offs

- Composite keys add schema complexity, but make cross-scope role-permission mappings fail closed at the database boundary.
- Permission queries require joins and should be cached only after correctness is established.
- The initial permission vocabulary must evolve through migrations and reviewed seed changes.

## Alternatives rejected

### One global role column on `users`

Rejected because the same user may be an owner in one tenant and staff in another, while platform roles have a different trust boundary.

### Roles stored inside each tenant schema

Rejected because identity and platform authorization must be available before tenant initialization and across multiple stores.

### Trust frontend role values

Rejected because browser state is user-controlled and cannot authorize server operations.

## Rollback

Before real data exists, reverse the WP 1.1 migration. After identities or audit records exist, retain/export the data and use a forward migration; never silently discard authorization history.

## Authoritative references

- [Laravel 12 authentication](https://laravel.com/docs/12.x/authentication)
- [Laravel 12 authorization](https://laravel.com/docs/12.x/authorization)
- [Laravel 12 Eloquent relationships](https://laravel.com/docs/12.x/eloquent-relationships)
- [Laravel 12 migrations](https://laravel.com/docs/12.x/migrations)
