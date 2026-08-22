# WP 5.11 — Platform user lifecycle and role assignment

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.11 |
| Status | Complete and merged |
| Started | 2026-08-21 |
| Branch | `codex/wp-5.11-platform-user-lifecycle` |
| Base | Protected `main` at `8188c82` |
| Dependencies | WP 1.1–1.3; WP 3.1; WP 5.10 |
| Decision | [ADR 0023](../decisions/ADR-0023-platform-user-lifecycle.md) |

## Objective

Add a safe, server-authoritative platform-team workspace where an authorized administrator can invite operators, assign platform roles and suspend/reactivate access without exposing credentials, adopting merchant identities, losing the last manager or leaving stale sessions valid.

## Baseline

- Central users, platform roles, permission mappings, database sessions, password-reset tokens and audit records already exist.
- `platform.users.manage` exists, but there is no user policy, lifecycle service, administration API or interface.
- The QA provisioning command is intentionally local/operational and cannot become a browser account-management implementation.
- Public self-registration creates active merchant identities; platform operators require a separate invitation and role-assignment boundary.
- External mail delivery is not configured in the local Pilot, so the product must distinguish broker acceptance from proven delivery.

## Scope

- Add strict platform-user and platform-role read APIs on the central domain.
- Add pending invitation creation without accepting or returning a password.
- Reuse the existing password broker for setup-link dispatch and pending-user activation.
- Add complete platform-role replacement using immutable system roles only.
- Add guarded optimistic suspend/reactivate/pending transitions with reset-token, session-generation and remember-token revocation.
- Add an allowlisted active-tenant-membership count for unconditional global-suspension confirmation context.
- Enforce actor recheck, self-mutation prohibition and last-effective-manager retention under PostgreSQL locking.
- Record attributable, redacted audit events in the same central transaction as each durable mutation.
- Add `/admin/users` to the route-owned console with truthful list, filters, invite, role and status workflows.
- Preserve independent stores/audit/users permission boundaries and all existing merchant behavior.

## Out of scope

- Hard deletion, restoration or email reassignment of identities.
- Promoting an existing merchant identity into a platform operator.
- Tenant membership or merchant-staff management.
- Custom roles, raw permission editing or changing seeded system-role definitions.
- Password display, administrator-supplied passwords, impersonation or session inspection.
- External SMTP configuration, delivery receipts or bounced-email handling.
- MFA, SSO, device management or fine-grained production security alerts.
- Writable platform settings, branding, feature flags, plan editing or secrets.

## Safety and product invariants

- Permission keys, never role names, authorize the section and routes.
- Every listed or mutated target already has at least one platform role, except the identity created atomically by the invite operation.
- Existing and deleted email ownership fails closed; no endpoint performs implicit adoption or restoration.
- The browser never sends a status, password, permission list, actor ID or verification timestamp during creation.
- Platform roles are server allowlisted, platform-scoped, system-owned and non-empty.
- The actor cannot mutate their own status or roles, and no mutation can remove the last active effective users manager.
- Suspension revokes database sessions and remember state in the lifecycle transaction.
- Pending activation occurs only through possession of a valid setup/reset link and never reactivates suspension.
- External dispatch is reported as accepted/throttled/failed, never as delivered; committed creation remains authoritative when dispatch fails.
- Status and role mutations carry exact optimistic preconditions and stale writes return 409 without side effects.
- Suspension is global identity suspension; the interface always warns about its scope and shows the central active-membership count only as snapshot context.
- Missing, non-integer or stale `identity_session_generation` fails closed; only a freshly validated current remember-cookie may bind the current generation.
- Audit and application logs contain no password, hash, token, session ID or mail body.
- 401, 403, 409, 422, network and server failures remain distinct and mutations are never automatically replayed.
- WP 5.11 adds no hard-delete route; its only schema change is a checked central session-generation column applied and rolled back under drain with one-time invalidation of authenticated sessions and remember tokens.

## T0–T5

### T0 — Contract and baseline

- [x] Inventory current identities, roles, permissions, sessions, password broker and audit boundaries.
- [x] Draft ADR 0023 lifecycle, concurrency, invitation and truthfulness decisions.
- [x] Complete independent design review and freeze the contract before implementation.

### T1 — Server read model and authorization

- [x] Add user policy and permission-protected platform role/user read APIs.
- [x] Add strict literal search, exact filters, deterministic bounded pagination and allowlisted resources.
- [x] Prove central connection and Host/session/CSRF/permission boundaries.

### T2 — Lifecycle mutations

- [x] Add pending invitation creation and resend through the configured password broker.
- [x] Add locked optimistic non-empty platform-role replacement.
- [x] Add locked optimistic status transitions, reset-token/session-generation revocation, self-protection and last-manager retention.
- [x] Add strict session-generation middleware, remember-cookie binding and drain-safe migration/rollback.
- [x] Replace the reset callback with the locked reset matrix and activate pending invited operators without reactivating suspension.
- [x] Record redacted attributable audit events atomically.

### T3 — Platform users interface

- [x] Add permission-owned `/admin/users` routing and navigation.
- [x] Add truthful user list, filters, invite form, role editing and lifecycle actions.
- [x] Add explicit loading, empty, 401/403/409/422/network and mutation-pending states.
- [x] Remove any unsupported delete, password, permission-editor, promotion or impersonation claim.

### T4 — Verification and gates

- [x] Pass focused PostgreSQL lifecycle and frontend orchestration tests during implementation.
- [x] Obtain one final independent implementation review after focused gates are green.
- [x] Pass frontend/backend quality, repository safety and one isolated full container integration run.

### T5 — Evidence and delivery

- [x] Record exact evidence and retained delivery/custom-role/deletion/MFA debt.
- [x] Commit implementation and evidence separately.
- [x] Push, open PR, pass required CI, merge and record protected-main facts.

## Acceptance criteria

- An operator with only `platform.users.manage` can enter `/admin/users` but cannot load stores or audit.
- A reviewer or audit-only operator without users permission cannot request or see user data.
- A manager can create a pending platform operator without choosing or receiving a password.
- The invitee remains unable to log in until a valid setup link establishes the password, then becomes active exactly once.
- A suspended invite or established operator cannot be reactivated by an old reset link.
- Suspending an operator invalidates every reset token, database session, remember token and prior session generation before the response succeeds, including after later reactivation.
- The interface always warns that global suspension also blocks tenant access and shows the exact central active-membership count when non-zero.
- Missing/stale session generations and stale remember cookies cannot survive migration, suspension, reset or reactivation.
- Stale expected state, self-mutation and any role/status change that would remove the last active effective users manager return a conflict without data or audit side effects.
- Role replacement accepts only non-empty platform system roles and never modifies tenant membership.
- Search/filter/pagination and error behavior remain server-authoritative and fail closed.
- The interface contains no hard-delete, raw permission, password, merchant-promotion or impersonation control.

## Rollback

Revert the users section, lifecycle APIs/policies/services and locked reset path together. Before dropping `session_generation`, invalidate authenticated sessions and remember tokens again so old code cannot accept a session created under a newer generation. Existing identities, role assignments and audit history remain central data and are never deleted by code rollback. Accounts already suspended remain suspended, and accounts already activated retain their established credentials.
