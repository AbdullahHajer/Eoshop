# WP 5.1 — Frontend application shell decomposition

| Field | Value |
|---|---|
| Phase | Phase 5 — Incremental frontend decomposition |
| Work Package | WP 5.1 |
| Status | Complete and merged |
| Started | 2026-08-18 |
| Branch | `codex/wp-5.1-frontend-feature-shell` |
| Base | Protected `main` at `dcbb63c` |
| Dependencies | WP 3.1–3.3; WP 4.1–4.3 |
| Decision | [ADR 0015](../decisions/ADR-0015-incremental-frontend-feature-boundaries.md) |

## Objective

Reduce `App.tsx` from a screen-and-workflow monolith into an application composition shell, starting with low-risk presentational and recovery boundaries while preserving the current Arabic interface and every server-owned contract.

## Scope

- Establish `src/app` and feature-owned screen boundaries without changing routing behavior.
- Extract the global toast viewport from `App.tsx`.
- Extract the public storefront loading/error/success screen.
- Extract merchant workspace conflict, recovery and local-draft prompts.
- Keep API access behind the WP 3.3 UI adapters and keep workflow rules in existing workflow modules.
- Add focused characterization and dependency-boundary tests for the extracted shell.

## Out of scope

- Visual redesign, new navigation, copy changes or CSS restyling.
- Decomposing the complete builder, `ControlPanel` or `StorePreview`; these remain later Phase 5 slices.
- Backend routes, DTOs, policies, migrations or business-rule changes.
- Introducing a router library or state-management framework.

## Delivery strategy

- Contract and characterization first.
- Extract one render boundary at a time and run focused frontend tests after each coherent slice.
- Run the complete repository gates once the slices converge, then record immutable evidence.
- Any visible or server-contract drift blocks delivery.

## T0–T5

### T0 — Contract and baseline

- [x] Confirm Phase 5 as the next roadmap phase and record the current large-file baseline.
- [x] Define dependency direction and behavior-preservation constraints.
- [x] Complete independent design review.

### T1 — Application shell primitives

- [x] Add explicit application view and notification types.
- [x] Extract the global toast viewport.
- [x] Keep host classification deterministic and testable.

### T2 — Feature boundaries

- [x] Extract the public storefront screen.
- [x] Extract workspace conflict/recovery prompts.
- [x] Replace inline JSX in `App.tsx` with typed feature components.

### T3 — Characterization and boundaries

- [x] Characterize storefront success/error and recovery actions.
- [x] Enforce that extracted screens do not import transport services directly.
- [x] Record the resulting large-file baseline without claiming full decomposition: `App.tsx` moved from 2,513 to 2,382 lines.

### T4 — Gates

- [x] Pass frontend lint, tests, production build and audit.
- [x] Pass backend quality, PostgreSQL integration and repository-safety gates unchanged.
- [x] Confirm the four required CI checks on the PR head.

### T5 — Evidence and delivery

- [x] Record verification evidence and rollback observations.
- [x] Complete independent read-only review with no blocking findings.
- [x] Commit implementation separately from closeout evidence, push, open PR and merge.

## Acceptance criteria

- `App.tsx` composes typed shell/feature components instead of owning their detailed markup.
- Storefront load success, failure and retry behavior remain unchanged.
- Workspace conflict reload, safe reapply, discard, manual-review archive/discard and local-draft import/discard actions remain available with the same guards.
- Extracted frontend files do not import `src/services` or recreate business rules.
- No backend, database, visible layout or browser-storage authority change is introduced.
- Existing Phase 3 and Phase 4 frontend characterization tests remain green.

## Rollback

This package is a frontend-only structural extraction. Rollback restores the inline JSX in `App.tsx`; it does not alter server data, tenant schemas, browser drafts, APIs or migrations.
