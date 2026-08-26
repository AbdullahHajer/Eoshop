# WP 5.20 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.20 — Merchant management entry and storefront recovery |
| Status | Complete and merged |
| Verified | 2026-08-26 |
| Branch | `codex/wp-5.20-merchant-entry-storefront-recovery` |
| Base | `f70c8a1985f34678086c3fea266a9c819df2f14c` |
| Decision | [ADR 0032](../../decisions/ADR-0032-merchant-entry-and-storefront-recovery.md) |

## Delivered boundary

- “My stores” is a keyboard-operable action that moves focus to the authoritative server-backed store list.
- “Manage and edit store” opens the existing route-owned operations center.
- Products and orders open their existing operational modules; design and pages open the existing builder directly.
- Every shortcut remains conditional on the server-returned lifecycle and capability projection.
- Public-store bootstrap performs one bounded automatic retry only for transient network/server failure.
- Manual public retry runs in place, aborts the previous owner request and cannot apply a stale response.
- Missing/unpublished domains and temporary connection/service failures receive distinct safe messages.
- No API, authorization, tenant, database, migration or persisted-data contract changed.

## Regression evidence

- Portal tests cover focus transfer, capability-aware shortcuts and the absence of editor shortcuts for staff without workspace permission.
- App-level tests prove that design and pages shortcuts load the existing builder and land on their exact route on the first click.
- Reload tests prove that React click events are not forwarded as optional `AbortSignal` values.
- Storefront workflow tests cover transient recovery, no retry for missing domains, cancellation during delay and safe error classification.
- Storefront orchestration tests cover automatic recovery and customer-triggered in-place retry.

## Local gates

- `scripts/ci/repository-gate.ps1`: PASS.
- TypeScript `--noEmit`: PASS.
- `git diff --check`: PASS.
- Linux production build in Docker: PASS; 2,146 modules transformed.
- Linux Vitest in Docker: PASS; 51 files / 289 tests.
- The existing Windows `node_modules` lacks the Windows Rollup optional binary, so local Vitest was deliberately executed in the locked Linux Docker target rather than claimed from the incomplete host install.

## Independent review

- Initial verdict: `REQUEST_CHANGES` for two P1 findings.
- Finding one: design/pages shortcuts changed the route but did not open the builder on the first click.
- Finding two: direct React `onClick={onReload}` bindings could forward a synthetic event as an `AbortSignal`.
- Resolution commit `36eb3c0` routes editor shortcuts through `openMerchantBuilder`, wraps all manual reload calls and adds end-to-end regressions.
- Final verdict: **APPROVED** with no blocking finding. The reviewer made no file changes and confirmed capability checks, abort handling and stale-response guards remain intact.

## Pull-request CI

Final implementation-head run [32965226717](https://github.com/sas-prog1/Eoshop/actions/runs/32965226717) on `36eb3c05fab436a1feedd22cd1063efe5114058f` passed all four required jobs:

- Repository safety: PASS.
- Frontend quality: PASS; TypeScript, 51 files / 289 tests, production build and dependency audit.
- Backend quality: PASS; Composer validation/audit, Pint, Larastan and PHPUnit.
- Container integration: PASS; clean migrations, production images and HTTP/auth/tenant/worker/scheduler smoke paths.

## Retained Pilot

- Built local image `eoshop/web:wp520-pilot`; final manifest list `sha256:c0c0dbfb54cd84b68f1ff1cad9dd58af4d7032491db949cf20387375c9214375`.
- Final reviewer-fix deployment recreated only `eoshop-pilot-web-1` using `--no-deps`; PostgreSQL, backend, worker and scheduler data/services were retained.
- A prior replacement recreated the backend container with its unchanged `eoshop/backend:wp515-final` image because of its Compose configuration hash; PostgreSQL was not recreated and the backend returned healthy.
- `http://127.0.0.1:8010/app`, `http://noor.lvh.me:8010/` and `http://noor.lvh.me:8010/api/store/config` returned HTTP 200.
- `eoshop-pilot-web-1` reported `healthy` while serving `index-BQM91koh.js` and `index-U2gIGcnD.css`.
- Rollback is web-only: restore `eoshop/web:wp519-pilot`. No database rollback is required.

## Retained debt

- Public-storefront narrow-screen, keyboard and cross-browser acceptance remains WP 5.21.
- Broader management-tab review, richer server-owned appearance contracts and visual refinement remain deliberately deferred.
- The main bundle still emits the known chunk-size warning; route/component splitting remains later performance work.
- Payment verification, production notifications, custom-domain DNS/TLS, monitoring, backup and scale targets remain outside WP 5.20.

## Delivery

- T0/T1 documentation commit: `5c87650`.
- Initial implementation commit: `4ae99c5`.
- Delivery-record normalization commit: `4f87da4`.
- Review-resolution commit: `36eb3c0`.
- Implementation pull request: [#64](https://github.com/sas-prog1/Eoshop/pull/64), merged as `b931af6acce8b4b8120fe88314b04b8433bf5eb2`.
- Protected-`main` CI: [32965835958](https://github.com/sas-prog1/Eoshop/actions/runs/32965835958); all four required jobs passed on merge commit `b931af6`.
