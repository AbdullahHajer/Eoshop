# WP 2.2 verification — 2026-08-15

## Scope

Evidence covers authenticated idempotent submission, atomic approval queueing, the recoverable tenant worker, schema provenance, checkpointed retries, failed-job quarantine, runtime readiness, interface integration and regression of all previous database boundaries.

## Current local results

| Gate | Result | Evidence |
|---|---|---|
| Laravel Pint | Pass | 104 files |
| Larastan | Pass | 81 analyzed paths; no errors |
| Fast backend tests | Pass | 3 tests, 6 assertions |
| Frontend tests | Pass | 4 files, 10 tests |
| Frontend production build | Pass | TypeScript and Vite production build |
| PostgreSQL database tests | Pass | 50 tests, 321 assertions |
| Migration lifecycle | Pass | Seven system migrations; empty rollback/reapply, populated rollback refusal and WP 2.1 schema adoption passed |
| Container smoke | Pass | Central SPA, health, JSON/auth boundaries, route cache, tenant Host and live Compose worker consumption passed |
| Cleanup | Pass | Temporary containers, volumes and network removed |

## Verified boundaries

- Submission requires authentication, CSRF, throttling and a UUID idempotency key.
- The same user/key/payload replays the same tenant; a changed payload conflicts.
- The browser retains the pending key/fingerprint across an ambiguous network result and clears it only after a confirmed response.
- Owner attribution comes from the authenticated user and submission creates no schema inline.
- Submission assigns a deterministic internal hostname; user-selected commercial hostnames are not reserved in WP 2.2.
- Approval, provisioning run and database job are one central transaction; unsafe queue configuration rolls all of them back.
- A real Laravel database worker consumes the queued job and completes schema creation, migrations, stable initial configuration and activation.
- Delivery failure records safe step/run errors, retains a platform-owned partial schema and resumes without duplicate configuration.
- An unowned pre-existing schema fails closed, remains untouched and reaches `failed_jobs` after bounded exhaustion.
- Manual retry is store-manager-only and creates a new monotonic run.
- A manual retry inherits explicit schema provenance, consumes the stale terminal job as a no-op, completes through the new run and returns Host `200`.
- Terminal, stale-run and advisory-lock-contention failure callbacks are no-ops and cannot lower tenant/run state or add failure-policy steps.
- An approved deterministic WP 2.1 schema is adopted with explicit `wp21_adopted` provenance during upgrade.
- A populated WP 2.2 migration refuses rollback instead of erasing provenance and central lifecycle records.
- Runtime access requires review approval, active provisioning, an active latest run, provenance and the expected schema.
- Sessions, cache, queue records and audit remain on the central connection.

## Deliberate deferrals

- Packages, subscription/payment, quotas and public custom-domain selection/validation remain WP 2.3.
- No general endpoint drops schemas or deletes tenants.
- Retention and operational alerting for old runs, steps and failed jobs require a later operations package.

## Independent review

Pending final read-only verdict.

## GitHub delivery

Pending commit, pull request, required CI checks and protected-branch merge.
