# WP 5.16 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.16 — Onboarding draft continuity and explicit submission |
| Status | Complete and merged |
| Verified | 2026-08-24 |
| Branch | `codex/wp-5.16-draft-continuity` |
| Base | `74b374e794522644c77f6a97bb29f1f6e5d43363` |
| Implementation commit | `320e7010e0c587b9e24a3aca507e2486a9c16856` |

## Delivered boundary

- The merchant portal restores the separate owner-scoped current draft alongside submitted stores and renders it as “not submitted”.
- Generic creation resumes from the server-owned required step.
- Review requirements are visible and the final action explains a blocker instead of failing through a disabled control.
- Domain availability is bound to the exact normalized handle and request generation.
- Draft recovery failure is isolated from submitted-store management and never produces a false empty-state claim.
- Platform administration, database schema, authorization, domain reservation, submission idempotency and provisioning remain unchanged.

## Final verification

### Frontend and repository

- Pinned Node 22.23.1 `frontend-quality` image: PASS.
- TypeScript `--noEmit`: PASS.
- Production Vite build: PASS; 2,141 modules transformed.
- Final complete Vitest gate: 47 files / 259 tests passed.
- `git diff --check`: PASS.
- `scripts/ci/repository-gate.ps1`: PASS.
- Immutable quality image manifest: `sha256:a071b1f8e40254a46b76a73f373183e111b2fca45e79f1eace64375df1c4c789`.
- Immutable web image manifest: `sha256:0051113f43631169dd27b26fb839b4699feaec7e5b9786a72090966c11b1ca6f`.

### Backend and dependency safety

- `composer validate --strict --no-check-publish`: PASS.
- `composer audit --locked`: PASS; no security vulnerability advisories.
- Pint: PASS across 274 files.
- Larastan: PASS across 237 files with no errors.
- PHPUnit unit gate: 3 tests / 6 assertions passed.
- No backend, database, route, authorization, tenant schema or queue source changed in WP 5.16.

### Isolated container integration

- Project: `eoshop-wp516-current`; bound to test-only port `18086`.
- Central database integration: 161 tests / 1,735 assertions passed.
- Migration adoption and fail-closed rollback assertions: PASS.
- Live HTTP, CSRF, login/registration, platform authorization, tenant isolation, workspace, inventory, order idempotency, scheduler and provisioning-worker boundaries: PASS.
- Final result: `Container integration gate passed.`
- The isolated containers, network and the two test-only volumes were removed by the gate; the retained Pilot was not part of this project.

## Independent review

- Final verdict: **APPROVED**, no blocking defects.
- The first pass identified two P1 defects: a hanging draft request could delay the submitted-store list, and the client assumed a `starter` plan even when only another active plan existed.
- Both defects were corrected before approval and covered by dedicated regression tests.
- The reviewer reconfirmed owner/tenant isolation, truthful draft/submission separation, server-owned step resume, domain-race invalidation and unchanged authoritative submission checks.
- Non-blocking resource note: an older unresolved `currentDraft` promise is generation-guarded rather than actively aborted after refresh/logout. It cannot overwrite newer state or hide submitted stores; transport cancellation remains a future optimization.

## Retained Pilot

- Updated only `eoshop-pilot-web-1` from `eoshop/web:wp515-pilot` to `eoshop/web:wp516-pilot`.
- Backend, worker, scheduler and PostgreSQL containers were not recreated.
- Post-update web state: running and healthy; `http://127.0.0.1:8010/` returned HTTP 200.
- Served final assets: `index-BRmQP2_s.js` and `index-CLrFH50a.css`.
- Read-only post-update database check retained three `draft` rows and three `submitted` rows.
- Rollback remains web-only by restoring the previous image; no data rollback is required.

## Retained debt

- The main JavaScript bundle is 846.92 kB minified / 227.07 kB gzip and still triggers the existing Vite chunk-size warning. Route/component splitting remains a later performance work package.
- WP 5.16 deliberately does not add draft deletion, multiple unbound drafts, early domain reservation or platform visibility of private unsubmitted drafts.

## Delivery

- Implementation is recorded separately in `320e7010e0c587b9e24a3aca507e2486a9c16856`.
- Evidence is recorded separately in `a6f2504a9d46614cc8892803df4d319fb500e324`.
- Pull request [#56](https://github.com/sas-prog1/Eoshop/pull/56) was merged from final head `a6f2504a9d46614cc8892803df4d319fb500e324`.
- Pull-request CI run [32743018048](https://github.com/sas-prog1/Eoshop/actions/runs/32743018048) passed Repository safety, Backend quality, Frontend quality and Container integration.
- Merge commit: `a189d02366ba25b3a1d40480414da3cd034e1d30`.
- Protected-main CI run [32743734327](https://github.com/sas-prog1/Eoshop/actions/runs/32743734327) passed the same four required jobs after merge.
