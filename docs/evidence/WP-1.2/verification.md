# WP 1.2 verification — 2026-08-12

## Scope

Verification covers real Laravel authentication, database-backed sessions and rate limiting, password reset, the SPA authentication client, migration lifecycle, CSRF enforcement and the production container path.

## Local results

| Gate | Result | Evidence |
|---|---|---|
| Repository safety | Pass | `scripts/ci/repository-gate.ps1` completed successfully |
| Git diff hygiene | Pass | `git diff --check` returned no errors |
| Composer validation | Pass | Strict validation returned valid |
| Composer audit | Pass | No security advisories |
| Laravel Pint | Pass | 59 files |
| Larastan | Pass | 40 analyzed paths; no errors |
| Fast backend tests | Pass | 3 tests, 6 assertions |
| Frontend quality | Pass | TypeScript, 5 Vitest tests (including reviewer/super-admin separation) and production Vite build |
| npm audit | Pass | 0 vulnerabilities at the high-severity threshold |
| PostgreSQL database tests | Pass | 19 tests, 93 assertions with `SESSION_DRIVER=database` and `CACHE_STORE=database` |
| Migration lifecycle | Pass | Clean apply, targeted auth/identity rollback, reapply, reseed and status verification |
| Live CSRF/session boundary | Pass | Verified 419 without CSRF, 422 after CSRF, registration cookie rotation and authenticated restoration |
| HTTP/container smoke | Pass | SPA `/` 200, `/up` 200, unknown `/api` JSON 404 and unauthenticated session `data: null` |
| Cleanup | Pass | Temporary containers, volumes and network removed |

## Authentication scenarios verified

- Registration normalizes email, hashes the password, creates an active central identity and authenticates it.
- Login returns database-owned platform roles and updates `last_login_at`.
- Wrong passwords, suspended users and soft-deleted users receive the same generic validation error.
- Global web middleware restores active users and rejects a newly suspended identity before a protected controller runs.
- Logout ends the authenticated session.
- Password-link responses are identical for existing and absent email addresses.
- A valid password broker token replaces the password, consumes the token and deletes the user's database sessions; password-hash session binding also rejects a concurrently surviving old session.
- The login limiter rejects the sixth attempt for the same normalized email and IP.
- The CSRF endpoint returns a session-bound token, and the live web middleware rejects an untrusted mutation.
- The frontend obtains CSRF before mutation, sends only same-origin cookies and surfaces server validation errors without fabricating an identity.

## Deployment conditions

- Production must set `APP_FRONTEND_URL` to the public SPA origin so reset links resolve correctly.
- Production HTTPS must set `SESSION_SECURE_COOKIE=true`; `SameSite=Lax`, HTTP-only cookies and encrypted database sessions remain enabled.
- Mail defaults to the log driver for development and must be replaced with an operational mail transport before public password reset is enabled.
- The shared PostgreSQL cache is the scale-safe baseline for sessions and throttles; Redis remains an optional later performance optimization.

## Non-blocking observation

The frontend build reports a `787.63 kB` main JavaScript chunk. This is existing decomposition/performance debt and remains outside the authentication boundary of WP 1.2.

## Pending before merge

- GitHub required checks and their exact run identifier after the pull request is opened.

## Independent review

The read-only reviewer initially returned `REQUEST_CHANGES` for timing-based login enumeration, fail-open suspended sessions, password-reset/session races, database-store test coverage, misleading logout success and over-broad client administrator mapping. The implementation and tests were hardened after each finding.

The final review of the complete working tree returned `APPROVE` with no blocking findings. In particular, the reviewer verified immediate password-hash binding after registration/login and the negative test that changes the password immediately after login, before any intermediate endpoint, then requires a 401 response.
