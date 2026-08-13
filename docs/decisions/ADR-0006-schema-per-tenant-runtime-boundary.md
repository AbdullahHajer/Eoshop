# ADR 0006 — Schema-per-tenant runtime boundary

## Status

Accepted for WP 2.1 on 2026-08-14.

## Context

Eoshop stores platform identity, roles, domains and tenant metadata in one central PostgreSQL database. Tenant operational tables already have migrations, but tenant routes and the database bootstrapper were dormant. The existing store-registration controller also coupled central records to immediate database use without a recoverable provisioning lifecycle.

## Decision

- Use one PostgreSQL database with one deterministic schema per tenant.
- Generate schema names from a sanitized tenant identifier plus a SHA-256 suffix, within PostgreSQL's 63-byte identifier limit.
- Store domains as full canonical ASCII hostnames: lowercase, without scheme, port, path, whitespace or trailing dot.
- Resolve only approved tenants whose expected schema already exists. Unknown, pending, suspended and missing-schema hosts return `404` before switching the default connection.
- Bootstrap only the tenant database connection in WP 2.1. Filesystem, queue-context and automatic provisioning bootstrappers remain disabled.
- End tenancy in a `finally` block after every tenant request, including controller failures, and restore the central default connection.
- Keep sessions, cache, cache locks and future database queues on the named central connection. Cookies remain host-only; a user signs in independently on each custom host.
- Keep platform administration, registration, AI generation, platform root and health routes central-domain only. Authentication session endpoints are available on central domains and ready registered tenant domains. Tenant resource routes are unavailable on central domains.
- Run tenant migrations explicitly with `tenants:migrate --tenants=<id>` only after an external lifecycle has prepared the schema.
- Do not create or delete schemas in tenant model events. Store provisioning, retry, compensation and safe deletion remain WP 2.2.
- Keep the order-write route disabled because the current prototype trusts client-submitted totals and items; server-owned order pricing remains a later work package.

## Consequences

- Tenant requests cannot silently fall back to the central `public` schema.
- A schema count close to PostgreSQL operational limits will require monitoring, migration scheduling and connection-pool testing before large-scale rollout.
- Cross-tenant analytics must use central projections or deliberate jobs rather than ad-hoc cross-schema queries.
- Custom domains use host-only sessions, avoiding unsafe wildcard cookie assumptions.

## Operational commands

Central migrations:

```powershell
docker compose exec -T backend php artisan migrate --path=database/migrations/system --force
```

Tenant migrations after WP 2.2 has prepared the schema:

```powershell
docker compose exec -T backend php artisan tenants:migrate --tenants=<tenant-id> --force
```

Rollback remains explicit and tenant-scoped:

```powershell
docker compose exec -T backend php artisan tenants:rollback --tenants=<tenant-id> --force
```
