# WP 5.19 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.19 — End-to-end publication continuity |
| Status | Implemented, independently approved and ready to merge |
| Verified | 2026-08-25 |
| Branch | `codex/wp-5.19-publication-continuity` |
| Base | `34ef4030d281a7e6d6d4f88a6f861f6f87e7e7d0` |
| Decision | [ADR 0031](../../decisions/ADR-0031-publication-continuity-boundary.md) |

## Delivered boundary

- Existing-workspace completion saves the server revision and returns to `/app`; it cannot open the new-store domain/submission modal.
- A failed save or revision conflict keeps the merchant in the editor.
- New/correction drafts retain their domain, plan and submission journey.
- Merchant and platform views poll only visible transitional lifecycles, sequentially, every five seconds and for at most 24 attempts.
- Polling stops at terminal state, route change or unmount and aborts an in-flight HTTP request.
- Merchant polling is a narrow store-list read. It cannot restore a draft, load a workspace or replace editor configuration.
- Publication capabilities, blockers and the exact public domain remain server-authoritative.
- No backend lifecycle, authorization, tenant schema or persisted data contract changed.

## Regression evidence

- Completion arbitration covers failed/conflicting save, successful existing-workspace return and successful new-store continuation.
- Control-panel regression prevents a domain callback from winning over explicit existing-workspace completion.
- Lifecycle polling regressions cover transitional selection, bounded sequential attempts, terminal stop and in-flight abort on unmount.
- Late merchant lifecycle responses are discarded after cancellation and cannot apply a store snapshot.
- Merchant and platform screens cover automatic refresh from transitional to terminal state.
- The provisioning API regression confirms that `AbortSignal` reaches the HTTP request.

## Local gates

- TypeScript `--noEmit`: PASS.
- `scripts/ci/repository-gate.ps1`: PASS.
- `git diff --check`: PASS.
- Local Vitest did not start because the existing Windows `node_modules` contains Linux Rollup optional binaries only.
- Local Laravel did not start under PHP 8.3.28 because the locked backend requires PHP 8.4.1.
- These local toolchain gaps were not treated as test passes; the locked GitHub gates below executed the complete suites successfully.

## Pull-request CI

Run [32877894267](https://github.com/sas-prog1/Eoshop/actions/runs/32877894267) on implementation head `e9528d080ee12d3bbba3b4cffc6da4d7c46aa450` passed all four required jobs:

- Repository safety: PASS.
- Frontend quality: PASS; 50 files / 279 tests, TypeScript, production build and audit with zero reported vulnerabilities.
- Production frontend build: 2,145 modules; `index-JjoWg50E.js` 850.69 kB / 228.41 kB gzip and `index-DPHkk-Jt.css` 108.95 kB / 15.99 kB gzip.
- Backend quality: PASS; Composer validation/audit, Pint across 274 files, Larastan with no errors and 3 unit tests / 6 assertions.
- Container integration: PASS; clean system/tenant migrations, rollback adoption checks, production images, HTTP smoke, authentication, authorization, tenant isolation, worker and scheduler boundaries.

## Independent review

- Initial verdict: `REQUEST_CHANGES` for one P1. The first merchant poll reused full session restoration and could race a workspace load after route change.
- Resolution commit `e9528d0` replaced that call with a cancellable, generation-guarded lifecycle-only read and added late-response regressions.
- Final verdict: **APPROVE** with no P0, P1 or P2 finding.
- The reviewer made no code or documentation changes.

## Retained Pilot

- Docker Desktop initially remained in `starting`; a targeted stop/start recovered the engine without deleting volumes or project data.
- Built immutable local web image `eoshop/web:wp519-pilot` with manifest list `sha256:506608c3ed925245d227f4fea7a1e1bfc1b2f380ec241eda6b22f47d7a6ab782`.
- Recreated only `eoshop-pilot-web-1`; backend, worker, scheduler and PostgreSQL containers retained their previous images and data.
- `http://127.0.0.1:8010/up` and `/` returned HTTP 200.
- Served WP 5.19 assets: `index-CJ-x-o2y.js` and `index-oVrU5nZ1.css`.
- Retained central data confirms `تيمور` is `approved / active / requested`, the lifecycle that previously appeared stale while queued in the UI.
- Retained published tenant `تور للتسويق` is `approved / active / published` with exact public domain `noor.lvh.me`.
- The public host returned HTTP 200, and `/api/store/config` returned `تور للتسويق`, workspace revision 1 and catalog revision 1.
- Rollback is web-only: restore `eoshop/web:wp518-pilot`. No database rollback is required.

## Retained debt

- Public storefront narrow-screen, keyboard and cross-browser acceptance remains WP 5.20.
- Management-tab review, richer server-owned appearance contracts and broader visual refinement remain deliberately deferred.
- The main bundle still triggers the existing chunk-size warning; route/component splitting remains later performance work.
- Payment verification, production notifications, custom-domain DNS/TLS and production observability are outside WP 5.19.

## Delivery

- T0/T1 documentation commit: `af2ad91`.
- Initial implementation commit: `ba7228f`.
- Review-resolution implementation commit: `e9528d0`.
- Pull request: [#62](https://github.com/sas-prog1/Eoshop/pull/62).
- Merge and protected-main evidence will be recorded by the WP 5.19 closeout after this implementation PR merges.
