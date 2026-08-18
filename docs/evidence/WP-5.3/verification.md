# WP 5.3 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.3 — Pilot QA readiness |
| Status | Verification complete; delivery pending |
| Verified | 2026-08-19 |
| Branch | `codex/wp-5.3-pilot-qa-readiness` |
| Base | `a47b65e40b3827617e8e1e06a94de78a8279c146` |
| Implementation commit | `fb59aa6835dbdebcb51c2f3e3a7bdf7e640a5bbd` |

## Delivered Pilot boundary

- An isolated, non-destructive `eoshop-pilot` Compose project with its own volumes and default gateway port `8010`.
- A secure preparation script that preserves the ignored application key, validates the local database configuration, applies central migrations, seeds identity data, verifies the automatic active `starter` plan, migrates active tenant schemas and starts services in dependency order.
- A non-production QA administrator command that refuses identity takeover, validates credentials from a named environment variable and revokes sessions plus the remember token during an authorized credential rotation.
- A browser-resolvable loopback wildcard using `lvh.me`; generated public-store links preserve the active gateway port.
- A QA runbook covering registration, submission, approval, provisioning, publication, customization and the positive publish/edit/archive product journey.
- A structured Pilot defect template that prohibits credentials, cookies and sensitive payloads.

## Independent review

- Early review identified host resolution, identity takeover, secret handling, startup ordering, positive product visibility, environment restoration and active-tenant migration coverage as blocking requirements.
- Every blocking requirement was incorporated and retested.
- Final independent read-only verdict: **APPROVE**, with no blocking findings.

## Live Pilot preparation

- `scripts/qa/prepare-pilot.ps1 -SkipBuild`: PASS on the isolated `eoshop-pilot` project.
- Central migrations and `IdentitySeeder`: PASS; rerun reported no pending migrations.
- QA administrator create/rotation path: PASS; plaintext was neither printed nor recorded.
- Loopback DNS preflight and exact unknown tenant Host boundary: PASS; the unresolved tenant Host returned HTTP `404` rather than falling back to the central application.
- Central application health: PASS at `http://127.0.0.1:8010/up`.
- Required services after preparation: `db`, `backend`, `web`, `worker` and `scheduler` all running.
- Convergence/environment check: PASS; `QA_ADMIN_PASSWORD` was removed and all managed process environment variables were restored after the run.

## Focused command gate

Environment: isolated PostgreSQL Pilot database with `APP_ENV=testing`.

- PHPUnit: **6 tests / 54 assertions passed**.
- Covered administrator create/rotation, session and remember-token revocation, missing/weak credentials, production refusal, merchant/reviewer/suspended identity rejection, active tenant schema migration, non-active tenant skip, missing schema refusal, central-context restoration and missing/inactive/manual `starter` plan refusal.

## Backend quality gate

Environment: `eoshop/backend-quality:ci` built from `docker/php/Dockerfile` target `quality`.

- Composer validation and locked dependency audit: PASS.
- Laravel Pint: **190 files passed**.
- Larastan: **161 files / no errors**.
- Backend unit suite: **3 tests / 6 assertions passed**.

## Frontend quality gate

Environment: pinned `node:22.23.1-alpine3.24` through the `frontend-quality` target.

- TypeScript check and Vite production build: PASS.
- Vitest: **22 files / 114 tests passed**.
- Public store URL tests verify central-host rejection, tenant host construction and gateway-port preservation.
- `npm audit --audit-level=high`: **0 vulnerabilities**.
- The two existing checkout interface tests received a scoped ten-second timeout after passing independently; their assertions and production behavior were unchanged.

## Repository and container integration gates

- `scripts/ci/repository-gate.ps1`: PASS.
- PostgreSQL/container integration: **97 tests / 912 assertions passed**.
- Central and tenant migrations, populated rollback/reapply, route cache, HTTP authorization/Host boundaries, live tenant schema, database worker and scheduler checks: PASS.
- Integration project `eoshop-wp53-ci` and only its own network/volumes were removed after the run.
- The isolated `eoshop-pilot` worker and scheduler were restored after resource-intensive gates.
- `git diff --check`: PASS.

## Handoff and limitations

- QA entry point: [`docs/qa/pilot-test-runbook.md`](../../qa/pilot-test-runbook.md).
- The QA lead chooses the administrator password through the secure interactive prompt immediately before handoff; no usable password is committed in this evidence.
- Product removal is archive, not hard delete.
- Public deployment, external email, payment settlement and social-platform publishing remain explicitly out of scope for this local Pilot.

## Delivery status

- Implementation is recorded separately in `fb59aa6835dbdebcb51c2f3e3a7bdf7e640a5bbd`.
- Evidence commit, pull request, required CI results, merge commit and protected-`main` run will be recorded during closeout.
