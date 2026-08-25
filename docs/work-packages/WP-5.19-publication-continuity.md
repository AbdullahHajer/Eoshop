# WP 5.19 — End-to-end publication continuity

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.19 |
| Status | Complete and merged |
| Started | 2026-08-25 |
| Branch | `codex/wp-5.19-publication-continuity` |
| Base | Protected `main` at `34ef4030` |
| Dependencies | WP 5.4–5.18 |
| Decision | [ADR 0031](../decisions/ADR-0031-publication-continuity-boundary.md) |

## Objective

Close the visible merchant journey from existing-store customization through asynchronous provisioning and server-authorized publication without redesigning the management product or weakening server authority.

## Scope

- Separate new-store submission completion from existing-workspace completion.
- Save an existing workspace before returning to the merchant portal.
- Automatically refresh merchant lifecycle snapshots while review/provisioning is transitional.
- Automatically refresh the platform store queue while provisioning is transitional.
- Preserve manual refresh, failed-provisioning retry, publication blockers and server capabilities.
- Verify the retained Pilot journey through a server-confirmed public URL.

## Exclusions

- Removing or adding merchant/platform management tabs.
- General visual redesign or appearance-option expansion.
- Public storefront cross-browser/device acceptance; it follows as WP 5.20.
- Payment gateway capture, shipping integrations or production notifications.
- Backend lifecycle, authorization, tenant schema or database changes.

## T0–T5

### T0 — Scope and baseline

- [x] Reproduce the existing-store completion callback collision.
- [x] Confirm that the retained worker completed the observed provisioning job.
- [x] Confirm that the central tenant became active while the loaded administration snapshot remained queued.

### T1 — Design

- [x] Record split completion intent and bounded server refresh in ADR 0031.
- [x] Keep publication capability, blockers and public domain server-authoritative.

### T2 — Implementation

- [x] Correct existing-store completion without changing onboarding submission.
- [x] Add bounded lifecycle refresh to merchant and platform store lists.
- [x] Preserve failure, retry, conflict and session-expiry behavior.

### T3 — Verification

- [x] Add completion and polling regressions.
- [x] Pass focused and complete frontend quality.
- [x] Pass backend, repository and isolated integration gates.

### T4 — Pilot

- [x] Update the retained Pilot without resetting its database.
- [x] Verify the retained approval/provisioning state, completion contracts, publication and exact public URL.

### T5 — Delivery

- [x] Obtain independent read-only approval.
- [x] Record evidence, retained debt and rollback.
- [x] Commit, push, pass required CI and merge.

## Acceptance criteria

- Completing customization for an existing workspace saves it and returns to `/app`.
- Existing-workspace completion cannot open or submit the new-store domain modal.
- A failed save or revision conflict does not navigate away from the editor.
- Visible transitional stores refresh automatically and stop polling at a terminal server state or the bounded attempt limit.
- Publication remains unavailable until the server returns the capability with no blockers.
- Publishing returns an exact public domain that can be opened from the merchant portal.

## Rollback

Deploy the previous web image. This work package does not migrate or rewrite persisted data.

## Evidence

See [WP 5.19 verification evidence](../evidence/WP-5.19/verification.md).
