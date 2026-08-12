# ADR 0004 — First-party same-origin session authentication

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-12 |
| Decision owners | Eoshop engineering |
| Related work package | WP 1.2 |

## Context

Eoshop is a browser application served with its Laravel API through one Nginx origin. The current interface fabricates user identities locally and has no server session. The platform needs a secure baseline that remains simple for merchants and can run on more than one application replica.

## Decision

Use Laravel's first-party `web` guard with same-origin, cookie-backed sessions and CSRF protection. Session and rate-limit state are stored in central PostgreSQL. The SPA requests a CSRF token and sends it with every state-changing authentication request.

Registration and login regenerate and destroy the previous session identifier. Logout invalidates the session and regenerates the CSRF token. Global web middleware rejects non-active identities and binds authenticated sessions to the current password hash. Password resets use Laravel's password broker, store only hashed reset tokens, rotate the remember token and eagerly delete the user's database sessions; password-hash binding rejects a stale session even if a concurrent request rewrites its row.

No JWT, local-storage token, Sanctum token or third-party authentication package is introduced. Platform roles are returned as server-owned metadata, but route authorization remains WP 1.3.

## Consequences

### Positive

- The browser never handles a reusable bearer token.
- Laravel owns password verification, rehashing, session rotation and reset-token validation.
- PostgreSQL-backed sessions work across multiple PHP replicas without adding Redis to the current operational footprint.
- One identity and one session contract serve merchants and platform operators.

### Trade-offs

- Every authenticated request depends on the shared database until Redis is justified.
- Cookie authentication requires disciplined CSRF handling in the SPA.
- Cross-origin native/mobile clients will require a separate token design later.
- Password-reset delivery requires production mail configuration; the development default writes mail to logs.

## Alternatives rejected

### JWT stored in the browser

Rejected because token revocation, rotation and safe browser storage add complexity without benefit for this same-origin SPA.

### Keep file sessions

Rejected because per-container session files break when requests move between replicas.

### Treat store onboarding data as login state

Rejected because local storage is user-controlled and business draft data cannot prove identity.

### Add Fortify or a starter kit now

Rejected because the required contract is small, the existing interface is custom and Laravel's first-party guard, broker and middleware already provide the necessary primitives.

## Authoritative references

- [Laravel 12 authentication](https://laravel.com/docs/12.x/authentication)
- [Laravel 12 sessions](https://laravel.com/docs/12.x/session)
- [Laravel 12 CSRF protection](https://laravel.com/docs/12.x/csrf)
- [Laravel 12 password reset](https://laravel.com/docs/12.x/passwords)
- [Laravel 12 rate limiting](https://laravel.com/docs/12.x/rate-limiting)
