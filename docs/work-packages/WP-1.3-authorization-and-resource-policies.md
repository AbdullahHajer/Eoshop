# WP 1.3 — Authorization, policies and protected resources

| Field | Value |
|---|---|
| Phase | Phase 1 — Identity, authentication and authorization |
| Work Package | WP 1.3 |
| Status | Pull request open; required implementation checks passed |
| Started | 2026-08-13 |
| Branch | `codex/wp-1.3-authorization-policies` |
| Base | Protected `main` at `1217724` |
| Dependencies | WP 1.1 central identity; WP 1.2 real sessions |
| Decision | [ADR 0005](../decisions/ADR-0005-server-owned-authorization-boundaries.md) |

## Objective

Turn the role and permission model into enforced server-side authorization for platform and tenant resources. Replace browser-owned administration data with protected APIs and produce attributable audit evidence for sensitive platform decisions.

## Scope

- Add Laravel policies for platform store administration, tenant-scoped store settings and audit-log access.
- Protect platform administration routes with the authenticated database session and CSRF middleware.
- Return `401` to guests and `403` to authenticated users without the required permission.
- Apply tenant permissions to the exact tenant and require an active membership.
- Record actor, tenant, action, subject, before/after values and request metadata for platform mutations.
- Expose authoritative platform permissions in the authenticated-user representation for interface presentation only.
- Load platform stores from Laravel and submit review decisions to Laravel.
- Remove sample platform records and platform decisions from browser persistence.
- Remove unsupported destructive/provisioning controls from the live administration workflow.
- Add positive and negative authorization tests against PostgreSQL.

## Out of scope

- Activating tenant-domain routing and tenant migrations (WP 2.1).
- Provisioning, retry/recovery and physical tenant deletion (WP 2.2).
- Product, order and analytics APIs that do not yet exist on the Laravel server.
- Platform-user management screens and role-assignment APIs.
- MFA, API tokens or third-party identity providers.

## Invariants

- Authorization is evaluated on the server for every protected request.
- The browser cannot submit or manufacture a role or permission grant.
- Platform permissions never satisfy tenant abilities, and tenant permissions never satisfy platform abilities.
- Tenant permissions require the requested tenant and an active membership.
- No policy grants authority solely because a role is named `platform_super_admin`.
- A failed or forbidden operation leaves both the resource and success audit log unchanged.
- Physical tenant deletion is unavailable until its full lifecycle is recoverable.
- Store registration is authenticated, CSRF-protected and throttled, but its atomic provisioning/recovery lifecycle remains WP 2.2.

## T0–T5

### T0 — Contract

- [x] Define the ability matrix and fail-closed rules in ADR 0005.
- [x] Separate authorization from Phase 2 tenancy/provisioning work.

### T1 — Server enforcement

- [x] Add policies and tenant-permission middleware.
- [x] Move administration endpoints behind the `web` session and `auth` middleware.
- [x] Protect the tenant settings mutation contract.

### T2 — Audited operations

- [x] Validate review transitions and reasons on the server.
- [x] Serialize concurrent updates and persist complete audit context.
- [x] Add a protected audit-log read endpoint.

### T3 — Browser integration

- [x] Return server-owned permission keys with the authenticated identity.
- [x] Load stores and mutate review status through the protected API.
- [x] Remove sample administration state and decisions from `localStorage`.

### T4 — Gates

- [x] Prove guest `401`, unauthorized `403`, authorized success and cross-tenant denial.
- [x] Prove old/new audit values and request attribution.
- [x] Pass repository, backend, frontend and container-integration gates locally.

### T5 — Evidence and delivery

- [x] Complete independent read-only review.
- [x] Record verification evidence.
- [ ] Commit, push, open PR, pass required CI and merge.

## Risks and controls

| Risk | Control |
|---|---|
| UI hides a button but API remains callable | Every route has authentication and policy middleware |
| Reviewer receives super-admin authority | Permission abilities, no role-name bypass, negative tests |
| Membership in one store leaks into another | Exact tenant is passed to the policy and permission query |
| Concurrent decisions lose attribution | Transaction plus target-row lock and one audit write |
| Browser persists fake approval | Platform store state comes only from the protected API |
| Early deletion destroys tenant data | No deletion endpoint before provisioning-safe lifecycle |

## Rollback

Revert protected route registration, policy/middleware classes, administration API client and audit operation service together. WP 1.1 identity data and WP 1.2 sessions remain intact. Audit records already written are historical evidence and must not be silently deleted.
