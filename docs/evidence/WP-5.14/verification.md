# WP 5.14 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.14 — Visual onboarding, template preview and reliable submission handoff |
| Status | Implementation verified; delivery pending |
| Verified | 2026-08-23 |
| Branch | `codex/wp-5.14-visual-onboarding` |
| Base | `4b267de38b03e3e2dbaa66e3aac03d9da6f06fea` |
| Implementation commit | `a816931` |

## Delivered product boundary

- Added a persistent create-store entry to the authenticated merchant portal.
- Replaced the minimal design choice with two bounded first-party templates, visual cards, desktop/mobile storefront preview and safe pre-submission identity/hero controls.
- Reused the real storefront renderer in explicit preview mode; checkout remains non-persistent and cannot create a live order.
- Split bounded sample products from the persisted draft and reset interactive preview state on template changes.
- Added a shared appearance-only contract; the backend rejects operational fields and merges only allowlisted visual values into the locked draft.
- Added a final business/design/domain/plan summary with an exact storefront preview and truthful review/provisioning/publication language.
- Routed successful submission directly to the server-owned store operations area.
- Fixed the immediate successful-submission projection by loading the same complete resource relations used by merchant store reads.
- Deferred removal of both submit and resubmit recovery receipts until the complete authoritative response maps successfully.

## Regression verification

- The backend integration contract now asserts the complete immediate submission projection, including nullable domain/publication fields and replay metadata.
- Frontend API tests prove that truncated successful submit and resubmit responses fail closed while retaining bounded recovery metadata.
- Onboarding component coverage proves template selection, visual customization, desktop/mobile preview, revisioned appearance-only save, preview interaction reset and absence of sample products in the persisted payload.
- PostgreSQL integration coverage proves that the design endpoint rejects product injection without changing the draft revision or catalog.
- Existing App orchestration, merchant portal, checkout and storefront-order tests remain green; only the known heavy DOM journeys use localized 15–30-second Vitest timeouts to avoid CPU-contention-only failures under two workers.

## Frontend quality gate

- TypeScript/Vite production build: PASS; **2,138 modules transformed**.
- Vitest: **45 files / 243 tests passed**.
- Locked npm audit: **0 vulnerabilities**.
- The existing production bundle-size warning remains non-blocking: main JavaScript **872.64 kB / 230.31 kB gzip**.

## Backend quality gate

- Composer validation and locked dependency audit: PASS; no advisories.
- Laravel Pint: **272 files passed**.
- Larastan: **235 files / no errors**.
- The complete database-group gate below includes the new submission projection assertion.

## Repository and container integration gates

- `scripts/ci/repository-gate.ps1`: PASS.
- `git diff --check`: PASS.
- Isolated PostgreSQL/container integration: **158 tests / 1,705 assertions passed**.
- The gate covered populated migration adoption, destructive rollback refusal, rollback/reapply, route cache, central/published-tenant/unknown Host boundaries, live authentication/authorization, inventory, orders, scheduler and the database worker.
- Final command used project `eoshop-wp514-final2` on port `18115` with fresh WP 5.14 backend/web/quality images. Its containers, network and volumes were removed after success.

## Live Pilot verification

- The retained Pilot stack at `http://127.0.0.1:8010` was updated to the WP 5.14 backend/web images without deleting the PostgreSQL or application-storage volumes.
- System migration check returned `Nothing to migrate`.
- Database, backend and web reported healthy; worker and scheduler were running on the WP 5.14 backend image.
- Root HTTP returned `200` with the current WP 5.14 bundle marker; `GET /api/auth/session` returned `200` with the expected guest envelope from an unsigned request.
- Manual merchant visual acceptance is intentionally handed to the product owner on the retained Pilot rather than creating or deleting hidden QA merchant data.

## Independent review

- Final read-only verdict: **APPROVE**; no blocking code, contract, isolation or recovery findings remain.
- The reviewer independently verified the server-side appearance allowlist, preview-only sample products, locked-draft merge, submit/resubmit recovery ordering and template-switch interaction reset.
- `git diff --check origin/main` was clean at approval time.

## Retained debt and next product step

- Templates remain a bounded client catalog compatible with the existing server `themeStyle`; a database-managed template catalog/marketplace is deferred.
- Product creation, managed media, checkout and operational settings remain post-provisioning capabilities in the store operations area.
- Wider template choice, richer template thumbnails, accessibility/device acceptance and route-level bundle splitting remain follow-up experience/performance work.
- Approval, provisioning, subscription activation and publication remain explicit server-owned lifecycle steps; WP 5.14 does not claim an instant public store URL.

## Delivery status

- Implementation commit, evidence commit, pull request, required CI, merge commit and protected-main CI are pending T5 delivery.
