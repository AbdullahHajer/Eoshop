# WP 3.1 — Unified frontend API boundary

| Field | Value |
|---|---|
| Phase | Phase 3 — Connect the interface to the backend |
| Work Package | WP 3.1 |
| Status | Complete — delivered through PR #14 |
| Started | 2026-08-15 |
| Branch | `codex/wp-3.1-unified-api-client` |
| Base | Protected `main` at `52d81f2` |
| Dependencies | WP 1.2–1.3; WP 2.1–2.3 |
| Decision | [ADR 0009](../decisions/ADR-0009-unified-frontend-api-boundary.md) |

## Objective

Create one typed, same-origin frontend boundary for Laravel APIs so authentication, CSRF, error semantics and retries behave consistently without redesigning the existing screens.

## Scope

- One transport client for same-origin JSON requests and CSRF-protected mutations.
- Normalized `401`, `403`, `409`, `419`, `422`, `429` and `5xx` errors, including safe retry metadata.
- Explicit domain DTO mapping for authentication, stores, plans and provisioning.
- Reusable loading, error and explicit retry state for React components.
- Migration of all existing frontend API services away from direct `fetch` calls.
- Compatibility tests for current authentication, administration, plan and provisioning flows.

## Out of scope

- Moving business records or published store configuration out of `localStorage` (WP 3.2).
- Redesigning screens or decomposing the large application components (WP 3.3 / Phase 5).
- Automatic retries for business mutations, offline queues or optimistic writes.
- Changing Laravel routes, response resources or authorization policy.

## T0–T5

### T0 — Contract and baseline

- [x] Inventory the existing API services, direct requests and duplicated error behavior.
- [x] Define transport ownership, error categories and retry safety.
- [x] Record representative response and error compatibility expectations.

### T1 — Transport boundary

- [x] Implement the same-origin client, CSRF single-flight and one-time `419` recovery.
- [x] Normalize safe errors and retry metadata without exposing server internals.
- [x] Prevent accidental absolute/cross-origin request targets.

### T2 — Domain contracts

- [x] Move auth, admin, plans and provisioning services onto the client.
- [x] Map explicit DTO fields before data reaches interface components.
- [x] Keep idempotency ownership in the provisioning domain service.

### T3 — Reusable interface state

- [x] Add reusable loading/error/retry state.
- [x] Adopt it in a live server-backed screen without changing visual design.

### T4 — Gates

- [x] Prove the status matrix, CSRF concurrency/recovery, network failure and no unsafe automatic retry.
- [x] Prove domain mappers discard unknown transport/database fields.
- [x] Pass frontend tests, typecheck/build and all repository CI gates.

### T5 — Evidence and delivery

- [x] Record verification evidence.
- [x] Complete independent read-only review with no blocking findings.
- [x] Commit, push, open PR, pass the four required checks and merge.

## Risks and controls

- **Duplicate mutation:** only a server `419` can trigger one automatic replay; reusable retry is opt-in for safe reads or an explicitly idempotent domain operation, and provisioning retains its idempotency key.
- **Sensitive input retention:** task state does not retain arguments unless retry was explicitly enabled, so authentication and password-reset values are not captured for replay.
- **Stale CSRF token:** token acquisition is single-flight, reset after `419`, logout and password reset.
- **Sensitive server errors:** `5xx` responses use a stable client-safe message and retain only request correlation metadata.
- **Contract drift:** service-level mappers enumerate accepted fields and tests inject unknown fields to prove they do not escape.

## Rollback

The client and hook are frontend-only. Rollback restores the previous service transport implementation without database migration or server data changes.
