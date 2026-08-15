# WP 2.3 — Domain, packages and publication

| Field | Value |
|---|---|
| Phase | Phase 2 — Tenant lifecycle, store and domain |
| Work Package | WP 2.3 |
| Status | Complete — delivered through PR #12 |
| Started | 2026-08-15 |
| Branch | `codex/wp-2.3-domain-packages` |
| Base | Protected `main` at `a305192` |
| Dependencies | WP 1.1–1.3; WP 2.1–2.2 |
| Decision | [ADR 0008](../decisions/ADR-0008-domain-subscription-publication-boundaries.md) |

## Objective

Let a merchant request a real platform hostname and package without races or false payment claims, while keeping review, technical provisioning, subscription entitlement and public publication as separate server-owned states.

## Scope

- Server-owned plan catalog and tenant subscriptions.
- Automatic free entitlement and audited manual paid entitlement.
- Race-free public-handle validation and reservation below the platform base domain.
- One effective store-count entitlement per owner during submission.
- Independent publication lifecycle and manage-only publish/unpublish actions.
- Runtime readiness that includes publication and subscription state.
- Real plan/domain selection in the storefront UI and progress/actions in administration.
- Upgrade adoption for WP 2.2 tenants without interrupting currently reachable stores.

## Out of scope

- Payment gateway capture, refunds, invoices or webhook reconciliation.
- External custom-domain ownership, DNS records, certificates and TLS automation.
- Product-limit enforcement before products become server-owned.
- Destructive tenant deletion, hostname transfer and automated retention cleanup.

## T0–T5

### T0 — Contract

- [x] Separate internal hostname, public reservation and external custom domain.
- [x] Define plan, subscription and publication state machines.
- [x] Define fail-closed runtime and upgrade-adoption behavior.

### T1 — Domain reservation

- [x] Add canonical handle validation, reserved-name policy and availability API.
- [x] Reserve atomically under PostgreSQL constraints and an advisory transaction lock.
- [x] Release/reacquire user-selected names across rejection and return-to-review.

### T2 — Packages and subscriptions

- [x] Seed the authoritative plan catalog and expose safe plan resources.
- [x] Link one current subscription to each tenant and enforce owner store quota.
- [x] Add audited manage-only manual activation for paid entitlements.

### T3 — Publication and interface

- [x] Mark technically active tenants ready without publishing them.
- [x] Add audited publish/unpublish operations and extend runtime readiness.
- [x] Replace prototype plan/domain/document claims with live API state.

### T4 — Gates

- [x] Prove PostgreSQL checks, partial uniqueness, rollback/adoption and concurrent reservation.
- [x] Prove auth/CSRF/policy/throttle/idempotency/quota and paid-plan boundaries.
- [x] Prove submit → approve → worker → ready → entitlement → publish → Host end to end.
- [x] Pass frontend tests/build and all existing PHP/CI gates.

### T5 — Evidence and delivery

- [x] Record verification evidence.
- [x] Complete independent read-only review with no blocking findings.
- [x] Commit, push, open PR, pass the four required checks and merge.

## Rollback

Rollback is allowed only when WP 2.3 contains no user-created reservation, public hostname, or non-adopted subscription history. Adopted compatibility records may be removed to restore WP 2.2 behavior. No rollback path drops a tenant schema or central tenant/submission/audit record.
