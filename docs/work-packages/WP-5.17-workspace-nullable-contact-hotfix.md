# WP 5.17 — Newly provisioned workspace nullable-contact hotfix

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.17 |
| Status | Ready for PR |
| Started | 2026-08-24 |
| Branch | `codex/wp-5.17-workspace-nullable-contact` |
| Base | Protected `main` at `ad2e1dae` |
| Dependencies | WP 5.13–5.16 |
| Decision | [ADR 0029](../decisions/ADR-0029-nullable-workspace-contact-boundary.md) |

## Objective

Restore every shared-workspace merchant module for a newly provisioned store whose optional contact phone is null, without mutating retained Pilot data or weakening the typed API boundary.

## T0–T5

### T0 — Pilot diagnosis

- [x] Complete the real submission, approval, provisioning and publication journey.
- [x] Confirm the tenant is approved, active and published.
- [x] Identify the exact server/client mismatch without changing Pilot data.

### T1 — Boundary correction

- [x] Normalize only absent/null workspace phone to an empty form value.
- [x] Preserve fail-closed behavior for malformed present values.
- [x] Keep backend, schema, tenant and provisioning contracts unchanged.

### T2 — Regression coverage

- [x] Reproduce the exact revision-one provisioned workspace shape.
- [x] Cover nullable phone, nullable hero fields, empty catalog and current layout.

### T3 — Gates

- [x] Pass focused and complete frontend quality.
- [x] Pass backend, repository safety and isolated container integration.

### T4 — Retained Pilot

- [x] Update only the Pilot web container.
- [x] Verify the retained revision-one null-contact snapshot against the regression and serve the corrected web asset.

### T5 — Delivery

- [x] Obtain independent read-only approval.
- [x] Record immutable evidence and retained debt.
- [ ] Commit, push, pass required CI and merge.

## Acceptance criteria

- The published Pilot store with `phone: null` loads its shared workspace without a contract error.
- Products, inventory, design, checkout and store-pages routes can consume the same workspace snapshot.
- Null normalization does not accept arrays, objects, booleans or numbers as contact values.
- No retained tenant data or schema is rewritten for the hotfix.

## Rollback

Restore the previous web image. Backend and database state remain compatible and require no rollback.

## Evidence

See [WP 5.17 verification evidence](../evidence/WP-5.17/verification.md).
