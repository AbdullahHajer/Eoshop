# WP 5.15 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.15 — Storefront section layout and truthful template composition |
| Status | Implementation verified; delivery pending |
| Verified | 2026-08-24 |
| Branch | `codex/wp-5.15-storefront-sections` |
| Base | `45cc3e709889b1e9dfa6339dc85869978080ea32` |
| Implementation commit | `9eff6371fcbde6530c5a6e059419fcbe194043a7` |

## Delivered product boundary

- Added one server-owned, revisioned `homeSections` layout containing the exact five semantic sections: hero, trust, categories, featured products and About.
- Added accessible order and visibility controls to the focused existing-store profile editor; arbitrary blocks, HTML, CSS and script injection remain impossible.
- Rendered both first-party themes from the same section contract and kept desktop/mobile preview aligned with the public storefront composition.
- Split the large storefront renderer into focused home and product-detail components while preserving checkout, cart, navigation, catalog, inventory and order behavior.
- Removed unsupported fixed commercial claims across the header, home, products, About and product-detail surfaces; rendered facts now come only from authoritative store configuration.
- Kept onboarding appearance-only: central drafts, corrections, submissions and queued provisioning sources cannot own layout, and every newly provisioned tenant receives the exact default layout.
- Preserved legacy tenants with deterministic read normalization while rejecting malformed stored layouts and rejecting old-client omission after a custom layout exists.

## Regression verification

- PostgreSQL coverage proves legacy default projection, exact valid persistence and fail-closed rejection of unknown, duplicate, missing, malformed and all-hidden layouts without mutation.
- Draft and provisioning coverage proves that direct central input, corrections and queued legacy payloads cannot override tenant layout authority.
- Frontend coverage proves accessible reorder/visibility controls, theme parity, hero image/contrast synchronization, semantic order, truthful empty states and exclusion of draft/archived products.
- Storefront characterization traverses both themes across header, home, product listing, About and product-detail surfaces and rejects unsupported fixed claims.
- Existing workspace revision conflicts, two-permission `workspaceManage`, tenant/account isolation, inventory, checkout, orders, onboarding, provisioning and publication coverage remained green.

## Frontend quality gate

- TypeScript/Vite production build: PASS; **2,141 modules transformed**.
- Vitest: **47 files / 251 tests passed**.
- Locked npm audit: **0 vulnerabilities**.
- The existing production bundle-size warning remains non-blocking: main JavaScript **840.41 kB / 225.50 kB gzip**.

## Backend quality gate

- Composer validation and locked dependency audit: PASS; no advisories.
- Laravel Pint: **274 files passed**.
- Larastan: **237 files / no errors**.
- PHPUnit unit suite: **3 tests / 6 assertions passed**.

## Repository and container integration gates

- `scripts/ci/repository-gate.ps1`: PASS.
- `git diff --check`: PASS.
- Isolated PostgreSQL/container integration: **161 tests / 1,735 assertions passed**.
- The gate covered system and tenant migration adoption, destructive rollback refusal, rollback/reapply, route cache, central/published-tenant/unknown Host boundaries, live authentication/authorization, workspace layout, inventory, orders, scheduler and the database worker.
- The authoritative run used project `eoshop-wp515-current` with images `eoshop/backend-quality:wp515-fixes2`, `eoshop/backend:wp515-final` and `eoshop/web:wp515-final`; its containers, network and volumes were removed after success.
- An earlier run that accidentally referenced stale `:ci` images was interrupted and cleaned and is not counted as evidence.

## Live Pilot verification

- The retained Pilot at `http://127.0.0.1:8010` was updated to `eoshop/backend:wp515-final` and `eoshop/web:wp515-pilot` without deleting or recreating its PostgreSQL or application-storage volumes.
- Database and backend reported healthy; worker and scheduler were running from the same WP 5.15 backend image.
- Root HTTP returned `200` with the new production bundle.
- No system or tenant database migration was required by WP 5.15; the additive layout is stored inside the existing revisioned configuration contract.
- Manual product-owner acceptance is handed off on the retained Pilot; no hidden merchant fixture was created and no merchant data was removed.

## Independent review

- Final read-only verdict: **APPROVE**; no blocking authority, compatibility, isolation, rendering or recovery findings remain.
- The reviewer independently verified central-source stripping, exact server validation, published-only public composition, neutral claims, unified hero behavior and regression coverage.
- `git diff --check` was clean at approval time.

## Retained debt and next product step

- WP 5.15 intentionally delivers a bounded five-section composer, not a free-form page builder or template marketplace.
- Additional section types, richer per-section visual settings and media choices will be restored incrementally through the same server-owned contract.
- Onboarding remains appearance-only and uses the default layout; post-provisioning layout customization belongs to the existing-store profile.
- Production bundle splitting remains a performance follow-up; the current warning is non-blocking and unchanged in risk class.

## Delivery status

- Implementation is recorded separately in `9eff6371fcbde6530c5a6e059419fcbe194043a7`.
- Evidence commit, pull request, required CI, merge commit and protected-main CI facts will be appended after delivery.
