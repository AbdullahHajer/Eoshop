# ADR 0005 — Server-owned authorization boundaries

- Status: Accepted
- Date: 2026-08-13
- Work package: WP 1.3

## Context

Eoshop already has a central identity, explicitly scoped roles and permissions, and real first-party sessions. The platform administration endpoints are still public, the administration dashboard still treats browser-owned sample data as authoritative, and the tenant settings mutation has no authorization contract.

Authorization must remain correct when one user belongs to multiple stores, when platform reviewers have less authority than super administrators, and when requests are sent directly without using the React interface.

## Decision

Laravel is the only authorization authority. Controllers, route middleware and policies consume the stable permission keys introduced in WP 1.1. The browser may use returned permissions to improve its presentation, but it never grants authority.

The initial ability matrix is:

| Resource action | Required permission |
|---|---|
| List or view platform stores | `platform.stores.view` |
| Approve or reject a pending store | `platform.stores.review` |
| Suspend, reactivate or revise an already decided store | `platform.stores.manage` |
| Change platform-managed store metadata | `platform.stores.manage` |
| Delete a store | `platform.stores.manage`, plus a future provisioning-safe deletion workflow |
| View administrative audit records | `platform.audit.view` |
| Change settings inside one store | `tenant.store.manage` for that exact tenant and an active membership |

Store-status transitions are closed: `pending → approved/rejected` requires review authority; `approved → suspended`, `suspended → approved`, and `rejected → pending` require management authority. All other transitions are rejected.

No global super-administrator bypass is introduced. The super-administrator role receives authority through its seeded permissions, so removing a permission fails closed everywhere.

Platform routes run in Laravel's `web` middleware stack so they can use the encrypted database session and CSRF protection established in WP 1.2. Unauthenticated requests return `401`; authenticated requests that fail a policy return `403`.

Every successful platform mutation runs in a database transaction, locks the target row, and writes an immutable audit record containing the actor snapshot, tenant, action, subject, previous values, new values, request identifier, IP address, user agent and occurrence time. Denied requests do not mutate or create a success audit record.

The tenant settings route declares authentication plus a tenant permission middleware now. Activating tenant-domain routing, cookie-domain behavior and tenant migrations remains WP 2.1. Physical tenant deletion remains disabled until the provisioning lifecycle can delete or retain domains, schemas and operational data safely.

## Consequences

- Direct HTTP requests and modified browser state cannot bypass the same policies used by the interface.
- A platform reviewer can review stores without receiving user-management or destructive authority.
- Tenant authority is evaluated against the exact tenant; membership in store A grants nothing in store B.
- The administration dashboard must load server records and stop persisting platform records or decisions in `localStorage`.
- Deletion controls are removed from the live administration workflow until Phase 2 defines a recoverable lifecycle.

## Rejected alternatives

### Authorize from role names in React

Rejected because client state is user-controlled and role-name checks cannot enforce direct API calls.

### Add a universal super-administrator bypass

Rejected because it makes permission removal ineffective and weakens least privilege.

### Physically delete tenant records in WP 1.3

Rejected because tenant database, domain and membership cleanup belongs to provisioning and could otherwise orphan or destroy data without a recovery contract.

## References

- [Laravel 12 authorization](https://laravel.com/docs/12.x/authorization)
- [ADR 0003 — Central identity and role scopes](ADR-0003-central-identity-and-role-scopes.md)
- [ADR 0004 — First-party session authentication](ADR-0004-first-party-session-authentication.md)
