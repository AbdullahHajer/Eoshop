# ADR 0011 — Interface API adapters

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-16 |
| Decision owners | Eoshop engineering |

## Context

WP 3.1 created one safe transport and typed domain services, and WP 3.2 made the tenant workspace server-owned. The current React screens still import those services directly in multiple places. That makes interface behavior harder to isolate in tests and allows future screens to create inconsistent orchestration even though the underlying transport is unified.

WP 3.3 must improve this seam without redesigning the interface or rebuilding the large components.

## Decision

1. React screens consume one typed `UiAdapters` contract supplied by a required context provider. `main.tsx` is the production composition root.
2. The production adapter set delegates to the existing typed services. It does not duplicate DTO validation, CSRF, retry, idempotency, authorization or business rules.
3. Authentication adapters return the existing UI profile shape so screens do not import transport user records or mapping helpers.
4. Components receive normalized error inspection and presentation helpers from the adapter boundary; they do not depend on the transport error class.
5. `App.tsx` and `src/components` may not import `src/services` directly. A source test enforces this rule. Pure workflow helpers may remain under services until later decomposition, but they cannot perform transport calls.
6. Tests may inject a complete fake adapter set through the provider. There is no implicit mock, global mutation or production fallback when the provider is missing.
7. The migration changes dependency wiring only. Existing Arabic labels, DOM structure, CSS classes and interaction semantics remain unchanged except where a test exposes an existing correctness defect that must be documented separately.
8. No feature flag is required for this internal cutover because the production adapter delegates to the same services. Any future rollout flag may select presentation behavior only; it must fail closed and must never restore `localStorage`, mock records or client claims as identity or business authority.
9. Domain service response types remain the authoritative frontend DTOs at the adapter boundary. Components import those types through the adapter module so screen code has one dependency direction.
10. Direct browser APIs used for UI-only behavior—file selection, print, download, history and non-sensitive draft preference—are not transport bypasses and remain governed by their existing contracts.

## Consequences

- Current screens can be behavior-tested with deterministic adapters without network interception.
- API transport and domain services remain independently testable and unchanged.
- Future component decomposition can move orchestration behind narrower ports without another visible migration.
- The adapter interface is intentionally broad for the current monolith; Phase 5 may split it by feature as components are decomposed.

## Alternatives rejected

### Pass each API function through component props

Rejected because it would add extensive prop plumbing to the existing monolith and create visible-screen churn without improving the production composition point.

### Let every component import domain services directly

Rejected because it prevents controlled interface tests and makes dependency-boundary drift invisible.

### Add a local-data feature flag for rollback

Rejected because it would restore two authorities and undermine the security and concurrency guarantees delivered by WP 3.2.

## Rollback

The provider and adapter imports can be reverted to direct service imports. No server data, browser draft, endpoint or database schema is modified by this decision.
