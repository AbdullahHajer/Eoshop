# WP 5.20 — Merchant management entry and storefront recovery

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.20 |
| Status | In progress |
| Started | 2026-08-25 |
| Branch | `codex/wp-5.20-merchant-entry-storefront-recovery` |
| Base | Protected `main` at `f70c8a19` |
| Dependencies | WP 5.19 |
| Decision | [ADR 0032](../decisions/ADR-0032-merchant-entry-and-storefront-recovery.md) |

## Objective

Make the existing-store management and editing path obvious from the merchant portal and make the public storefront recover safely from transient load failure.

## Scope

- Activate the merchant “My stores” navigation against the existing authoritative store list.
- Rename the ambiguous store-center action and add capability-aware operational shortcuts.
- Preserve the one route-owned store operations center and existing focused editors.
- Add cancellable, bounded transient recovery and in-place retry for public-storefront bootstrap.
- Add regressions for navigation, capability boundaries, retry, cancellation and error copy.

## Exclusions

- New management modules or duplicate store-list state.
- Permission, publication, tenant schema, API or database changes.
- Visual redesign of the public storefront.
- Full narrow-screen, keyboard and cross-browser acceptance; it follows as WP 5.21.

## T0–T5

### T0 — Scope and baseline

- [x] Confirm “My stores” is rendered as a non-interactive element.
- [x] Confirm existing store editing remains available at `/app/stores/{tenant}/design`.
- [x] Confirm the published Pilot config currently returns HTTP 200 and the observed error is recoverable/transient.

### T1 — Design

- [x] Record the navigation and recovery boundary in ADR 0032.
- [x] Keep server capabilities and public tenant routing authoritative.

### T2 — Implementation

- [ ] Activate store navigation and clear management/edit entry points.
- [ ] Add capability-aware shortcuts without bypassing the operations center.
- [ ] Add bounded public-storefront recovery and in-place retry.

### T3 — Verification

- [ ] Add focused regressions.
- [ ] Pass frontend, backend, repository and container gates.

### T4 — Pilot

- [ ] Verify merchant entry, design route and public-store recovery on the retained Pilot.

### T5 — Delivery

- [ ] Obtain independent read-only approval.
- [ ] Record evidence and rollback.
- [ ] Commit, push, pass required CI and merge.

## Acceptance criteria

- “My stores” is keyboard-operable and moves focus to the real store list.
- A ready merchant can identify and open “Manage and edit store” without guessing.
- Products, orders, design and pages shortcuts appear only when their server capabilities allow them.
- A transient public read receives one bounded automatic recovery attempt.
- Manual retry reloads the storefront data in place and does not reload the whole application.
- A missing/unpublished domain and a temporary service failure have distinct safe messages.

## Rollback

Deploy the previous web image. This work package has no database or persisted-contract rollback.

