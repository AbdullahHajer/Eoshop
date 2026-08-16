# WP 3.3 verification evidence

- Date: 2026-08-16
- Branch: `codex/wp-3.3-interface-preservation`
- Base: protected `main` at `c76da962`
- Characterization baseline commit: `70691b4`
- Implementation commit: `1bb8802`
- Scope: preserve current interface behavior through injectable UI adapters without redesign or data-authority fallback

## Adapter and authority boundary

- `main.tsx` is the only production composition root and supplies one complete `UiAdapters` set.
- The provider fails closed when absent. Tests inject a complete fail-on-unexpected fake set rather than mutating production services.
- `App`, screen components and UI workflows contain neither direct service imports nor direct `fetch` calls; an architecture test enforces this dependency direction.
- DTO validation, CSRF, retries, provisioning idempotency, authorization and business rules remain in the existing domain services and Laravel.
- A transport-neutral UI error contract preserves stable categories and machine codes, including `workspace_revision_conflict`, without coupling workflows to `ApiError`.
- No feature flag, mock path or browser-data fallback was added. Authenticated identity, permissions, publication, price, inventory and workspace data remain server-owned.

## Behavioral parity

- A pre-refactor characterization run passed **4 tests** for merchant login, unauthorized administration logout, server plan/domain submission and pricing-screen anchors.
- The final suite passed **14 test files, 67 tests**.
- Adapter-backed interface tests cover login, administration denial, password reset, reviewer/manager presentation, assisted content, plan/domain submission and exactly-once calls.
- App-level tests prove server restore, revision-preserving save, machine-code-only conflict recovery, expired-session fail-closed reset and no authenticated workspace write to `mobtaker_custom_store`.
- Domain availability uses both `AbortSignal` and a latest-request sequence; a delayed stale response cannot replace the current handle result.
- Existing WP 3.2 workflow tests continue to cover stale loads, dirty/logout guards, AI operation ordering and three-way conflict recovery.

## Frontend quality

Environment: pinned `node:22.23.1-alpine3.24`, installed from `package-lock.json` in the frontend Docker build stage.

Result: **PASS**.

- TypeScript `tsc --noEmit`: passed.
- Vitest: **14 files, 67 tests** passed.
- Vite production build: **2,100 modules** transformed.
- Dependency audit: **0 vulnerabilities** at the high threshold.
- Baseline bundle: `769.41 kB` / `196.55 kB` gzip.
- Final bundle: `770.62 kB` / `196.85 kB` gzip.
- Increase: `1.21 kB` minified and `0.30 kB` gzip; the existing large-chunk warning remains non-blocking and belongs to Phase 5 decomposition.
- Added packages are development-only test dependencies: Testing Library and jsdom; no runtime framework was added.

## Backend quality

Environment: `eoshop/backend-quality:ci` rebuilt from the current tree.

Result: **PASS**.

- Composer validation: valid.
- Composer locked audit: no security advisories.
- Pint: **139 files** passed.
- Larastan: **113 files**, no errors.
- Non-database PHPUnit: **3 tests, 6 assertions**.

## PostgreSQL and container integration

Command: `scripts/ci/integration-gate.ps1 -ProjectName eoshop-wp33-local -Port 18083` with rebuilt backend, quality and web images.

Result: **PASS**.

- Database PHPUnit: **67 tests, 495 assertions**.
- Clean central migrations and seeding: passed.
- Ordered rollback/reapply and migration status: passed.
- Tenant migrations, legacy adoption, workspace materialization and repeatable-read public composition: passed.
- Session, CSRF, authorization, central/tenant Host and route-cache boundaries: passed.
- Database queue worker and live provisioned tenant Host: passed.
- Expected negative-test logs for audit rollback, invalid legacy payloads, unowned schemas and injected provisioning failures were present while the suite remained green.
- Cleanup removed the worker, web, backend and database containers, network and named volumes.

## Repository safety

Result: **PASS**.

- Repository invariant script: passed.
- `actionlint`: passed.
- Gitleaks: **27 commits**, approximately **2.08 MB**, no leaks found.
- `git diff --check`: clean.

## Independent review

- Early review approved the compatibility-shell direction and required interactive characterization plus latest-only domain checks.
- First implementation review requested complete fail-on-unexpected fakes, transport-neutral workflow errors and broader parity coverage.
- All requested changes were implemented and re-gated.
- Final independent read-only verdict: **APPROVE**, with no blocking findings.

## Delivery

- Characterization baseline commit: `70691b4`.
- Implementation commit: `1bb8802`.
- Evidence commit on the implementation branch: `1869c0b`.
- Pull request: [#18 — WP 3.3: preserve the current interface through API adapters](https://github.com/sas-prog1/Eoshop/pull/18).
- Final implementation head: `1869c0b039ce56498530831661912407b2208b30`.
- Pull-request CI: [run 31947313283](https://github.com/sas-prog1/Eoshop/actions/runs/31947313283), with Repository safety, Backend quality, Frontend quality and Container integration all successful.
- Independent read-only review verdict: **APPROVE**, with no blocking findings.
- PR #18 was merged through the documented single-owner administrative path only after the independent review and all four required checks passed.
- Merge commit on protected `main`: `f19dfc54edeaf590438e8b11fc99480fa163896a`.
- Protected-main CI: [run 31947501908](https://github.com/sas-prog1/Eoshop/actions/runs/31947501908), with all four required jobs successful.
- Final package status: **Complete and merged**; no deferred implementation or failing gate remains in WP 3.3.
