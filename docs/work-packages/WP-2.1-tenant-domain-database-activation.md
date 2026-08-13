# WP 2.1 — Tenant, domain and database activation

| Field | Value |
|---|---|
| Phase | Phase 2 — Tenant lifecycle, store and domain |
| Work Package | WP 2.1 |
| Status | In progress |
| Started | 2026-08-13 |
| Branch | `codex/wp-2.1-tenancy-activation` |
| Base | Protected `main` at `605f5e1` |
| Dependencies | WP 1.1 identity; WP 1.2 sessions; WP 1.3 authorization |
| Decision | [ADR 0006](../decisions/ADR-0006-schema-per-tenant-runtime-boundary.md) |

## Objective

Activate domain-resolved tenancy and PostgreSQL schema isolation without prematurely introducing the asynchronous provisioning workflow. A tenant request must select exactly one ready schema and must restore central state after the response or any failure.

## Scope

- Register the application tenancy provider and tenant routes.
- Resolve full canonical hostnames to approved, ready tenants.
- Enforce canonical domains in the model and PostgreSQL.
- Use deterministic collision-resistant schema identifiers.
- Bootstrap and revert the tenant database connection per request.
- Keep sessions, cache, locks and future database queues central.
- Separate central platform routes, universal known-domain authentication and tenant resource routes.
- Run tenant migrations against explicitly selected existing schemas.
- Add PostgreSQL tests for isolation, fail-closed behavior and lifecycle side effects.

## Out of scope

- Creating schemas automatically during store submission or approval.
- Retry, compensation, progress recording and schema deletion (WP 2.2).
- Domain reservation and plan/subscription policy (WP 2.3).
- Product and server-priced order APIs.
- Tenant filesystem and queued-job context switching.

## T0–T5

### T0 — Contract

- [x] Adopt schema-per-tenant and canonical full-host contracts.
- [x] Separate runtime activation from recoverable provisioning.

### T1 — Domain and routing boundary

- [x] Register tenant routes without route-cache duplication.
- [x] Enforce central, known-domain authentication and tenant-only boundaries.
- [x] Fail closed for unknown, non-approved and missing-schema tenants.

### T2 — Database isolation

- [x] Bootstrap the selected schema and revert in `finally`.
- [x] Keep session/cache/queue connections explicitly central.
- [x] Wire tenant migration commands to existing selected schemas.

### T3 — Safe runtime surface

- [x] Keep store registration unavailable until WP 2.2.
- [x] Keep the client-priced order mutation unavailable.
- [x] Preserve authenticated tenant configuration behind exact membership permission.

### T4 — Gates

- [x] Prove two-host schema isolation and central restoration.
- [x] Prove canonical-domain database constraints and lifecycle side-effect absence.
- [x] Prove route-cache, migration lifecycle and live central smoke behavior.

### T5 — Evidence and delivery

- [x] Record final verification evidence.
- [x] Complete independent read-only review (`APPROVE`; no blocking findings).
- [ ] Commit, push, open PR, pass required CI and merge.

## Rollback

Unregister the application tenancy provider and tenant routes, revert the canonical-domain constraint migration and restore explicit connection settings. Do not drop tenant schemas or delete domains as part of a code rollback.
