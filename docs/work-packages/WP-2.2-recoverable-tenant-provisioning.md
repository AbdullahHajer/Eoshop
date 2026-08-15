# WP 2.2 — Recoverable tenant provisioning

| Field | Value |
|---|---|
| Phase | Phase 2 — Tenant lifecycle, store and domain |
| Work Package | WP 2.2 |
| Status | Complete and merged |
| Started | 2026-08-14 |
| Branch | `codex/wp-2.2-recoverable-provisioning` |
| Base | Protected `main` at `f350f7a` |
| Dependencies | WP 1.1–1.3; WP 2.1 |
| Decision | [ADR 0007](../decisions/ADR-0007-recoverable-tenant-provisioning.md) |

## Objective

Turn an authenticated store request into an approved, isolated and reachable tenant through a durable asynchronous workflow that is atomic at its central boundaries, idempotent on retries, observable by step and fail-closed at runtime.

## Scope

- Real authenticated and idempotent store submission.
- Separate review and technical provisioning state machines.
- Central records for submissions, runs, step checkpoints, jobs and failed jobs.
- Atomic approval/run/job creation on the central PostgreSQL connection.
- Dedicated database-queue worker with bounded attempts, backoff and timeout.
- Deterministic schema creation with platform provenance.
- Explicit adoption provenance for approved deterministic schemas carried forward from WP 2.1.
- Selected tenant migrations, stable initial-config upsert and readiness activation.
- Advisory tenant locking, stale-job no-op behavior and manage-only manual retry.
- Safe failure summaries, retained partial schemas and runtime quarantine.
- Admin provisioning visibility and retry control.
- Honest storefront submission UI without prototype payment, document or instant-success claims.
- Deterministic internal hostnames and reload-safe submission idempotency; user-selected domains remain deferred.

## Out of scope

- Plans, subscriptions, payment, quotas and store-count policy.
- Public custom-domain availability, ownership proof, DNS and TLS.
- General tenant or schema deletion and automated retention cleanup.
- Product/order pricing and inventory ownership.
- Tenant filesystem or tenant-scoped queue bootstrapping.

## T0–T5

### T0 — Contract

- [x] Record the two-axis lifecycle and fail-closed runtime contract.
- [x] Define atomic queueing, provenance and compensation boundaries.

### T1 — Central submission and approval

- [x] Persist idempotency key, fingerprint and bounded payload snapshot.
- [x] Derive owner attribution from the session and assign merchant ownership centrally.
- [x] Queue exactly one run inside the approval transaction.

### T2 — Worker and recovery

- [x] Add the dedicated database worker, run/step records and advisory locking.
- [x] Create, migrate, seed and activate only the latest approved run.
- [x] Retain owned partial schemas, reject unowned schemas and support manager retry.

### T3 — Runtime and interface

- [x] Require approved plus active provisioning and provenance at runtime.
- [x] Expose safe progress/error state to the admin API.
- [x] Replace simulated submission success with the real endpoint.

### T4 — Gates

- [x] Prove PostgreSQL constraints and migration rollback/reapply.
- [x] Prove submission idempotency, forged-owner rejection and no inline schema work.
- [x] Prove atomic approval rollback, real database worker success and failed-job exhaustion.
- [x] Prove retry/resume, stable seed, stale-job no-op, unowned-schema quarantine and Host access.
- [x] Pass frontend tests/build and PHP formatting/static analysis/fast tests.

### T5 — Evidence and delivery

- [x] Record local verification evidence.
- [x] Complete independent read-only review with no blocking findings.
- [x] Commit, push, open PR, pass the four required checks and merge.

## Rollback

The migration refuses rollback while any submission, run, step, queue or failed-job record exists. Stop the worker and complete an explicit data-preservation or recovery procedure before retrying. Code rollback must not drop tenant schemas or delete central tenant, domain, submission, membership or audit records. Any retained schema remains quarantined until an explicit recovery decision.
