# WP 0.3 verification evidence

| Field | Value |
|---|---|
| Work package | WP 0.3 — CI and automated quality gates |
| Date | 2026-08-12 |
| Branch | `codex/wp-0.3-ci-gates` |
| Base | WP 0.2 commit `4d9fcd3` |
| Local result | Passed |
| GitHub result | Passed — [run 31620260312](https://github.com/sas-prog1/Eoshop/actions/runs/31620260312) |

## Repository safety

- `scripts/ci/repository-gate.ps1`: passed.
- Docker Compose configuration validation: passed.
- actionlint `1.7.12`: passed with no findings.
- Gitleaks `v8.30.1`: four commits and approximately 1.35 MB scanned; no leaks found.
- The Git wrapper uses a command-scoped `safe.directory` value and does not mutate global Git configuration.

## Frontend quality

- Runtime: Node.js `22.23.1`.
- TypeScript `tsc --noEmit`: passed.
- Vitest `4.1.10`: one test file, two tests passed.
- Vite production build: passed; 2,084 modules transformed.
- npm audit at high severity: zero vulnerabilities.
- Non-blocking observation: the primary JavaScript chunk is approximately 783 kB before gzip. Code splitting remains a later performance task.

## Backend quality

- Runtime: PHP `8.4.24`.
- Composer strict validation: passed.
- Composer locked dependency audit: no security advisories.
- Laravel Pint: 32 files passed.
- Larastan/PHPStan level 5: no errors and no ignored-error baseline.
- PHPUnit `11.5.56`: three tests and six assertions passed.

## Production image and integration gate

- Backend `app` image: built successfully from `docker/php/Dockerfile`.
- Web image: built successfully from `docker/nginx/Dockerfile`.
- A new isolated PostgreSQL 17 volume was created.
- System migrations `2026_01_01_000001_create_tenants_table` and `2026_01_01_000002_create_domains_table` ran successfully.
- PostgreSQL, PHP-FPM and Nginx all reached healthy state.
- `/`: HTTP 200 and the React root marker was present.
- `/up`: HTTP 200.
- `/api/does-not-exist`: HTTP 404 with `application/json`.
- Temporary containers, network and both volumes were removed after the gate.

The first integration attempt exposed that an unknown `/api` route returned HTML when the caller sent no `Accept` header. Laravel exception rendering was corrected to preserve the API boundary, a regression assertion was added, and the complete backend and integration gates then passed.

## GitHub Actions evidence

All four checks passed on the implementation commit:

- [Repository safety](https://github.com/sas-prog1/Eoshop/actions/runs/31620260312/job/94193032386): passed in 15 seconds.
- [Frontend quality](https://github.com/sas-prog1/Eoshop/actions/runs/31620260312/job/94193032403): passed in 25 seconds.
- [Backend quality](https://github.com/sas-prog1/Eoshop/actions/runs/31620260312/job/94193032429): passed in 2 minutes 48 seconds.
- [Container integration](https://github.com/sas-prog1/Eoshop/actions/runs/31620260312/job/94193862251): passed in 3 minutes 11 seconds.

Branch protection must not require the new checks until this workflow exists on `main`; activation is therefore a post-merge repository task and is not claimed as complete here.
