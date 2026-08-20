# WP 5.7 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.7 — Focused product editor and builder simplification |
| Status | Complete and merged |
| Verified | 2026-08-20 |
| Branch | `codex/wp-5.7-product-editor` |
| Base | `ec662b8548a11c07114b43fdcf0e64a7e2e327e5` |
| Implementation commit | `c1c2a44de56017d845421fa84bc167cb688cf03f` |

## Delivered product boundary

- Extracted product list, search/filter, metadata, status, pricing, media and archive confirmation into the typed `MerchantProductEditor` feature boundary.
- Kept products controlled by `App` and keyed every mutation by product ID; new browser identities use `draft:${crypto.randomUUID()}` and are omitted by the workspace serializer before server creation.
- Preserved revisioned workspace and catalog revisions as the only full-editor write authority and retained the existing explicit 409 recovery path.
- Kept inventory projections read-only in the product editor and delegated the guarded transition to the route-owned inventory module.
- Removed duplicate order and inventory navigation, hooks and mutation implementations from the design builder.
- Reduced `ControlPanel.tsx` from 3,497 to 2,105 lines without changing tenant migrations, endpoints or authorization rules.

## Independent review

- T0 review challenged catalog writer ownership, archive intent, index-based identity, media result ownership and dirty inventory navigation.
- The accepted contract now distinguishes draft and server identities, keeps archive intent until a successful save, uses ID-keyed functional updates and makes the inventory handoff an `App` responsibility.
- Final independent read-only verdict: **APPROVE**, with no blocking findings.

## Frontend quality gate

Environment: exact WP 5.7 frontend quality/build image.

- TypeScript check: PASS.
- Vitest: **29 files / 168 tests passed**.
- Vite production build: PASS; **2,123 modules transformed**.
- Built JavaScript bundle: **830.35 kB / 214.91 kB gzip**.
- `npm audit --audit-level=high`: **0 vulnerabilities**.
- The test runner is capped at two workers to avoid Docker CPU contention causing unrelated JSDOM timeouts; assertions and test coverage were not reduced.
- Covered ID-keyed edits under filtering, atomic price patches, rapid draft additions, draft-ID stripping/server UUID replacement, archive retention and truthful messaging after failed save, account/tenant/product media cancellation, fail-closed permission-gated inventory projection, dirty inventory navigation and removal of duplicate operational tabs.

## Backend quality gate

Environment: unchanged backend source with the current backend quality image.

- Composer validation and locked dependency audit: PASS; no vulnerability advisories.
- Laravel Pint: **204 files passed**.
- Larastan: **174 files / no errors**.
- Backend unit suite: **3 tests / 6 assertions passed**.

## Repository and container integration gates

- `scripts/ci/repository-gate.ps1`: PASS.
- `git diff --check`: PASS after final whitespace normalization.
- Production `eoshop/backend:ci` and `eoshop/web:ci` images were rebuilt from the implementation tree before the final gate.
- PostgreSQL/container integration: **106 tests / 1,045 assertions passed**.
- Covered central and tenant migrations, populated rollback/reapply, route cache, live Host boundaries, database worker and scheduler.
- Final integration project `eoshop-wp57-final2`, its containers, network and volumes were removed after the successful run; the local Pilot stack on port 8010 was not touched.

## Product handoff and retained debt

- Merchants now have one focused product editor and one route-owned operational interface each for inventory and orders.
- `ControlPanel.tsx` still owns branding, checkout, pages, assistant, export and preview coordination; further extraction remains planned rather than hidden.
- `App.tsx` remains a large application coordinator and should be decomposed after the remaining product journeys are stabilized.
- The production bundle remains above the 500 kB warning threshold; route-level code splitting remains explicit performance debt.
- Team/profile management and the full platform administration console remain separate product work.

## Delivery status

- Implementation is recorded separately in `c1c2a44de56017d845421fa84bc167cb688cf03f`.
- Evidence is recorded separately in `5da32635faf83ef8671975a8cdfa344a96d0dc64`.
- Pull request [#38](https://github.com/sas-prog1/Eoshop/pull/38) was merged from head `5da32635faf83ef8671975a8cdfa344a96d0dc64`.
- Pull-request CI run [32387916171](https://github.com/sas-prog1/Eoshop/actions/runs/32387916171) passed all four required jobs: Repository safety, Backend quality, Frontend quality and Container integration.
- Merge commit: `d0133432a2dde5837740c1ac3b8d9ef8748502f4`.
- Protected-main CI run [32388520881](https://github.com/sas-prog1/Eoshop/actions/runs/32388520881) passed the same four required jobs after merge.
