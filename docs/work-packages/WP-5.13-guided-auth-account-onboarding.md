# WP 5.13 — Guided authentication, merchant account and onboarding

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.13 |
| Status | Complete and merged |
| Started | 2026-08-23 |
| Branch | `codex/wp-5.13-guided-onboarding-profile` |
| Base | Protected `main` at `0853669f` |
| Dependencies | WP 1.1–1.3; WP 3.1–3.3; WP 5.4–5.9; WP 5.11–5.12 |
| Decision | [ADR 0025](../decisions/ADR-0025-guided-auth-account-and-onboarding.md) |

## Objective

Replace the remaining modal/local-only entry journey with reload-safe authentication routes, a server-owned account profile and a guided, resumable new-store onboarding sequence while preserving the existing draft, submission, provisioning and publication authorities.

## Baseline

- Registration and login are real Laravel session operations but are presented inside `AuthGateway`.
- Initial business information is held by `RegistrationGateway` and described truthfully as local-only.
- `/app/new` relies on `App.tsx` coordination before the revisioned server draft becomes the visible journey authority.
- Domain/plan selection and submission are correct but appear late in a separate modal.
- `GET /api/auth/session` exposes safe identity data, but there is no account profile or authenticated password-change API.
- The latest Pilot and protected `main` are green at `0853669f`; WP 5.13 must not weaken their tenant, order, inventory or administration boundaries.

## Scope

- Central migration for `users.profile_revision` and `store_drafts.onboarding_stage`/`onboarding_stage_baseline`, including populated adoption and safe rollback behavior.
- Locked, audited profile and password services plus typed account API contracts.
- Dedicated login, registration, forgot/reset and account pages with safe return routing.
- Guided `/app/new` business, design and review steps backed by three allowlisted step writers, the one server draft and the existing submission receipt.
- Replace the browser recovery fingerprint payload with a SHA-256 digest scoped to the authenticated owner and draft.
- Removal of local-only business-profile authority and obsolete modal claims from the active journey.
- Characterization of existing merchant, admin, storefront, draft, product, inventory and order journeys.

## Out of scope

- Email/phone verification changes, avatar upload, account deletion, MFA/SSO/passkeys and device/session UI.
- Merchant staff/team management, ownership transfer, billing, analytics and plan self-service.
- Payment, shipment, DNS/TLS, SMTP delivery, social publishing and advertisement integration.
- A public storefront visual redesign or a new frontend router/state library.

## Product and safety invariants

- Identity, profile and onboarding truth is server-owned; browser state only edits a revisioned projection.
- Email cannot be changed in WP 5.13.
- Password change revokes every other session and remember token without exposing a secret or accepting a stale/suspended identity.
- Password change also invalidates every older reset link and serializes with reset-link issuance/redemption.
- New-store onboarding cannot skip server prerequisites or imply approval, provisioning or publication.
- A network failure is never treated as an empty account or missing draft.
- Ambiguous submission replays its original idempotency operation before any new save.
- Account/logout/store switches invalidate stale profile and draft responses.
- Existing linked correction drafts do not regress into new-store onboarding.

## T0–T5

### T0 — Contract and baseline

- [x] Inventory the current modal, account-resource, draft and submission boundaries.
- [x] Record ADR 0025 route, profile, password, progress and recovery decisions.
- [x] Complete independent design review and resolve all blocking findings.

### T1 — Account authority

- [x] Add central migration/adoption and database constraints.
- [x] Add locked profile update with optimistic revision, no-op behavior and redacted audit.
- [x] Add current-password change with generation increment, remember rotation, other-session revocation and current-session rebind.
- [x] Serialize password change/reset issuance/redemption and invalidate pre-change reset tokens.
- [x] Add typed APIs and negative authorization/concurrency tests.

### T2 — Route-owned authentication and account UI

- [x] Add reload-safe login/register/forgot/reset/account routes with strict internal return targets.
- [x] Replace landing modal entry with route navigation while preserving session restoration.
- [x] Add profile/password forms with dirty, conflict, forbidden, session-expiry and account-switch guards.
- [x] Remove credential/profile claims unsupported by the server.

### T3 — Guided onboarding

- [x] Adopt and expose the server-owned onboarding stage.
- [x] Build allowlisted business, design and review writers around the one revisioned draft and derived readiness.
- [x] Persist before advancing; guard direct later-step access and resume after reload.
- [x] Preserve exact submit/resubmit idempotency and correction behavior.
- [x] Persist only owner/draft-scoped SHA-256 recovery metadata and clear it at authoritative identity boundaries.
- [x] Remove the active local-only `RegistrationGateway` path.

### T4 — Gates

- [x] Pass focused frontend and PostgreSQL account/onboarding tests.
- [x] Pass migration rollback/reapply and populated adoption/refusal gates.
- [x] Pass 401/403/409/419/422/throttle, stale response, session revocation and concurrent update gates.
- [x] Pass safe-return canonicalization/permission tests and password-change versus reset-link/redemption race gates.
- [x] Pass full frontend/backend quality, repository safety and isolated container integration.
- [x] Run a live Pilot smoke for registration → account plus safe draft/submission recovery and admin visibility without resetting Pilot data.

### T5 — Evidence and delivery

- [x] Record exact immutable verification evidence and retained debt.
- [x] Obtain final independent read-only approval.
- [x] Commit implementation and evidence separately.
- [x] Push, open PR, pass required CI and merge.
- [x] Record PR, final head, merge commit and protected-main CI before marking complete.

## Acceptance criteria

- A guest can reload direct authentication routes and complete registration/login without a modal or open redirect.
- An active user can update safe profile fields using an exact revision; stale update is `409`, no-op does not audit, and email remains immutable.
- A password change rejects a wrong current password, revokes other sessions/remember state and keeps only a newly rebound current session usable.
- A reset link created before password change cannot change the new credential; concurrent issue/redeem/change operations fail closed according to lock order.
- A suspended/deleted identity cannot update profile/password or replay a stale authenticated request.
- New-store business data is no longer local-only; after the first Next action it survives reload from the server draft.
- The visible step cannot advance until the server accepts the step, and a later direct route cannot bypass prerequisites.
- Editing an earlier step can invalidate derived review readiness without falsifying progress history, and final submit still revalidates plan, quota and handle.
- Browser recovery storage contains no canonical request, config or contact data and cannot cross an account boundary.
- An ambiguous final submission can be replayed without duplicate tenant/domain/submission records.
- Existing merchant stores, corrections, administration, published hosts, products, inventory and orders retain their prior behavior.

## Rollback

- Frontend routes can fall back to the previous landing/portal entry only after draining requests and retaining server profile/onboarding fields.
- Database rollback is permitted only when every profile remains at revision 1 and every onboarding stage equals its stored migration/create-time baseline; otherwise it refuses and requires a forward repair.
- Password/session security changes are rolled back under maintenance drain with session deletion and remember-token rotation before old code is restored.
