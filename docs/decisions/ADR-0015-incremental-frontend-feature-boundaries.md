# ADR 0015 — Incremental frontend feature boundaries

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-18 |
| Decision owners | Eoshop engineering |

## Context

The server is now authoritative for identity, tenancy, publication, workspaces, catalog, inventory and orders. The React interface preserves the original product experience, but `App.tsx`, `ControlPanel.tsx` and `StorePreview.tsx` remain large components that mix composition, presentation and workflow coordination. A broad rewrite would create unnecessary visual and behavioral risk just before planned user-experience improvements.

## Decision

1. Phase 5 proceeds in small work packages. A package extracts one coherent boundary and preserves visible behavior before the next boundary begins.
2. `src/app` owns application-wide composition and presentation primitives. `src/features/<feature>` owns feature screens and feature-local presentation.
3. Feature screens receive typed data and callbacks. They do not import `src/services`, execute transport calls, inspect raw server DTOs or reproduce authorization/business rules.
4. Existing `UiAdapters` remain the only screen-facing server boundary until a later package deliberately narrows them by feature.
5. Existing workflow helpers remain the authority for conflict resolution, order reconciliation and similar UI orchestration. Extraction must not fork those rules into JSX components.
6. No new global state library or routing library is introduced merely to move code. State ownership changes only when a focused test proves the new owner.
7. Markup, Arabic copy, CSS classes, accessibility semantics and interaction guards remain stable unless a later UX work package explicitly changes them.
8. Each extraction adds characterization tests at the new boundary and a dependency-direction check. File-size reduction is evidence of decomposition, not the acceptance criterion by itself.
9. Full frontend and repository gates run after a coherent extraction set converges. Focused tests run during each slice to shorten feedback without weakening the final gate.

## Consequences

- UX work can target smaller feature surfaces without reopening server-authority decisions.
- Review diffs remain bounded and rollback remains frontend-only.
- Some prop plumbing is accepted temporarily because it makes ownership explicit and avoids hidden global state.
- The three large components will shrink across multiple work packages rather than through one high-risk rewrite.

## Alternatives rejected

### Rewrite the frontend around a new framework or state library

Rejected because the current interface is functional and the primary risk is mixed responsibility, not an incapable rendering stack.

### Move JSX into files without typed feature contracts

Rejected because file-count growth alone does not create a reliable boundary and can conceal the same coupling.

### Combine decomposition with visual redesign

Rejected for this package because structural and visual regressions would be difficult to distinguish. UX changes follow on top of characterized feature boundaries.

## Rollback

Each extracted boundary can be inlined back into its former parent without data migration or API changes. Server-owned state and browser-draft rules are unaffected.
