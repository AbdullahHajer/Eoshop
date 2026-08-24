# WP 5.17 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.17 — Newly provisioned workspace nullable-contact hotfix |
| Status | Ready for PR |
| Verified | 2026-08-24 |
| Branch | `codex/wp-5.17-workspace-nullable-contact` |
| Base | `ad2e1daefb966ba778262cc43680b5fe46b0ba90` |
| Decision | [ADR 0029](../../decisions/ADR-0029-nullable-workspace-contact-boundary.md) |

## Root cause and delivered boundary

- The retained store completed submission, approval, provisioning and publication successfully; its central state was `approved`, `active`, `published`.
- Provisioning intentionally persisted optional `phone` as JSON `null` in the revision-one workspace.
- The frontend mapper incorrectly required that optional field to be a string, so every merchant route using the shared workspace mapper failed before rendering.
- The mapper now converts only absent/null phone to the empty string required by controlled form inputs.
- A present number, boolean, object or array still fails closed as an unexpected server contract.
- No backend, route, authorization, tenant schema, provisioning, queue or retained data source changed.

## Final verification

### Frontend and repository

- Focused workspace contract gate: 1 file / 9 tests passed.
- Pinned Node 22.23.1 `frontend-quality` image: PASS.
- TypeScript `--noEmit`: PASS.
- Production Vite build: PASS; 2,141 modules transformed.
- Final complete Vitest gate: 47 files / 264 tests passed.
- Exact provisioned response regression covers revision one, `phone: null`, nullable hero fields, empty products and the current home layout.
- Negative regressions reject number, boolean, object and array phone values through the real `workspaceApi.load` path.
- `git diff --check`: PASS.
- `scripts/ci/repository-gate.ps1`: PASS.
- Immutable quality image: `sha256:5f2ae9db5fb9b28e4d2a522bba707471ab125085e1b2b157264357094e2d470a`.
- Immutable web image: `sha256:9a3dabf52e0e88b5f09b2e337d498dbd5deeb88be4ef8a475b1390766ceb4555`.

### Backend and dependency safety

- `composer validate --strict --no-check-publish`: PASS.
- `composer audit --locked`: PASS; no security vulnerability advisories.
- Pint: PASS across 274 files.
- Larastan: PASS across 237 files with no errors.
- PHPUnit unit gate: 3 tests / 6 assertions passed.

### Isolated container integration

- The gate used an isolated central database and test-only application storage.
- Central database integration: 161 tests / 1,735 assertions passed.
- Migration adoption, fail-closed rollback, live HTTP, CSRF, login/registration, authorization, tenant isolation, workspace, inventory, order idempotency, scheduler and provisioning-worker boundaries: PASS.
- Final result: `Container integration gate passed.`
- The isolated containers, network and test-only volumes were removed by the gate; retained Pilot resources were not part of the integration project.

## Independent review

- First verdict found one P1 evidence gap: malformed present phone values were not directly exercised through the service path.
- Dedicated regressions were added for number, boolean, object and array values.
- Final verdict: **APPROVED**, no blocking defects.
- The reviewer confirmed the change is restricted to the typed frontend boundary and does not weaken authentication, tenant isolation, provisioning or backend validation.

## Retained Pilot

- Replaced only `eoshop-pilot-web-1`, from `eoshop/web:wp516-pilot` to `eoshop/web:wp517-pilot`.
- Backend, worker, scheduler and PostgreSQL containers were not recreated.
- Post-update state: web container running and healthy; `http://127.0.0.1:8010/app` returned HTTP 200.
- Served corrected JavaScript asset: `index-C_tHwz7y.js`.
- Read-only post-update database check returned `1|null|null` for current revision, JSON type and phone value in the affected tenant. This proves the client hotfix did not rewrite retained tenant data.
- The actual retained snapshot shape is reproduced by the regression through the same mapper shared by products, inventory, design, checkout and store-pages routes.
- Rollback is web-only by restoring `eoshop/web:wp516-pilot`; no data rollback is required.

## Retained debt

- The main JavaScript bundle remains 846.92 kB minified / 227.08 kB gzip and triggers the existing Vite chunk-size warning. Route/component splitting remains a later performance work package.
- This hotfix does not add merchant features; it restores access to the already implemented shared-workspace modules.
- An authenticated visual spot-check by the Pilot operator remains useful after browser refresh, while the exact failing response and malformed-value boundaries are automated.

## Delivery

- Implementation commit, evidence commit, pull request, required CI, merge commit and protected-main CI will be appended during delivery closeout.
