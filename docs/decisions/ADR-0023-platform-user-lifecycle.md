# ADR 0023 — Platform user lifecycle and role assignment

- Status: Accepted for WP 5.11 implementation
- Date: 2026-08-21
- Depends on: ADR 0003, ADR 0004, ADR 0005, ADR 0022

## Context

The platform has central users, scoped roles and permissions, database sessions, password-reset tokens and attributable audit records. WP 5.10 deliberately omitted a users screen because rendering role or status controls without a lifecycle contract would allow account takeover, self-lockout, stale sessions and privilege escalation.

`platform.users.manage` already exists and is granted to the seeded platform super-administrator role. It must remain the sole authority for this package; role names are data, not authorization. External email delivery is not configured in the local Pilot, so an invitation request cannot be presented as proven delivery.

## Decision

1. WP 5.11 manages **platform operators only**: central identities that have at least one platform-scoped role. Merchant identities without a platform role are not listed, promoted, suspended or edited by these endpoints.
2. The administration shell adds `/admin/users`. Console entry becomes the logical OR of `platform.stores.view`, `platform.audit.view` and `platform.users.manage`. The users route, section and every users API require `platform.users.manage` independently.
3. The read APIs are:
   - `GET /api/admin/platform-roles`, returning only immutable system roles with `scope=platform`, their display metadata and allowlisted permission keys;
   - `GET /api/admin/users`, returning platform operators only, with optional literal `search`, exact `status`, exact platform `role`, and bounded deterministic pagination.
4. `GET /api/admin/users` accepts only `search`, `status`, `role`, `page` and `perPage`. Search is a trimmed literal case-insensitive substring over name and email, 2–100 characters. Status is one `UserStatus` value. Role is an existing platform-system role key. Page is 1–100000 and perPage is 10–100 with default 25. Results order by `created_at DESC, id DESC`; unknown or invalid parameters return 422.
5. The user projection is allowlisted to ID, name, email, status, server-owned `resumeStatus = active|pending|null`, platform roles, effective platform permission keys, email-verification time, last-login time, creation time and `activeTenantMembershipCount`. `resumeStatus` is returned only for a suspended identity and is derived from established credentials so the client never guesses a lifecycle transition from email verification. The count is computed on the explicit central connection as `tenant_user.status = active`; no tenant IDs, roles or membership rows are returned. Password hashes, remember tokens, reset tokens, session payloads and phone numbers are never returned.
6. `POST /api/admin/users` accepts only name, normalized email and one or more distinct platform-system role keys. It never accepts a password, status, permission list, verification time or actor identity. It creates a pending identity with a null password and assigns the requested roles in one central transaction. Existing active, pending, suspended or soft-deleted email ownership returns 409 and is never adopted or restored implicitly.
7. Creation and mail dispatch have an explicit partial-success boundary. After the central identity/roles/audit transaction commits, the service asks the configured password broker to send a one-time setup link. A committed creation always returns 201 with the authoritative user plus `invitationDispatch.status = accepted|throttled|failed`; it never returns a token or claims external delivery. A lost 201 followed by duplicate create returns 409 `platform_user_email_occupied`, and the interface offers an exact-email reload rather than replaying creation. Dispatch failure leaves a recoverable pending account.
8. `POST /api/admin/users/{user}/invitation` is allowed only for a pending platform operator with a null password. It records `identity.platform_user.invitation_requested` before the external side effect, then creates the broker token under the lifecycle lock and sends its notification only after commit. Every invitation dispatch captures `session_generation` and the raw token as sensitive in-process ownership, then reconciles under the lifecycle lock after the external call; if the identity stopped being eligible or its generation changed through an ABA transition, cleanup removes only that exact token and never a newer dispatch token. Accepted dispatch returns 202; broker throttle returns 429 `platform_invitation_throttled`; dispatch failure returns 503 `platform_invitation_dispatch_failed`. All responses remain token-free and make no delivery claim.
9. Suspending any identity deletes its `password_reset_tokens` row inside the lifecycle transaction. Moving a passwordless suspended operator back to pending does not issue or retain a token; an explicit resend is required. Therefore a setup link issued before suspension cannot activate the account after suspended → pending.
10. Password reset is implemented by one central reset service rather than adding an unsafe branch after the current broker callback. Under the lifecycle advisory lock and one central transaction it locks the identity, revalidates and consumes the token, and applies this matrix:
    - active identity: replace password, rotate remember state/session generation, revoke sessions and keep active;
    - pending identity with at least one platform role: replace password, become active, set `email_verified_at`, rotate remember state/session generation, revoke sessions and write the activation audit;
    - pending identity without a platform role: reject without mutation;
    - suspended or soft-deleted identity: reject without password, status or audit mutation and delete any reset-token row fail-closed.
    The activation audit attributes `actor_user_id` to the target acting by possession of the credential token and records no token/password data. Token consumption, password/status change, session revocation and audit insertion commit or roll back together. A fresh locked status check makes a concurrent second acceptance or reset-versus-suspend fail closed.
11. `PUT /api/admin/users/{user}/roles` requires both `expectedRoleKeys` and the desired `roleKeys`, each a sorted-distinct logical set of platform-system role keys. Under the lock, the expected set must exactly equal the server set or the service returns 409 `platform_user_roles_stale` without mutation. The desired set must be non-empty. Raw permissions, tenant roles and custom roles are rejected. An exact desired set is a no-op with no success audit.
12. `PATCH /api/admin/users/{user}/status` requires `expectedStatus` and desired `status`. The expected value must match under the lock or the service returns 409 `platform_user_status_stale`. The service then enforces these transitions:
    - pending → suspended;
    - active → suspended;
    - suspended → active only when a password exists;
    - suspended → pending only when the password is null.
    An administrator cannot activate an invitation before the invitee establishes a password, or move an established account back to pending. Exact same state is a no-op with no success audit only after the optimistic precondition matches.
