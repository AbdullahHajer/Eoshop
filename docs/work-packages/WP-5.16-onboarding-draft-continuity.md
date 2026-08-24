# WP 5.16 — Onboarding draft continuity and explicit submission

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.16 |
| Status | In progress |
| Started | 2026-08-24 |
| Branch | `codex/wp-5.16-draft-continuity` |
| Base | Protected `main` at `74b374e7` |
| Dependencies | WP 2.2–2.3; WP 3.1–3.3; WP 5.4–5.5; WP 5.13–5.14 |
| Decision | [ADR 0028](../decisions/ADR-0028-authoritative-onboarding-draft-continuity.md) |

## Objective

Close the gap between a server-saved onboarding draft and a submitted store so the merchant can see exactly what happened, resume the authoritative next step and never mistake leaving a disabled review screen for a completed platform submission.

## Scope

- Restore the owner-scoped unbound draft alongside submitted stores in the merchant portal.
- Keep draft and submitted-store identities, counts, capabilities and administration queues separate.
- Resume the generic creation entry at the server-required stage.
- Replace the silent final-button gate with visible blockers and exact action feedback.
- Invalidate stale domain-availability responses when the handle changes.
- Isolate draft-read failures from submitted-store management.
- Preserve the existing revision, authorization, idempotency, domain and provisioning boundaries.

## Out of scope

- Draft deletion, multiple concurrent unbound drafts or platform access to private unsubmitted drafts.
- Domain reservation before submission, automatic approval or automatic publication.
- New onboarding customization fields, products, payments or managed media.
- Database, tenant schema, queue or permission changes.

## T0–T5

### T0 — Diagnosis and contract

- [x] Reproduce the Pilot journey from access logs and central draft state.
- [x] Prove that no review writer or final submission request reached the server.
- [x] Record ADR 0028 and the draft/submission separation.

### T1 — Portal continuity

- [x] Load the current draft independently from the submitted-store list.
- [x] Render a truthful continuation card with progress, next step and last save.
- [x] Keep submitted stores available when draft recovery fails and hide false empty-state claims.

### T2 — Review and resume correctness

- [x] Resume `/app/new` from the server-required step.
- [x] Invalidate stale or mismatched domain availability immediately.
- [x] Keep the final action available for exact blocker feedback and navigate only after authoritative success.
- [x] Clarify the leave-for-portal action and protect unsaved step input.

### T3 — Verification

- [x] Cover draft continuation and false-empty-state prevention.
- [x] Cover independent draft-read failure.
- [x] Cover missing review requirements and stale availability races.
- [x] Preserve adapter, workspace, lifecycle, submission and portal characterization.

### T4 — Gates

- [ ] Pass complete frontend quality and production build.
- [ ] Pass unchanged backend, repository safety and container integration gates.
- [ ] Update retained Pilot without deleting merchant or draft data and verify the live continuation journey.

### T5 — Evidence and delivery

- [ ] Record final immutable evidence and retained debt.
- [ ] Obtain final independent read-only approval.
- [ ] Commit implementation and evidence separately.
- [ ] Push, open PR, pass required CI and merge.

## Acceptance criteria

- A saved unsubmitted draft appears in the merchant portal as a draft, never as a pending store.
- The portal opens the exact server-required continuation stage.
- Pressing submit with missing review data explains the blocker and sends no request.
- Changing a handle invalidates the previous availability result before submission can begin.
- A draft-read failure does not hide submitted stores and does not produce a false no-draft claim.
- A store appears in platform administration only after the existing authoritative submission succeeds.
- No database, permission, domain-reservation or provisioning behavior changes.

## Rollback

Deploy the previous web image. The existing backend and database require no rollback; unfinished central drafts and submitted stores remain intact. The older portal will stop displaying draft continuity but cannot mutate or reclassify those records.
