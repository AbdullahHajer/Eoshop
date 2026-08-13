# WP 1.3 verification — 2026-08-13

## Scope

Verification covers server-owned platform and tenant authorization, explicit store-status transitions, protected administration resources, auditable mutations, central-connection safety after tenancy switching, the administration API client and removal of browser-owned administration authority.

## Local results

| Gate | Result | Evidence |
|---|---|---|
| Repository invariants | Pass | `scripts/ci/repository-gate.ps1` completed successfully |
| Git diff hygiene | Pass | `git diff --check` returned no errors |
| Laravel Pint | Pass | 75 files |
| Larastan | Pass | 54 analyzed paths; no errors |
| Fast backend tests | Pass | 3 tests, 6 assertions |
| Frontend quality | Pass | TypeScript, 7 Vitest tests and production Vite build |
| PostgreSQL database tests | Pass | 32 tests, 161 assertions |
| Migration lifecycle | Pass | Five system migrations applied; WP 1.3, authentication and identity migrations rolled back in dependency order, reapplied and reseeded |
| Live authentication boundary | Pass | Anonymous platform administration `401`; authenticated merchant platform administration `403` |
| Live protected-cost boundary | Pass | Anonymous CSRF session receives `401` from the authenticated Gemini generation route |
| Container smoke | Pass | SPA, health, JSON 404, authentication session and production proxy paths passed |
| Cleanup | Pass | Temporary containers, volumes and network removed |

## Authorization scenarios verified

- Platform administration routes use the encrypted Laravel session, CSRF middleware, authentication, policies and mutation throttles.
- Guests receive `401`; active identities without a platform permission receive `403`; suspended identities lose access.
- A reviewer can list stores and approve or reject a pending store, but cannot suspend an approved store or change platform-managed metadata.
- A custom role carrying `platform.stores.manage` can perform management transitions without relying on a super-administrator role name.
- Store-status transitions are closed to the documented matrix and are authorized again after the target row is locked; revising the reason of an already decided store requires management authority.
- A stale tenant model cannot let a reviewer perform a transition that now requires management authority.
- Unknown tenants return `404`; validation failures, denied operations and no-op decisions do not write success audits.
- Audit failure rolls the resource mutation back.
- Audit records contain actor, tenant, subject, old/new values, IP, a user agent limited to 1024 characters, UUID request identifier and occurrence time.
- The database rejects verification states outside `pending`, `approved`, `rejected` and `suspended`.
- An active merchant owner can manage only the exact tenant membership carrying `tenant.store.manage`; staff, invited, suspended and cross-tenant cases fail closed.
- Permission queries and authorization models remain on the central connection after the default connection is switched to a tenant schema.
- No tenant deletion route exists in WP 1.3.

## Browser boundary verified

- Authentication responses carry server-owned platform permission keys.
- The administrator gate accepts store-view authority rather than a hard-coded role name.
- The administration dashboard loads platform stores from `/api/admin/stores` and sends review decisions through the CSRF-aware API client.
- `mobtaker_platform_stores`, sample platform stores, manual add, physical delete and direct configuration controls were removed.
- Review and management actions are presented according to permissions, while the Laravel policy remains authoritative.
- Gemini mutations use the same authenticated CSRF client after the server route was moved out of the stateless API group.

## Deferred boundaries

- `routes/tenant.php` remains dormant until WP 2.1 activates tenant-domain routing and migrations. Its store-settings mutation already declares `auth` plus the exact `tenant.store.manage` middleware contract.
- Store registration is now authenticated, CSRF-protected and throttled. Its atomic provisioning, retry and recovery design remains WP 2.2.
- Physical tenant deletion is deliberately unavailable until provisioning owns recoverable schema, domain and operational-data cleanup.
- The Vite build reports a `748.11 kB` main JavaScript chunk; frontend decomposition remains a later performance work package.

## Independent review

The read-only reviewer initially returned `REQUEST_CHANGES` for default-connection permission queries, an exposed deletion contract, an over-broad reviewer transition set, authorization before the row lock and reviewer access to revise an already decided reason. The design was changed to explicit central connections, no deletion route, a closed transition matrix, authorization on the locked model and management-only revision of decided values. The reviewer then independently reran the PostgreSQL integration gate at 32 tests and 161 assertions and returned final `APPROVE` with no remaining blockers.

## GitHub delivery evidence

- Implementation commit: `b47c148` (`feat(authz): enforce platform and tenant policies`).
- Pull request: [#6](https://github.com/sas-prog1/Eoshop/pull/6).
- Required-check run: [31729172582](https://github.com/sas-prog1/Eoshop/actions/runs/31729172582).
- Required jobs passed on the implementation head: `Repository safety`, `Backend quality`, `Frontend quality` and `Container integration`.
- The evidence-only follow-up commit must pass the same required checks before merge.