13. A central migration adds `users.session_generation BIGINT NOT NULL DEFAULT 1` with `CHECK (session_generation >= 1)`. The authenticated session key is exactly `identity_session_generation`. Explicit login/register bind the current integer. `EnsureActiveUserSession` fails closed when the key is absent, non-integer or different before a protected action. A session freshly authenticated from a valid current remember-cookie is the only missing-key exception: after Laravel validates the current `remember_token`, `SessionGuard::viaRemember()` permits the middleware to bind the current generation once before continuing. No other missing payload is adopted.
14. Suspension and password reset increment `session_generation` with a guarded database expression in the same transaction as deleting sessions and rotating `remember_token`, so an in-flight request cannot resurrect access after later reactivation. Every public forgot-password token issuance also acquires the same lifecycle lock and issues only for an active established identity or a pending passwordless platform operator; suspended/deleted/ineligible identities receive the same generic 202 but no token. A stale remember-cookie fails guard validation after token rotation; a valid newly issued remember-cookie may bind only the current generation. Gates cover missing/non-integer payload, stale generation, simulated late reinsertion, fresh recaller and stale recaller after reset/suspension.
15. Rollout is ordered: enter maintenance/drain so old-code requests finish; apply the migration, which deletes every authenticated database session and nulls every remember token; deploy generation-aware code; then resume traffic. Rollback uses the same drain, deletes authenticated sessions/nulls remember tokens, drops the column while the generation-aware release still owns the down migration, deploys old code and only then resumes traffic. Rollback/reapply is a required PostgreSQL gate; no old-code request may write a session after either invalidation boundary.
16. User suspension is intentionally **global identity suspension** because `users.status` already controls every platform and tenant request. Every confirmation says this unconditionally. `activeTenantMembershipCount` adds snapshot context when greater than zero but is never treated as a safety precondition. Reactivation restores eligibility but never an old session. Platform-role changes alone do not alter tenant memberships or merchant permissions.
17. The authenticated actor cannot change their own status or roles through WP 5.11. Creation and invitation resend are allowed. This explicit self-boundary prevents accidental loss of the active administration session.
18. A platform-wide PostgreSQL advisory transaction lock serializes rare user-lifecycle and token-acceptance mutations. The service then locks actor and target user rows in stable ID order, rechecks that the actor is active/not deleted/authorized and validates the target under the lock.
19. A mutation that would leave zero active, non-deleted users with effective `platform.users.manage` is rejected with 409. This invariant is computed from scoped role-permission relations under the lifecycle lock, not from a role name. Audit failure, token-consumption failure or session-revocation failure rolls back the complete durable mutation.
20. Every successful creation, role change, status transition, invitation request and pending-user activation creates an `admin_audit_logs` event with actor, target, request ID, IP, bounded User-Agent, time and allowlisted old/new fields. `invitation_requested` means the dispatch was requested, not delivered. Passwords, hashes, tokens, session IDs and mail payloads are never audited or logged.
21. The interface shows only server-supported operations: invite operator, filter/list operators, replace roles, suspend, reactivate and resend a pending invitation. It has no delete, password display/reset, arbitrary permission editor, custom-role editor, merchant promotion or impersonation control.
22. A 401 clears the administration identity. A 403 clears protected user projections and actions. A stale-role/status 409 preserves the form, identifies the conflict and reloads server state only on explicit user action. Network/5xx retains the last safe list and never automatically replays a mutation.
23. WP 5.11 adds only the central session-generation migration and its safe one-time session invalidation. Any future invitation-delivery receipt, custom role, platform-only suspension or identity-deletion workflow requires a separate migration and ADR.

## Consequences

- Platform administrators can safely operate a small internal team without sharing credentials or editing database rows.
- Pending setup, active access and global suspension have explicit, testable meanings; suspension may also block the operator's merchant memberships.
- Merchants, tenant memberships and platform operators remain separate security domains.
- External SMTP delivery, custom roles, merchant promotion, impersonation and deletion remain visible future work rather than misleading controls.

## Verification requirements

- Prove central Host, session, CSRF, throttle and permission boundaries for every route.
- Prove creation cannot adopt existing or deleted identities and never accepts/returns a password or token.
- Prove creation partial-success and resend return stable machine states without claiming delivery or replaying creation.
- Prove pending setup activates exactly once, old tokens die on suspension, and suspension wins safely in a reset race.
- Prove suspension increments session generation, revokes all sessions/remember state, blocks tenant access and cannot be undone by an in-flight session after reactivation.
- Prove absent/non-integer generation fails closed, a valid current recaller binds once, stale recallers fail, and migration rollback/reapply preserves the drain contract.
- Prove active membership count is central, exact and informational while the global-suspension warning is unconditional.
- Prove stale expected roles/status, self-mutation and last-manager loss fail under concurrent PostgreSQL transactions.
- Prove role scope, non-empty assignment, exact target ownership, actor recheck and audit rollback.
- Prove strict query keys, literal wildcard search, bounded pagination and deterministic order.
- Prove UI permission routing, 401/403/409/network states, no automatic mutation replay and no unsupported controls.
