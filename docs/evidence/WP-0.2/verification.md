# WP 0.2 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 0.2 — Single application server |
| Date | 2026-08-12 |
| Branch | `codex/wp-0.2-single-server` |
| Result | Passed locally |

## Verified outcome

- Laravel 12 is the only application server and the only owner of `/api`.
- Vite is a frontend development/build tool and proxies API calls to Laravel.
- Nginx serves the production SPA and forwards only `/api` and `/up` to PHP-FPM.
- Gemini credentials and provider calls exist only in Laravel configuration/service code.
- Docker builds frontend and backend artifacts from committed lock files.
- Compose starts Nginx, Laravel/PHP-FPM and PostgreSQL without PgBouncer or a public PHP-FPM port.

## Gate results

| Gate | Result | Evidence summary |
|---|---|---|
| JSON and Compose parse | Pass | `package.json` and `composer.json` parsed; `docker compose --env-file .env.example config --quiet` exited 0. |
| Composer lock | Pass | `composer update --lock --no-install --no-scripts` completed; no packages changed and no security advisories were reported. |
| Composer validation | Pass | `composer validate --strict --no-check-publish` reported `./composer.json is valid`. |
| PHP syntax | Pass | Every PHP file under `app`, `bootstrap`, `config` and `routes` passed `php -l`. |
| Laravel boot | Pass | Production dependencies installed from lock; `php artisan --version` reported Laravel Framework 12.65.0. |
| Laravel routes | Pass | `route:list --except-vendor` loaded the five central application routes. |
| PHP-FPM configuration | Pass | `php-fpm -t` reported a successful configuration test in the final backend image. |
| Laravel package discovery | Pass | The final backend image ran `php artisan package:discover` while building. |
| Frontend lock install | Pass | Docker `npm ci` installed 96 packages from `package-lock.json`. |
| TypeScript and Vite | Pass | `tsc --noEmit && vite build` transformed 2,084 modules and emitted production assets. |
| Backend image | Pass | PHP 8.4 image compiled required extensions and installed 80 production Composer packages. |
| Web image | Pass | Node build artifacts were copied into the pinned Nginx image. |
| Nginx syntax | Pass | `nginx -t` reported valid syntax when the Compose upstream name was resolvable. |
| Compose readiness | Pass | Independent `eoshop-wp02-gate` stack reported database, backend and web services healthy. |
| HTTP smoke test | Pass | `GET /` returned 200 HTML; `GET /up` returned 200 through Laravel; missing `/api` route returned 404 JSON rather than the SPA. |
| Cleanup | Pass | Temporary test containers, network and both named volumes were removed after verification. |
| Diff hygiene | Pass | `git diff --check` exited 0 before final staging. |

## Non-blocking observation

The production JavaScript entry chunk is approximately 783 KB before gzip (approximately 193 KB after gzip), so Vite emits its chunk-size warning. This does not affect the single-server objective and is retained as evidence for the planned frontend decomposition work rather than being hidden by increasing the warning threshold.

## Verification environment

- Docker Engine 29.4.0
- Node build image: `node:22.23.1-alpine3.24`
- Nginx image: `nginx:1.30.4-alpine3.24`
- PHP image: `php:8.4-fpm-alpine3.24`
- Composer image/binary: `composer:2.10.2`
- PostgreSQL image: `postgres:17.10-alpine3.24`

No real Gemini request was made and no real secret value was recorded in this evidence.
