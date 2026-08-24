# WP 5.18 — Authenticated shell acceptance hardening

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.18 |
| Status | Verified; ready for delivery |
| Started | 2026-08-24 |
| Branch | `codex/wp-5.18-acceptance-hardening` |
| Base | Protected `main` at `8e0531cc` |
| Dependencies | WP 5.4–5.17 |
| Decision | [ADR 0030](../decisions/ADR-0030-accessible-responsive-shell-boundaries.md) |

## Objective

Make the existing merchant portal, store operations center and platform administration shell usable by keyboard and on narrow screens without changing server authority, lifecycle behavior or tenant data.

## Scope

- Shared skip-link and visible-focus boundary.
- Stable main-content landmarks for the three authenticated shells.
- Compact narrow-screen merchant portal and store-module navigation.
- Active-route semantics in merchant operations and platform administration.
- Narrow-screen platform exit/logout actions.
- Regression tests for the structural accessibility and callback boundaries.

## Exclusions

- Public storefront component redesign; it remains a following acceptance slice.
- Free-form page building or additional template/appearance options.
- Backend, database, authorization, provisioning, catalog, inventory or order changes.
- Automated claims of WCAG conformance or complete device/browser certification.
- Bundle splitting and Phase 6 performance infrastructure.

## T0–T5

### T0 — Scope and baseline

- [x] Identify the missing narrow-screen platform session controls.
- [x] Identify the oversized narrow-screen merchant navigation.
- [x] Confirm the absence of a shared skip-link/focus boundary.

### T1 — Design

- [x] Record the dual-projection navigation and focus rules in ADR 0030.
- [x] Keep route, permission and lifecycle inputs authoritative and shared.

### T2 — Implementation

- [x] Add the shared accessibility primitive and focus treatment.
- [x] Harden merchant portal, store operations and platform shells.

### T3 — Verification

- [x] Add positive route/landmark/action regressions.
- [x] Pass focused and complete frontend quality.
- [x] Pass backend, repository and isolated integration gates.

### T4 — Pilot

- [x] Update only the retained Pilot web container.
- [x] Verify HTTP health and hand off narrow-screen/keyboard visual acceptance.

### T5 — Delivery

- [x] Obtain independent read-only approval.
- [x] Record evidence, retained debt and rollback.
- [ ] Commit, push, pass required CI and merge.

## Acceptance criteria

- The first keyboard-reachable control in each authenticated shell can move focus to that shell's main content.
- The store operations active module and platform active section expose `aria-current="page"`.
- Merchant navigation is compact and horizontally scrollable below the desktop breakpoint.
- Platform website and logout actions remain available below the desktop breakpoint.
- Disabled modules remain disabled and all callbacks retain their current behavior.
- No backend or persisted data source changes.

## Risks

- Duplicate desktop/mobile projections may make ambiguous test queries; accessible names and CSS visibility must remain explicit.
- A global focus ring may expose previously unnoticed cramped controls; the ring must use offset rather than change layout.
- Fixed platform layering can hide the skip link unless it has a higher stacking context.

## Rollback

Deploy the previous web image. The change is frontend-only and does not require data rollback.
