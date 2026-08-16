# WP 3.3 — Preserve the current interface through API adapters

| Field | Value |
|---|---|
| Phase | Phase 3 — Connect the interface to the backend |
| Work Package | WP 3.3 |
| Status | In progress |
| Started | 2026-08-16 |
| Branch | `codex/wp-3.3-interface-preservation` |
| Base | Protected `main` at `c76da962` |
| Dependencies | WP 3.1–3.2; WP 1.2–1.3; WP 2.2–2.3 |
| Decision | [ADR 0011](../decisions/ADR-0011-interface-api-adapters.md) |

## Objective

Preserve the existing Arabic storefront builder and platform screens while making their server interactions explicit, injectable and testable through one application adapter boundary.

## Scope

- One typed adapter composition root for authentication, administration, plans, provisioning, merchant workspaces and assisted content generation.
- A React provider that injects production adapters and permits controlled fake adapters in interface tests.
- Migration of `App` and API-backed components away from direct transport/domain-service imports.
- Stable UI error presentation without exposing transport classes to components.
- Behavioral-parity tests for representative authentication, pricing, domain and administration surfaces.
- An automated source-boundary gate that prevents components from bypassing the adapters.
- Explicit confirmation that browser storage cannot be restored as an authority through a feature flag.

## Out of scope

- Visual redesign, new navigation or changing Arabic copy and CSS classes.
- Decomposing `App.tsx` or `ControlPanel.tsx`; that remains Phase 5 work.
- A second API implementation or a legacy/local-data compatibility mode.
- Orders, checkout authority, payment and stock reservation (Phase 4).
- Backend route, policy, persistence or database migration changes.

## T0–T5

### T0 — Contract and baseline

- [x] Inventory every direct API service dependency in `App` and current components.
- [x] Define adapter ownership, injection, error and feature-flag rules.
- [ ] Complete early independent design review.

### T1 — Adapter boundary

- [ ] Add typed UI adapter contracts and a production composition root.
- [ ] Add a required React provider with a controlled test override.
- [ ] Keep mapped server DTOs and idempotency inside their existing domain services.

### T2 — Interface migration

- [ ] Route all API-backed component operations through the injected adapters.
- [ ] Remove direct service imports from `App` and `src/components`.
- [ ] Preserve current markup, labels, classes, loading and error behavior.

### T3 — Compatibility and rollout controls

- [ ] Add representative interface-parity tests using fake adapters.
- [ ] Add a source-boundary test for future component changes.
- [ ] Confirm no rollout flag can switch identity or business data back to browser authority.

### T4 — Gates

- [ ] Pass frontend unit tests, typecheck, production build and dependency audit.
- [ ] Pass backend quality, PostgreSQL/container integration and repository-safety gates unchanged.
- [ ] Verify same-account cross-device workspace and permission-filtered administration behavior remain green.

### T5 — Evidence and delivery

- [ ] Record verification evidence and rollback observations.
- [ ] Complete independent read-only review with no blocking findings.
- [ ] Commit, push, open PR, pass the four required checks and merge.

## Acceptance criteria

- `App.tsx` and files under `src/components` do not import `src/services` directly.
- Production rendering uses exactly one configured adapter set, while tests can inject deterministic fakes without network calls.
- Authentication, password reset, plan listing, domain availability, store submission, workspace editing, administration and assistant generation retain their current visible states and server contracts.
- No adapter accepts identity, authorization, publication, price or inventory from browser storage.
- Existing WP 3.1 transport-safety and WP 3.2 server-authority tests remain green.
- No database, route, screen-layout or styling change is introduced by this package.

## Risks and controls

- **A second business layer:** adapters only compose UI-facing operations; validation, DTO mapping, idempotency and server authority stay in domain services and Laravel.
- **Hidden visual regression:** production JSX and CSS classes remain unchanged and stable interface anchors are asserted.
- **Dependency bypass:** a source-boundary gate rejects direct service imports from screen components.
- **Unsafe test defaults:** the provider fails closed when absent; tests must inject an explicit fake set.
- **Legacy authority revival:** feature flags may change presentation rollout only and can never select local/browser data as an authenticated source.

## Rollback

This is a frontend-only dependency-wiring change. Rollback restores the previous direct imports without deleting server or browser data and without a database migration. The existing API services remain unchanged, so rollback does not alter endpoint, session, DTO, idempotency or workspace-revision contracts.
