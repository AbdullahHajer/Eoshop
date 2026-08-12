# WP 1.1 — Central identity model

| Field | Value |
|---|---|
| Phase | Phase 1 — Identity, authentication and authorization |
| Work Package | WP 1.1 |
| Status | Ready for merge; local and GitHub verification passed |
| Started | 2026-08-12 |
| Branch | `codex/wp-1.1-central-identity` |
| Base | Protected `main` at `4aa02e7` |
| Decision | [ADR 0003](../decisions/ADR-0003-central-identity-and-role-scopes.md) |

## Objective

Create the central, server-owned identity and authorization data model that later authentication and platform policies can trust. A user may hold platform roles and may belong to multiple stores with a different tenant role in each store.

## Scope

- Add central `users`, `roles`, `permissions`, `role_user`, `permission_role`, `tenant_user` and `admin_audit_logs` tables.
- Add an authenticatable Laravel `User` model with normalized email storage and future-ready password fields.
- Distinguish platform-scoped roles from tenant-scoped roles.
- Define the four planned system roles: Platform Super Admin, Platform Reviewer, Merchant Owner and Merchant Staff.
- Seed stable permission keys and deterministic role-permission mappings.
- Add typed Eloquent relationships and one assignment service that rejects cross-scope role use.
- Record sensitive role assignments in the central audit log.
- Test schema constraints, role seeding, tenant isolation, permission lookup and negative scope cases against PostgreSQL.

## Out of scope

- Registration, login, logout, password reset, sessions or API tokens (WP 1.2).
- Replacing the two simulated frontend identity states (WP 1.2).
- Protecting administration routes with middleware and policies (WP 1.3).
- Creating or repairing tenant databases and tenant migrations (Phase 2).
- Inviting staff through an API or user interface.
- Migrating simulated browser users into production identities.

## T0 — Baseline

- Laravel has no `User` model, auth configuration or identity migrations.
- The central database currently contains only `tenants` and `domains`.
- Merchant identity is represented by separate `authUser` and `registeredUser` browser states.
- The interface persists simulated merchant and platform data in `localStorage`.
- The administrator modal accepts a hard-coded test credential and other simulated logins.
- Central administration routes are currently public; route protection remains WP 1.3.
- Tenant IDs are strings, so membership foreign keys must match that existing contract.

## T1 — Design

### Identity boundaries

- Users, roles, permissions, memberships and audit logs live in the central PostgreSQL schema.
- A platform role is assigned through `role_user`.
- A tenant role is assigned through the unique `(tenant_id, user_id)` membership in `tenant_user`.
- Permission keys are stable machine identifiers; each permission also carries an explicit scope and labels are presentation metadata.
- Composite database foreign keys require roles and permissions in every mapping to share the same scope. Platform and tenant assignment pivots are also constrained to their declared scope.
- A service owns role assignment, requires an attributed actor and rejects a platform role in a tenant membership or a tenant role as a platform role.
- Passwords may be null until WP 1.2 establishes credentials. If present, the model uses Laravel's hashed cast and never exposes them in serialization.

### Role matrix

| Role | Scope | Intended authority |
|---|---|---|
| Platform Super Admin | Platform | Full platform store, user and audit administration |
| Platform Reviewer | Platform | View/review stores and view audit records |
| Merchant Owner | Tenant | Full management within an assigned store |
| Merchant Staff | Tenant | Product/order operations and tenant analytics without membership administration |

### Threats and controls

| Threat | Control in WP 1.1 |
|---|---|
| Browser grants itself an admin role | No role-assignment API; authoritative mappings exist only in PostgreSQL |
| Tenant role leaks into another store | Membership is keyed by tenant and permission checks require the tenant ID |
| Platform role is used as a tenant role | Assignment service validates role scope and negative tests enforce rejection |
| Duplicate or case-variant identity | Email normalization plus a unique database key |
| Sensitive assignment loses attribution | Assignment service requires an actor and writes immutable actor/tenant identifier snapshots that survive hard deletion |
| Role deletion invalidates memberships | Role foreign keys restrict deletion while assignments exist |
| Two requests race to assign the same user | Assignment transactions serialize on the target user's central row |

### Rollback

Reverse the new system migration before any real identities are created. After production identities exist, rollback requires an export and explicit data-retention decision; dropping identity or audit tables is not an acceptable routine rollback.

## T2 — Implementation

- Added typed role, permission, user-status and membership-status enums.
- Added the central identity migration and first-party Laravel authentication provider.
- Added Eloquent models and tenant/user relationships.
- Added an idempotent system-role and permission seeder.
- Added a transactional role-assignment service with scope validation, mandatory actor attribution, per-user serialization and audit writes.
- Added platform and tenant permission checks that reject suspended or soft-deleted users and inactive memberships.

## T3 — Verification

- Fast backend checks exclude the database group and remain deterministic without infrastructure.
- PostgreSQL integration tests cover seeding, normalization, hashing, serialization, scope isolation, suspension, audit retention and invalid assignments/mappings.
- The container gate applies the full central migration set, seeds identity data, runs database tests, rolls back the identity migration, reapplies it and seeds again.

## T4 — Operational readiness

- Authentication endpoints and authorization middleware remain disabled until WP 1.2 and WP 1.3.
- No default user or production credential is seeded.
- Role and permission keys are stable application contracts; display names may change without changing authorization keys.
- The CI integration job builds the backend quality image so PostgreSQL tests run in the same locked PHP dependency environment as backend quality checks.

## T5 — Evidence and review

- Local verification evidence: [WP 1.1 verification](../evidence/WP-1.1/verification.md).
- Independent sub-agent re-review: `APPROVE` with no blocking findings after the requested security fixes.
- GitHub Actions run `31629494852` passed all four required checks on implementation commit `5848a2a`.

## Acceptance criteria

- [x] Central identity migration applies cleanly after the existing tenant/domain migrations.
- [x] The migration rolls back cleanly on an isolated test database.
- [x] Four deterministic system roles and their permissions seed idempotently.
- [x] Email normalization and uniqueness are verified.
- [x] A user can hold platform roles and different roles in different tenants.
- [x] Permission checks are tenant-specific and do not leak between tenants.
- [x] Cross-scope role assignments are rejected.
- [x] Role assignments create audit records.
- [x] Password and remember-token values are hidden from serialization.
- [x] Existing repository, frontend, backend and container gates pass locally.
- [x] Evidence and exact CI results are recorded before merge.

## Evidence

- [Local verification — 2026-08-12](../evidence/WP-1.1/verification.md)
- [GitHub Actions run 31629494852](https://github.com/sas-prog1/Eoshop/actions/runs/31629494852)
