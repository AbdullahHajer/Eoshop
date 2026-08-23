# WP 5.13 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.13 — Guided authentication, merchant account and onboarding |
| Status | Implementation verified; delivery in progress |
| Verified | 2026-08-23 |
| Branch | `codex/wp-5.13-guided-onboarding-profile` |
| Base | `0853669f` |
| Implementation commit | `093f43422468fbc4f7a054d843d66c7c1aabc5fc` |

## Delivered product boundary

- Replaced modal-owned authentication entry with reload-safe login, registration, forgot-password and reset-password routes plus strict internal return-target authorization.
- Added a server-owned account profile with optimistic revision, normalized safe fields, immutable email, redacted audit and a current-password change that revokes other sessions, remember state and earlier reset links.
- Added one revisioned guided store draft with server-owned `business`, `design` and `review` progress, exact step prerequisites and derived readiness.
- Preserved existing submission, provisioning and publication authorities; completing onboarding creates a pending review request and never claims approval or a public URL.
- Reduced browser recovery state to owner ID, draft ID, idempotency key, version and SHA-256 digest. Passive session expiry preserves ambiguous recovery for the same owner; authoritative recovery, explicit logout or confirmed identity change clears it.
- Normalized the bounded repeatedly encoded legacy `plans.features` shape to a JSON `list<string>` so long-lived Pilot data satisfies the typed plan API.

## Independent review

- The independent reviewer challenged stale responses across logout/account/store switches, new-draft versus existing-workspace authority, revision-conflict recovery, concurrent first submission, active-user revalidation, exact draft/tenant integrity, reset-link races and ambiguous submission recovery.
- The final finding identified passive `401` handling that erased the bounded pending-submission receipt before the same owner could sign in again. The handler now retains it and an App-level regression proves `401 → login → same-owner recovery → authoritative clear`.
- A final review also verified the bounded multi-layer plan normalization and the nested adoption/rollback gate.
- Final independent read-only verdict: **APPROVE**, with no blocking findings.

## Focused verification

- Focused real-PostgreSQL account, password/reset race and submission recovery gate: **8 tests / 59 assertions passed**.
- The dedicated account/onboarding integration class contributes **4 test methods** covering optimistic profile/no-op audit, password/session/reset revocation, guided draft progression and direct database constraints.
- The dedicated safe-return, route-authentication, account and onboarding frontend classes contribute **4 files / 12 tests**; the App characterization suite additionally covers passive-expiry recovery and stale draft/account responses.

## Frontend quality gate

- TypeScript/Vite production build: PASS.
- Vitest: **45 files / 240 tests passed**.
- Locked frontend dependency audit: **0 vulnerabilities**.
- Existing production bundle-size guidance remains non-blocking and is retained for route-level loading/performance work.

## Backend quality gate

- Composer validation and locked dependency audit: PASS; no advisories.
- Laravel Pint: **271 files passed**.
- Larastan: **234 files / no errors**.
- Backend unit suite: **3 tests / 6 assertions passed**.

## Repository and container integration gates

- `scripts/ci/repository-gate.ps1`: PASS.
- `git diff --check`: PASS; the PowerShell LF/CRLF notice is non-blocking.
- Isolated PostgreSQL/container integration: **158 tests / 1,630 assertions passed**.
- The integration gate covered populated migration adoption, destructive rollback refusal, rollback/reapply, a twice-wrapped legacy `plans.features` value normalizing to `json_typeof(...)=array`, route cache, central/published-tenant/unknown Host boundaries, scheduler and the database worker.
- Final command: `scripts/ci/integration-gate.ps1 -ProjectName eoshop-wp513-final5 -Port 18122` with fresh backend application and quality images. Its containers, network and volumes were removed after success.

## Live Pilot verification

- The retained Pilot stack remained at `http://127.0.0.1:8010`; no volume or merchant data reset occurred.
- Preflight proved zero advanced profile revisions and zero onboarding-stage changes before the exact `000013` rollback/reapply.
- Backend, database and web were healthy after the update; worker and scheduler were running. Root HTTP returned `200`.
- Database and `/api/plans` both returned `starter.features` as an array with two entries after the repair.
- A fresh random QA identity completed live registration, authenticated session restoration, business save, design save, review save and final submission. The resulting draft reached `review`, the store remained `pending`, appeared in the merchant list and produced one pending central tenant visible to the administration review queue.
- The temporary credential was generated only in process memory and was never printed, committed or recorded in this evidence.

## Product handoff and retained debt

- Merchants now receive a coherent route-owned entry, durable account page and resumable three-step store onboarding journey instead of a modal/local-only sequence.
- Email/phone verification, verified email change, avatar upload, account deletion, MFA/SSO/passkeys and device/session administration remain separate security/product packages.
- Merchant staff invitations, ownership transfer, billing, analytics and plan self-service remain deferred.
- Payments, shipment integrations, DNS/TLS, SMTP delivery, social publishing and advertisement linkage remain deliberately outside WP 5.13.
- Public storefront visual redesign, broader browser/device accessibility acceptance, route-level bundle splitting and further `App.tsx` coordinator decomposition remain experience/performance work after the functional journey.

## Delivery status

- Implementation is recorded separately in `093f43422468fbc4f7a054d843d66c7c1aabc5fc`.
- Evidence commit: pending.
- Pull request and protected CI: pending.
- Merge and protected-main verification: pending.
