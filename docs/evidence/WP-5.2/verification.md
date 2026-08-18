# WP 5.2 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.2 — Control panel workflow panels |
| Status | Local gates complete; ready for PR |
| Verified | 2026-08-18 |
| Branch | `codex/wp-5.2-control-panel-workflow-panels` |
| Base | `af732e1073c425a7327b7de65ca130c411e33334` |
| Implementation commit | `fc2760a` |

## Delivered boundaries

- Shared leaf contracts for `ControlTab`, preview device, copywriter output and `ControlPanelProps`.
- Presentation-only device selector and customization completion bar.
- Presentation-only merchant orders panel; transition decisions remain in `workflows/orderState.ts`, while loading, idempotency, pending refs and adapter calls remain in `ControlPanel.tsx`.
- Presentation-only AI copywriter panel; prompt/loading/output, server call and failure fallback remain in `ControlPanel.tsx`.
- Presentation-only store submission panel; provisioning and publication remain outside the component.
- `ControlPanel.tsx` changed from 3,691 lines / 233,276 bytes to 3,534 lines / 221,881 bytes.

## Independent review

- T0 review initially requested an explicit state-ownership matrix, stronger dependency guards and a complete parity matrix.
- Those requirements were incorporated before delivery.
- Final read-only review verdict: **APPROVE**, with no blocking findings.

## Frontend gate

Environment: pinned `node:22.23.1-alpine3.24` through `docker/nginx/Dockerfile`.

- TypeScript check: PASS.
- Vite production build: PASS.
- Vitest: **21 files / 111 tests passed**.
- Dependency-direction tests: PASS; extracted features cannot import services, `fetch`, `UiAdaptersContext`/`useUiAdapters` or `ControlPanel`.
- `npm audit --audit-level=high`: **0 vulnerabilities**.

### Timing observation

The existing deferred storefront orchestration test exceeded its former global five-second timeout only while the enlarged suite ran concurrently. It passed independently and in a full rerun. Its per-test timeout was raised to ten seconds; assertions and production behavior were unchanged. The final full gate passed with the test completing in approximately six seconds.

## Backend quality gate

Environment: `eoshop/backend-quality:wp52` built from `docker/php/Dockerfile` target `quality`.

- `composer validate --strict --no-check-publish`: PASS.
- `composer audit --locked`: no advisories.
- Laravel Pint: **187 files passed**.
- Larastan: **159 files / no errors**.
- Backend unit suite: **3 tests / 6 assertions passed**.

## Repository and integration gates

- `scripts/ci/repository-gate.ps1`: PASS.
- PostgreSQL/container integration: **91 tests / 858 assertions passed**.
- Central and tenant migrations, rollback/reapply, route cache, HTTP boundaries, live tenant host, database worker and scheduler checks: PASS.
- Integration project `eoshop-wp52-local` was removed with its network and volumes after the run.
- `git diff --check`: PASS.

## Rollback observation

The implementation changes React composition and tests only. Reverting `fc2760a` restores the inline workflow markup and original test timeout without changing APIs, databases, tenant schemas, browser drafts or server-owned state.

## Delivery evidence pending

- Pull request URL and immutable head SHA.
- Four required PR check results.
- Merge commit and protected `main` check results.
