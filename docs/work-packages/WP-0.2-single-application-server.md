# WP 0.2 — Single application server

| Field | Value |
|---|---|
| Phase | Phase 0 — Baseline, governance and unified operation |
| Work Package | WP 0.2 |
| Status | Complete and merged |
| Started | 2026-08-12 |
| Branch | `codex/wp-0.2-single-server` |
| ADR | [ADR 0001](../decisions/ADR-0001-laravel-single-application-server.md) |

## Objective

Make Laravel the only Eoshop application server while preserving the existing React user experience and API URL contract. Node.js becomes a frontend build/development tool, and Docker becomes the reproducible execution path for the declared PHP and Node versions.

## Scope

- Remove the Express application server and duplicate Gemini implementation.
- Make Vite development proxy `/api` to Laravel.
- Complete the minimum Laravel 12 skeleton required to boot the central API.
- Align Composer constraints with the locked Laravel 12 and Stancl Tenancy versions.
- Configure Gemini through Laravel only.
- Build frontend static assets and the Laravel runtime through Docker.
- Pin container image versions used by WP 0.2.
- Replace the misleading PgBouncer placeholder with the simpler topology actually used.
- Document development and container operation accurately.

## Out of scope

- Merchant or platform authentication and authorization (Phase 1).
- Registering and repairing tenant-domain routes and provisioning (Phase 2).
- Replacing `localStorage` business data (Phase 3).
- Correct order pricing, inventory transactions or payment processing (Phase 4).
- Broad frontend decomposition (Phase 5).
- Redis, horizontal scaling, CDN or production observability (Phase 6).
- Calling Gemini with a real API key during verification.

## T0 — Baseline observations

- `npm run dev` starts Express, not Vite directly.
- `npm run build` bundles both Vite and `server.ts`.
- Express and Laravel both implement `POST /api/generate-store-ideas`.
- Docker/Nginx sends API requests to Laravel, producing environment drift.
- The lock file contains Laravel `v12.65.0`, while project descriptions claim Laravel 11 and Composer permits any framework version.
- The host PHP is 8.3.28 while locked dependencies require PHP 8.4.1 or newer.
- The Laravel tree lacks the base Controller, provider bootstrap and core configuration files.
- The current Dockerfile depends on host-mounted `backend/vendor` and uses `composer:latest`.
- The current web container depends on a host-built `dist/` directory.
- PgBouncer is declared but Laravel connects directly to PostgreSQL.

## T1 — Design

### Runtime flow

```text
Browser
  ├─ development → Vite :3000 ── /api proxy ── Laravel/Nginx :8000
  └─ container   → Nginx :8000
                              ├─ static SPA
                              └─ /api and /up → PHP-FPM → Laravel
```

### Version decisions

| Component | WP 0.2 baseline |
|---|---|
| Node build image | `node:22.23.1-alpine3.24` |
| Nginx image | `nginx:1.30.4-alpine3.24` |
| PHP image | `php:8.4-fpm-alpine3.24` |
| Composer binary | `composer:2.10.2` |
| PostgreSQL image | `postgres:17.10-alpine3.24` |
| Laravel constraint | `^12.0` |
| Stancl Tenancy constraint | `^3.10` |
| Gemini model default | `gemini-3.5-flash` (overridable by environment) |

Patch-level PHP remains on the official maintained PHP 8.4 Alpine line because Composer requires PHP 8.4.1+ and the official image tag supplies maintained patch releases. Application dependencies remain reproducible through committed lock files.

### Configuration boundaries

- Root `.env`: Compose interpolation and frontend-safe `VITE_*` values only.
- `backend/.env`: Laravel secrets and runtime settings; never committed.
- Docker build: does not copy either real `.env` file.
- Gemini API key: read only through `config/services.php` in Laravel.

### Rollback

Revert the WP 0.2 commits on this branch. No database migration is introduced by this Work Package. The baseline commit on `main` preserves the original Express path if rollback is required before merge.

## Acceptance criteria

- [x] `server.ts` is removed.
- [x] Express, dotenv and the frontend Gemini SDK are absent from direct dependencies.
- [x] Frontend build emits static assets only.
- [x] Vite proxies `/api` to the configurable Laravel URL.
- [x] Laravel boots and lists the central API routes and `/up` responds successfully.
- [x] Gemini model, endpoint and key are server-side configuration.
- [x] Composer constraints match Laravel 12 and the lock file validates.
- [x] Docker images build without host `node_modules`, `vendor` or `dist`.
- [x] Nginx configuration sends only `/api` and `/up` to Laravel.
- [x] Compose configuration contains no PgBouncer service and exposes no PHP-FPM port.
- [x] No real secrets or real `.env` files are staged.
- [x] Verification evidence is recorded before commit/PR.

## Planned gates

| Gate | Command / evidence |
|---|---|
| Frontend manifest | `npm ci` against the committed lock file |
| TypeScript | `npm run lint` |
| Frontend production build | `npm run build` |
| Composer manifest/lock | `composer validate --strict` |
| PHP syntax | `php -l` for application/configuration PHP files |
| Laravel boot | `php artisan --version` and `php artisan route:list --except-vendor` in PHP 8.4 |
| Nginx syntax | `nginx -t` in the built web image |
| Compose model | `docker compose config --quiet` with example environment |
| Single-server assertion | No `server.ts`, Express dependency or second `/api` server |
| Repository hygiene | staged file and secret-signature checks |

## Evidence

See [WP 0.2 verification evidence](../evidence/WP-0.2/verification.md).
