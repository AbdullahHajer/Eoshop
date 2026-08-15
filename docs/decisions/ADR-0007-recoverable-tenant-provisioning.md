# ADR 0007 — Recoverable tenant provisioning

## Status

Accepted for WP 2.2 on 2026-08-15.

## Context

WP 2.1 made a ready tenant schema selectable at runtime, but deliberately did not create schemas. Store submission, review, schema creation, migrations and initial configuration must not run as one HTTP request or leave an apparently active half-built store.

## Decision

- Keep review and technical provisioning as independent state axes. `verification_status` remains the human review decision; `provisioning_status` records `not_started`, `queued`, `provisioning`, `retrying`, `active` or `failed`.
- A tenant host is routable only when review is `approved`, provisioning is `active`, the latest run is active, its deterministic schema has platform provenance, and that schema exists.
- Accept store submissions only on the central host, behind session authentication, CSRF and throttling. Require an `Idempotency-Key` UUID and bind it to the submitting user and a canonical payload fingerprint.
- Persist the pending key and fingerprint in browser storage until a response is confirmed, so an ambiguous network result or reload replays the same submission.
- Derive owner identity from the authenticated session. Client-supplied owner fields are never authoritative.
- Store submission creates only central tenant, deterministic internal hostname, submission, owner membership and audit records. It does not create or migrate a schema. User-selected commercial domains remain WP 2.3.
- Approval creates the provisioning run and database-queue job inside the same central PostgreSQL transaction. The queue must use the named central connection with `after_commit=false`; unsafe configuration fails and rolls back the review decision.
- The queued payload contains only the provisioning-run identifier. A worker obtains a PostgreSQL advisory lock per tenant and revalidates the latest run and review state before work.
- Record schema, migration, initial-configuration and activation checkpoints per delivery attempt. Initial configuration uses a stable identifier and an upsert.
- Record schema provenance in the run in the same PostgreSQL transaction as `CREATE SCHEMA`. An existing schema without provenance is never adopted, migrated, exposed or deleted, except through the explicit WP 2.1 upgrade migration that marks an already approved deterministic schema as `wp21_adopted`.
- Retain a platform-owned partial schema in quarantine after failure so a retry can resume safely. Do not delete the tenant, domain, membership or submission. General schema deletion remains outside WP 2.2.
- Store only bounded safe error codes and summaries centrally; detailed exceptions stay in server logs with the run identifier.
- Manual retry is restricted to platform store managers and only an approved tenant in the `failed` state. Terminal or superseded jobs are consumed as safe no-ops.
- Refuse migration rollback while submission, run, step, queue or failed-job records exist, preventing provenance loss while schemas remain.

## Consequences

- HTTP submission and approval stay short while slow migrations run in a dedicated worker.
- A database queue is an operational dependency; the worker and queue backlog must be monitored.
- Failed stores remain diagnosable and inaccessible instead of being silently removed.
- A later retention policy is required for old provisioning steps, runs and failed jobs.
- Plans, payment, quotas, public custom-domain ownership/DNS/TLS and destructive tenant deletion remain WP 2.3 or later.
