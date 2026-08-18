# WP 5.2 — Control panel workflow panels

| Field | Value |
|---|---|
| Phase | Phase 5 — Incremental frontend decomposition |
| Work Package | WP 5.2 |
| Status | In progress |
| Started | 2026-08-18 |
| Branch | `codex/wp-5.2-control-panel-workflow-panels` |
| Base | Protected `main` at `af732e1` |
| Dependencies | WP 5.1; ADR 0015 |
| Decision | [ADR 0015](../decisions/ADR-0015-incremental-frontend-feature-boundaries.md) |

## Objective

Turn `ControlPanel.tsx` into a composition boundary incrementally by extracting its low-risk workflow panels behind typed data-and-callback contracts, while preserving the existing Arabic interface and all server-authoritative behavior.

## Baseline

- `ControlPanel.tsx`: 3,691 lines / 233,276 bytes.
- `App.tsx`: 2,382 lines / 121,022 bytes.
- `StorePreview.tsx`: 3,431 lines / 200,942 bytes.

## Scope

- Export the shared `ControlTab` and `ControlPanelProps` contracts.
- Extract the preview-device selector and customization completion bar.
- Extract the merchant orders panel as a presentation-only feature boundary.
- Extract the AI copywriter panel as a presentation-only feature boundary.
- Extract the store-submission/publication panel.
- Keep adapter calls, idempotency, order reconciliation and assistant orchestration in the current coordinator.
- Add focused characterization and dependency-boundary tests for the extracted panels.

## State and responsibility matrix

| Boundary | Coordinator remains responsible for | Extracted panel receives |
|---|---|---|
| Merchant orders | Loading through `UiAdapters`, idempotency keys, pending refs, error recovery and the allowed transition/action list | Order view models, already-decided actions, pending state and an action callback |
| AI copywriter | Prompt/loading/output state, assistant invocation and the existing safe fallback on failure | Current state plus prompt-change and submit callbacks |
| Completion bar | Choosing the domain-modal callback or the fallback transition to the `export` tab | One `onComplete` callback |
| Store submission | Modal ownership and every provisioning/publication operation | Summary values and one optional modal-open callback |

The extracted panels never receive the full `ControlPanelProps` object. Their leaf contracts contain only the typed values and callbacks needed to render the current interaction.

## Characterization matrix

- **Orders:** loading, error, empty, allowed actions, terminal state without actions, pending/disabled action, and failed transition retry with the same idempotency key.
- **Assistant:** empty prompt disabled, deferred loading/double-submit guard, successful output and existing failure fallback.
- **Device:** desktop/mobile selected styling and callbacks.
- **Completion:** direct callback when supplied and coordinator fallback to `export` otherwise.
- **Submission:** enabled/disabled action, current summary and absence of a publication-success claim.
- **Dependency direction:** extracted panels cannot import services, `fetch`, `UiAdaptersContext`/`useUiAdapters` or the `ControlPanel` coordinator.

## Out of scope

- Visual redesign, wording changes, new navigation or CSS restyling.
- Product, inventory, checkout, branding, design or pages tab decomposition.
- Moving transport calls or authorization/business rules into presentation components.
- Backend, API, database, tenancy or browser-storage changes.
- `StorePreview.tsx` decomposition.

## T0–T5

### T0 — Contract and baseline

- [x] Record the large-file baseline and select low-risk workflow panels.
- [x] Define typed data/callback boundaries and explicit exclusions.
- [x] Complete independent design review and incorporate its responsibility/parity gates.

### T1 — Shared control-panel contracts

- [x] Export stable tab and panel prop types.
- [x] Extract device and completion controls without changing behavior.

### T2 — Workflow-panel extraction

- [x] Extract merchant orders rendering without moving order orchestration.
- [x] Extract AI copywriter rendering without moving assistant orchestration.
- [x] Extract store-submission rendering without changing publication claims.

### T3 — Characterization and boundaries

- [x] Characterize device switching and completion fallback behavior.
- [x] Characterize orders states/actions, assistant submit/output and store-submission action.
- [x] Prove extracted screens remain free of services/fetch imports.
- [x] Record the resulting `ControlPanel.tsx` baseline: 3,534 lines / 221,881 bytes.

### T4 — Gates

- [x] Pass frontend lint, tests, production build and dependency audit.
- [x] Pass backend quality, PostgreSQL integration and repository-safety gates unchanged.
- [ ] Confirm the four required CI checks on the PR head.

### T5 — Evidence and delivery

- [ ] Record verification evidence and rollback observations.
- [ ] Complete independent read-only review with no blocking findings.
- [ ] Commit implementation separately from closeout evidence, push, open PR and merge.

## Acceptance criteria

- `ControlPanel.tsx` composes typed workflow-panel components instead of owning their detailed markup.
- Device selection, completion fallback, order loading/error/empty/actions, assistant submit/loading/output and store-submission action remain behaviorally unchanged.
- Extracted feature components receive typed data and callbacks and do not import `src/services`, call `fetch`, inspect raw DTOs or recreate business/authorization rules.
- Existing order idempotency and concurrency guards stay in the coordinator.
- Existing Arabic copy, DOM semantics and CSS classes remain stable.
- No backend, API, database, browser-storage or visible-design change is introduced.

## Risks and controls

- **Behavior drift during extraction:** characterize callbacks and disabled states before the full gate.
- **Business logic leaking into JSX files:** keep transitions and transport ownership in `ControlPanel`, and enforce the existing dependency test.
- **Oversized refactor:** exclude complex catalog, inventory and checkout tabs from this package.

## Rollback

This package is a frontend-only structural extraction. Rollback inlines the extracted JSX into `ControlPanel.tsx`; it has no data migration, API or tenant-state effect.
