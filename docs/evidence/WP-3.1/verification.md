# WP 3.1 verification evidence

- Date: 2026-08-15
- Branch: `codex/wp-3.1-unified-api-client`
- Base: protected `main` at `52d81f210c66dfe1547b69b46392893af776d98d`
- Scope: unified frontend API transport, domain DTO mapping and reusable safe-read task state

## Contract inventory

- `fetch` is confined to `src/services/apiClient.ts`.
- Authentication, administration, plans, provisioning and AI generation use domain services and explicit mappers.
- Business `localStorage` records remain intentionally unchanged for WP 3.2; the provisioning idempotency key remains a durable domain-operation record.
- Generic automatic retry is absent. One rejected `419` mutation is replayed after a shared CSRF refresh; UI retry is opt-in for safe reads.

## Frontend contract tests

Command environment: the `frontend-build` stage of `docker/nginx/Dockerfile`, using pinned `node:22.23.1-alpine3.24` with locked dependencies.

Result: **PASS — 8 test files, 41 tests**.

Covered behavior includes:

- `401`, `403`, `409`, `419`, `422`, `429` and sanitized `5xx` normalization.
- Validation fields, request correlation and both `Retry-After` formats.
- CSRF single-flight, rejected-promise recovery, concurrent `419` refresh and exactly one replay.
- Stable request/idempotency headers across replay; protected-header and unsafe-target rejection.
- Network and abort behavior without implicit retry, including abort between `419` and replay.
- Method-aware retry metadata, idempotency opt-in, pending-CSRF caller cancellation and redirect refusal.
- React StrictMode-compatible task lifecycle (setup → cleanup → setup).
- DTO rejection of invalid enums/malformed success and removal of unknown shallow/deep fields.
- Latest-operation race, disposal and opt-in retention for retry without sensitive argument retention.
- Existing authentication, authorization-display, administration, plan, submission-idempotency and product-art compatibility.

## Frontend build

`docker build --target frontend-build --tag eoshop/frontend-wp31:check --file docker/nginx/Dockerfile .`

Result: **PASS**.

- TypeScript `tsc --noEmit`: passed.
- Vite production build: passed (2,095 modules transformed).
- The existing large-chunk warning remains non-blocking and is assigned to later interface decomposition/performance work.

## Container integration

`powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ci/integration-gate.ps1 -ProjectName eoshop-wp31-final2 -Port 18084`

Result: **PASS**.

- PostgreSQL migrations and seeding: passed.
- Backend integration: **60 tests, 443 assertions**.
- Migration rollback, populated adoption and ordered reapplication: passed.
- Route cache/clear and central/tenant Host boundaries: passed.
- Live database queue worker and tenant runtime path: passed.
- Containers, network and named volumes were removed by the gate cleanup.

Expected error logs from negative rollback, audit and provisioning-failure tests were present while the suite remained green.

## Review and delivery

- Independent read-only review: **APPROVE — no blocking findings** after one requested-changes cycle and verification of all five fixes.
- Implementation commit: `64bcc14` (`feat(frontend): unify API transport and contracts`).
- Pull request: [#14 — WP 3.1: unify frontend API boundary](https://github.com/sas-prog1/Eoshop/pull/14).
- Required-check run: [31889358724](https://github.com/sas-prog1/Eoshop/actions/runs/31889358724) — Repository safety, Frontend quality, Backend quality and Container integration all passed.
- Final evidence commit: `2ca93d05ffdfc69713a3aaa2b35c10aeb230991c`.
- Final required-check run: [31889525695](https://github.com/sas-prog1/Eoshop/actions/runs/31889525695) — all four required jobs passed on the final PR head.
- PR #14 merged at `701271d91c65b228123af6cdcceafbb4a31099a6` on 2026-08-15.
- Protected-main post-merge run: [31889689850](https://github.com/sas-prog1/Eoshop/actions/runs/31889689850) — all four jobs passed on the merge commit.

WP 3.1 is complete. WP 3.2 may now replace browser-held business state incrementally while using the unified API boundary delivered here.
