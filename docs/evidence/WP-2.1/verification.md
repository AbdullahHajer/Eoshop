# WP 2.1 verification — 2026-08-14

## Scope

Evidence covers domain-resolved runtime tenancy, PostgreSQL schema isolation, central connection restoration, canonical-domain enforcement, selected tenant migrations, route-cache safety and the deliberate absence of automatic provisioning side effects.

## Current local results

| Gate | Result | Evidence |
|---|---|---|
| Laravel Pint | Pass | 83 files |
| Larastan | Pass | 61 analyzed paths; no errors |
| Fast backend tests | Pass | 3 tests, 6 assertions |
| PostgreSQL database tests | Pass | 40 tests, 215 assertions |
| Migration lifecycle | Pass | Six system migrations; WP 2.1 constraint rolled back and reapplied in dependency order |
| Route cache | Pass | Tenant routes cached and cleared; one GET and one POST store-config route |
| Container smoke | Pass | Central SPA, health, JSON 404, auth/session, authorization and live tenant-Host boundaries passed |
| Cleanup | Pass | Temporary containers, volumes and network removed |

## Verified boundaries

- Two domain hosts resolve to separate schemas and return their own configuration.
- The default connection returns to central after each tenant request.
- Unknown, central, pending and missing-schema hosts fail closed.
- Platform admin and store-registration endpoints are unavailable on tenant hosts.
- Unknown hosts cannot bootstrap authentication sessions.
- A merchant owner can sign in on a registered custom host and update only the exact tenant configuration.
- Session and cache persistence use the named central connection.
- Tenant creation and deletion events do not create or drop schemas.
- `tenants:migrate --tenants=<id>` migrates only the selected existing schema.
- Canonical domain model normalization and PostgreSQL constraints reject malformed or duplicate domains.
- Route caching does not duplicate application tenant routes.

## Deferred boundaries

- No endpoint or model event creates, retries or removes a tenant schema. WP 2.2 owns that recoverable lifecycle.
- Store registration returns `503` while provisioning is deliberately unavailable.
- The order mutation remains unregistered until totals, products, stock and pricing are server-owned.
- Tenant filesystem and queue-context switching remain disabled until their isolation and worker lifecycle can be tested independently.

## Independent review

Read-only reviewer verdict: `APPROVE`. No blocking findings remained after the final direct-database uniqueness assertion.

## Pending before delivery

- GitHub pull request and required-check run identifiers.
