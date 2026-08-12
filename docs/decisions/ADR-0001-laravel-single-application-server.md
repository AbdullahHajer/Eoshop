# ADR 0001 — Laravel is the single application server

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-12 |
| Decision owners | Eoshop engineering |
| Related work package | WP 0.2 |

## Context

The baseline contains two application-server paths:

- Express in `server.ts`, serving the Vite development middleware and a Gemini endpoint.
- Laravel under `backend/`, defining the central API, tenant API and a second Gemini implementation.

The two paths use different SDKs, model names, error behavior, deployment flows and runtime assumptions. Development currently reaches Express while Nginx sends `/api` to Laravel. A feature can therefore work in one environment and fail or behave differently in another.

Laravel is already the intended home for tenancy, PostgreSQL access, future authentication, authorization, orders and platform administration. Keeping Express as a second application server would duplicate cross-cutting controls and make security boundaries ambiguous.

## Decision

Laravel 12 is the only Eoshop application server and the only owner of `/api`.

- React/Vite remains the web interface.
- Node.js remains a build and development tool only.
- Vite development proxies `/api` to Laravel.
- Nginx serves the compiled SPA and sends `/api` and `/up` to Laravel through PHP-FPM.
- Gemini credentials and requests exist only in the Laravel runtime.
- Docker builds the frontend and backend from committed manifests and lock files.
- `server.ts`, Express and the frontend Gemini SDK are removed.

## Consequences

### Positive

- One security boundary and one API behavior across environments.
- Gemini credentials are no longer part of the frontend/Node toolchain.
- Authentication, tenancy and business rules can be added without duplicating middleware.
- The deployment topology becomes easier to reproduce and audit.

### Trade-offs

- Frontend-only development now requires a reachable Laravel API for API features.
- Docker images must build both Composer and npm dependencies.
- The incomplete Laravel skeleton must be repaired before the existing API can boot.

## Rejected alternatives

### Keep Express for development only

Rejected because it preserves behavioral drift: development and deployment would still execute different application code.

### Move all backend behavior to Node

Rejected because it discards the existing Laravel tenancy and database direction and would amount to an unnecessary rewrite.

### Keep two public application servers

Rejected because authentication, authorization, validation, rate limiting, logging and error policies would need to be implemented twice.

## Guardrails

- A future Node worker is allowed only for a bounded workload that cannot reasonably live in Laravel; it must not own the public application API.
- No browser-accessible environment variable may contain the Gemini API key.
- New `/api` routes must be implemented in Laravel.
- Changing this decision requires a superseding ADR.

## Authoritative references

- [Laravel 12 application skeleton](https://github.com/laravel/laravel/tree/12.x)
- [Gemini Generate Content API](https://ai.google.dev/gemini-api/docs/generate-content/text-generation)
- [Docker PHP-FPM guidance](https://hub.docker.com/_/php/)
