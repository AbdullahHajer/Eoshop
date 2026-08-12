# WP 1.2 — Real authentication and sessions

| Field | Value |
|---|---|
| Phase | Phase 1 — Identity, authentication and authorization |
| Work Package | WP 1.2 |
| Status | Ready for pull request; local gates and independent review passed |
| Started | 2026-08-12 |
| Branch | `codex/wp-1.2-auth-sessions` |
| Base | Protected `main` at `f0833de` |
| Dependency | WP 1.1 central identity model |
| Decision | [ADR 0004](../decisions/ADR-0004-first-party-session-authentication.md) |

## Objective

Replace simulated browser identities and hard-coded administrator login with one server-owned Laravel identity and secure, same-origin sessions. Registration, login, logout, session restoration and password reset must work through real API calls and survive horizontal application scaling through shared PostgreSQL state.

## Scope

- Add CSRF-protected same-origin authentication endpoints under `/api/auth` using Laravel's `web` middleware stack.
- Implement registration, login, logout and current-session endpoints.
- Implement password-reset link requests and password replacement with Laravel's password broker.
- Regenerate the session identifier after registration/login; invalidate the session and regenerate the CSRF token on logout.
- Bind authenticated sessions to the current password hash and reject non-active identities on every web request.
- Reject suspended, pending and soft-deleted users at login.
- Apply endpoint-specific rate limits keyed by normalized email and client IP.
- Add central PostgreSQL tables for sessions, password-reset tokens and shared cache/rate limiting.
- Return a minimal authenticated-user representation including authoritative platform role keys.
- Replace the frontend's simulated `authUser` and hard-coded administrator acceptance with real API calls.
- Treat the store onboarding brief as business draft data, not as an authentication identity.
- Remove simulated Google/Apple login actions until a real provider integration exists.
- Add backend PostgreSQL integration tests and frontend API-client tests.

## Out of scope

- Authorization middleware/policies for administration and tenant resources (WP 1.3).
- Email verification as a login requirement.
- OAuth/social providers, MFA, passkeys or API tokens.
- Creating the first platform administrator through a public endpoint.
- Tenant provisioning and assigning the merchant-owner role during store creation (Phase 2).
- Moving sessions/rate limits from PostgreSQL to Redis; PostgreSQL is the shared durable baseline.
- Rebuilding the large `App.tsx` layout outside changes required to remove simulated identities.

## T0 — Baseline

- The central `User` model and scoped role model exist, but no HTTP authentication controller or route exists.
- `AuthGateway` accepts any submitted credentials after a timer and creates a random browser identity.
- `AdminAuthModal` accepts every non-empty credential, including a displayed hard-coded example.
- The application has separate `authUser` and `registeredUser` states; the latter is restored from `localStorage` and treated as proof of identity.
- Logout only clears React/local-storage state; no server session is invalidated.
- Social-login buttons create a fixed fake user.
- `SESSION_DRIVER` and `CACHE_STORE` default to per-container files, which do not provide shared state across replicas.
- The password broker references `password_reset_tokens`, but the table and mail/reset URL configuration do not exist.
- Administration API routes remain public and are explicitly deferred to WP 1.3.

## T1 — Design

### Session boundary

- Authentication routes are registered in `web.php` so Laravel's session, cookie and CSRF middleware apply.
- The SPA obtains a CSRF token from a safe GET endpoint and sends it in `X-CSRF-TOKEN` for mutations.
- The browser receives only an opaque, HTTP-only session cookie; credentials or bearer tokens are never stored in `localStorage`.
- Sessions use PostgreSQL so multiple PHP replicas share authentication state. Session encryption is enabled by default.

### Endpoint contract

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/auth/csrf` | Establish session and return the current CSRF token |
| GET | `/api/auth/session` | Return the active authenticated user or `null`; reject a stale/non-active authenticated session with 401 |
| POST | `/api/auth/register` | Create an active account and start a session |
| POST | `/api/auth/login` | Authenticate an active account and rotate session ID |
| POST | `/api/auth/logout` | End the authenticated session and rotate CSRF token |
| POST | `/api/auth/forgot-password` | Request a reset link without account enumeration |
| POST | `/api/auth/reset-password` | Validate a broker token, replace password and revoke sessions |

### Threats and controls

| Threat | Control |
|---|---|
| Session fixation | Regenerate session identifier after registration and successful login |
| CSRF on state-changing endpoints | Laravel web CSRF middleware plus explicit SPA token header |
| Credential stuffing | Login throttle combines normalized email and IP; generic failure response |
| Account enumeration through reset | Forgot-password endpoint always returns the same accepted response |
| Suspended user retains access | Global web middleware invalidates non-active authenticated sessions before controllers run |
| Stolen or concurrently rewritten session survives password reset | Laravel authenticated-session hash binding rejects any session created under the previous password; database rows are also deleted eagerly |
| Browser forges admin identity | Platform roles come from central database; no client-selected role |
| One container owns the session | Database-backed sessions and rate limiter cache |
| Fake social or admin login remains reachable | Remove simulated social actions and connect admin form to the same server login |

### Rollback

Revert frontend integration and authentication routes first, then reverse the WP 1.2 system migration. Existing WP 1.1 identities and authorization records remain intact. In a live environment, deleting session/reset/cache tables logs users out and discards pending reset links but must not delete users.

## Acceptance criteria

- [x] Registration stores a normalized identity with a hashed password and starts a rotated session.
- [x] Login succeeds only for active users and returns a generic failure otherwise.
- [x] Session restoration returns the same authoritative user across requests.
- [x] Logout invalidates the session and rotates the CSRF token.
- [x] Forgot-password responses do not reveal whether an email exists.
- [x] A valid reset token replaces the password and revokes existing database sessions.
- [x] Auth mutations are CSRF-protected and rate limited.
- [x] Session, reset-token and limiter state can be shared across application replicas.
- [x] Frontend authentication uses API responses and never persists credentials/tokens in local storage.
- [x] Hard-coded administrator and simulated social authentication are removed.
- [x] Store-onboarding draft data is no longer treated as identity proof.
- [x] Backend, frontend, repository and container integration gates pass locally.
- [x] Independent review and exact local evidence are recorded before merge.

## Evidence

Local evidence is recorded in [`docs/evidence/WP-1.2/verification.md`](../evidence/WP-1.2/verification.md). GitHub run identifiers will be added after the pull request checks complete.
