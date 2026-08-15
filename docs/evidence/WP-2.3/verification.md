# WP 2.3 verification — 2026-08-15

## Scope

Evidence covers server-owned plans and subscriptions, race-free public hostname reservation, independent publication, exact-host runtime readiness, merchant recovery APIs, administration actions, interface integration and upgrade compatibility with WP 2.1–2.2 stores.

## Current local results

| Gate | Result | Evidence |
|---|---|---|
| Laravel Pint | Pass | 131 files |
| Larastan | Pass | No errors |
| Fast backend tests | Pass | 3 tests, 6 assertions |
| Frontend tests | Pass | 5 files, 12 tests |
| Frontend production build | Pass | TypeScript and Vite production build; 2,090 modules transformed |
| PostgreSQL database tests | Pass | 60 tests, 443 assertions |
| Migration lifecycle | Pass | Eight system migrations; apply, rollback, reapply and populated WP 2.1–2.2 adoption passed |
| Container smoke | Pass | Central SPA, route cache, published exact Host and Compose database-worker consumption passed |
| Cleanup | Pass | Temporary containers, volumes and network removed |

## Verified boundaries

- Public handles are lowercase ASCII labels beneath the configured tenant base domain; schemes, ports, paths, reserved labels and the internal `store-*` namespace are rejected.
- PostgreSQL constraints, partial unique indexes and an advisory transaction lock prevent live reservation collisions across reservations and published domains.
- Composite tenant foreign keys prevent a publication request from borrowing another tenant's reservation or subscription; runtime also rejects mismatched tenant publication pointers.
- Availability is advisory; submission performs the authoritative reservation in the same central transaction as the tenant, membership, subscription and audit records.
- Rejection releases only user-selected reservations; return to review creates a new historical reservation attempt and returns `409` if another tenant acquired the hostname.
- Plans and prices are server-owned. The free plan activates automatically; paid plans remain pending until a manager supplies a bounded entitlement window.
- Review, provisioning, subscription and publication are independent states. Technical provisioning does not make a new store public.
- Publication locks and rechecks the tenant, request, reservation and subscription, then creates the resolver domain and audit record atomically.
- Runtime requires approved review, active provisioning with provenance, a published exact hostname and a currently effective subscription.
- Subscription comparisons use UTC explicitly, matching PostgreSQL `timestamptz` semantics under the application `Asia/Riyadh` timezone.
- An expired manual entitlement can be renewed by a manager with a new bounded end date, an explicit renewal audit and restored exact-Host access.
- Merchant recovery endpoints return only stores with an exact active membership and expose internal, requested and public hostnames as separate fields.
- Administrative resources expose explicit subscription/publication state and blockers; review-only users cannot activate paid plans or publish stores.
- The browser obtains plans and availability from the API, persists submission idempotency state and does not claim document verification, payment, external DNS/TLS or immediate publication.
- Existing complete WP 2.2 stores are adopted with an active starter entitlement and their internal hostname published for compatibility; incomplete stores remain fail-closed. Legacy DNS labels of 1–63 characters are preserved, and rejected stores are adopted without an open publication request so they can safely return to review.
- Plans, reservations, subscriptions and publication requests remain pinned to the central connection even after tenant initialization.
- Administration blockers, publish authorization and runtime share the same deterministic-schema/provenance/existence predicate; a schema mismatch is visible and fails closed.

## Deliberate deferrals

- Real payment capture, invoicing, refunds and provider webhooks.
- External custom-domain ownership, DNS records, registrar integration and certificate automation.
- Product-count enforcement until products become server-owned.
- Destructive tenant deletion, hostname transfer and automated reservation-retention cleanup.

## Independent review

Final verdict: **APPROVE** with no blocking findings. The reviewer independently rechecked legacy DNS-label adoption, rejected-store reopening, expired manual renewal, composite tenant integrity, central model connections and the unified deterministic-schema readiness predicate after the final fixes.

## GitHub delivery

- Implementation commit: `a9d8dbf648ad448f23d04f9837f0eef9731f4e68`.
- Final evidence commit on the implementation branch: `f70df087443726d26469ff24df7332830cb9a01a`.
- Pull request: [#12 — WP 2.3 Domain, packages and publication lifecycle](https://github.com/sas-prog1/Eoshop/pull/12).
- Final pull-request CI: [run 31884696476](https://github.com/sas-prog1/Eoshop/actions/runs/31884696476); Repository safety, Frontend quality, Backend quality and Container integration all passed on the final PR head.
- Protected-branch merge commit: `4cb5dc3b40a7da74c9ddc3f65cef9149ca0be106`.
- Post-merge `main` CI: [run 31884860361](https://github.com/sas-prog1/Eoshop/actions/runs/31884860361); all four required jobs passed on the merge commit.
