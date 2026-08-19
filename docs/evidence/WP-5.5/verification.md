# WP 5.5 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.5 — Server-owned draft, resubmission and merchant publication |
| Status | Implementation verified; delivery in progress |
| Verified | 2026-08-19 |
| Branch | `codex/wp-5.5-store-draft-publication` |
| Base | `7fffc5d01714561eeca6e3ee36d8119bcf2065e9` |
| Implementation commit | `6df5080f25cbc8d9eaf5c1699192705e3fbf81c9` |

## Delivered product boundary

- A revisioned, server-owned new-store draft that restores across sessions and cannot be overwritten by a stale browser revision.
- First submission atomically links the authoritative draft to its tenant and replays the same idempotency receipt under the active-user lock.
- Platform rejection opens one correction state; the exact owner can save, resubmit and preserve the tenant, domain, subscription and publication history.
- Merchant owners receive an explicit publication permission and server-authorized publish/unpublish actions guarded by current readiness and locked membership.
- The merchant portal projects truthful state-specific capabilities, review feedback, next actions and a public link only after server-confirmed publication.
- Browser draft, workspace and account transitions discard stale asynchronous results and retain exact lifecycle POST recovery after an ambiguous response.

## Independent review

- Read-only review challenged draft/tenant database integrity, active-user replay, first-submit concurrency, account isolation, `/app/new` context ownership, revision recovery and ambiguous lifecycle responses.
- Blocking findings were corrected with composite database constraints, locked revalidation, exact replay receipts, abort/sequence guards and App-level component tests.
- Final independent read-only verdict: **APPROVE**, with no blocking findings.

## Frontend quality gate

Environment: pinned `node:22.23.1-alpine3.24` through the Docker `frontend-quality` target.

- TypeScript check and Vite production build: PASS.
- Vitest: **25 files / 147 tests passed**.
- Covered server draft restoration, explicit local recovery, correction/resubmission, publish/unpublish capabilities, revision reload, ambiguous-response replay, account switch, logout failure, double `/app/new` entry and draft-to-workspace isolation.
- `npm audit --audit-level=high`: **0 vulnerabilities**.
- The existing production-bundle size warning remains non-blocking and is retained for later decomposition work.

## Backend quality gate

Environment: `eoshop/backend-quality:wp55-r6`, built from the final implementation tree.

- Composer validation and locked dependency audit: PASS; no vulnerability advisories.
- Laravel Pint: **204 files passed**.
- Larastan: **174 files / no errors**.
- Backend unit suite: **3 tests / 6 assertions passed**.

## Repository and container integration gates

- `scripts/ci/repository-gate.ps1`: PASS.
- `git diff --check`: PASS; the PowerShell LF/CRLF notice is non-blocking and contains no whitespace error.
- Exact application images: `eoshop/backend:wp55-r8` and `eoshop/web:wp55-r8`.
- PostgreSQL/container integration: **106 tests / 1036 assertions passed**.
- Covered constraints and adoption, populated rollback refusal, staged rollback/reapply, real concurrent first submission, active-user replay, correction/resubmission, publication races, HTTP/CSRF/Host boundaries, route cache, tenant migrations, database worker and scheduler.
- Integration project `eoshop-wp55-r8`, its containers, network and volumes were removed after the successful run; the user's local Pilot stack was not touched.

## Product handoff

- The merchant can now retain a store draft, submit it, see rejection feedback, correct and resubmit the same store, and publish or unpublish an eligible store from the portal.
- The next product work should deepen merchant operational modules and then replace the minimal platform administration modal with the planned full administration console.
- External DNS/TLS, payment capture/refunds, messaging integrations, destructive tenant deletion and production observability remain deliberately deferred.

## Delivery status

- Implementation is recorded separately in `6df5080f25cbc8d9eaf5c1699192705e3fbf81c9`.
- Evidence is recorded in the following documentation-only commit.
- PR, required CI, merge and protected-main CI facts will be added only after GitHub confirms them.
