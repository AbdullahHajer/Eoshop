# WP 1.1 verification — 2026-08-12

## Scope

Verification covers the central identity schema, deterministic roles and permissions, scoped assignments, audit writes, Laravel quality gates, the unchanged frontend gates and the production container path.

## Local results

| Gate | Result | Evidence |
|---|---|---|
| Repository safety | Pass | `scripts/ci/repository-gate.ps1` completed successfully |
| GitHub Actions syntax | Pass | Pinned actionlint `1.7.12` image returned exit code 0 |
| Composer validation | Pass | Strict validation returned valid |
| Composer audit | Pass | No security advisories |
| Laravel Pint | Pass | 48 files |
| Larastan | Pass | 31 analyzed paths; no ignored-error baseline |
| Fast backend tests | Pass | 3 tests, 6 assertions |
| Frontend quality | Pass | TypeScript, 2 Vitest tests and production Vite build |
| npm audit | Pass | 0 vulnerabilities at high severity threshold |
| PostgreSQL identity tests | Pass | 9 tests, 30 assertions after independent-review fixes |
| Migration lifecycle | Pass | Clean apply, targeted rollback, reapply, reseed and status verification |
| HTTP/container smoke | Pass | `/` 200, `/up` 200 and unknown `/api` route JSON 404 |
| Cleanup | Pass | Temporary containers, volumes and network removed |

## Database scenarios verified

- The four system roles and eleven permission keys seed idempotently.
- Email is trimmed and normalized to lowercase; normalized duplicates fail the unique constraint.
- Passwords use Laravel's hashed cast and password/remember-token values are omitted from serialization.
- One user can hold a platform role and different tenant roles in different stores.
- Tenant permission checks require the requested tenant and an active membership.
- Suspended users lose tenant permissions.
- Platform roles cannot be assigned as tenant roles and tenant roles cannot be assigned as platform roles.
- Composite database constraints reject cross-scope role-permission mappings.
- Successful assignments emit central audit records; idempotent repeats emit no duplicate record.
- Actor and tenant identifier snapshots survive hard deletion of their source records.
- The WP migration reverses and reapplies without dropping the pre-existing tenant or domain tables.

## Non-blocking observation

The frontend production build retains its existing bundle-size warning (`782.99 kB` main JavaScript chunk). It is not introduced by WP 1.1 and remains a later frontend decomposition/performance item.

## Pending before merge

- Required GitHub checks on the pull request.
- Final commit and run identifiers.

## Independent review

The read-only reviewer initially returned `REQUEST_CHANGES` for permission-scope enforcement, audit-history retention, actor attribution and concurrency. After the schema, service and negative-test changes, the reviewer rechecked the latest working tree and returned `APPROVE` with no blocking findings.

One non-blocking observation remains: per-user row locking is structurally verified and PostgreSQL-backed behavior passes, but a two-connection concurrency stress test may be added in a later hardening package.
