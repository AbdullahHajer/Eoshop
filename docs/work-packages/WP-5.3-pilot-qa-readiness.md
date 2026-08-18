# WP 5.3 — Pilot QA readiness

| Field | Value |
|---|---|
| Phase | Phase 5 — Incremental frontend decomposition |
| Work Package | WP 5.3 |
| Status | In progress |
| Started | 2026-08-19 |
| Branch | `codex/wp-5.3-pilot-qa-readiness` |
| Base | Protected `main` at `a47b65e` |
| Dependencies | WP 1.2–1.3; WP 2.2–2.3; WP 3.2–3.3; WP 4.1–4.3; WP 5.1–5.2 |
| Decision | [ADR 0015](../decisions/ADR-0015-incremental-frontend-feature-boundaries.md) |

## Objective

Deliver a repeatable local Pilot environment that a QA team can use now to exercise the real merchant journey: account registration, store draft and submission, administrative approval, asynchronous provisioning, publication, workspace customization, product creation/editing/archival and persistence after reload. Testing starts before visual refinement is complete so findings can feed the remaining work packages.

## Scope

- Add a non-production-only command that provisions or rotates one explicit QA platform administrator without seeding a default credential.
- Add a PowerShell preparation script that builds and starts an isolated `eoshop-pilot` Compose project in dependency order, applies migrations, seeds identity roles, verifies the migration-owned plan catalog, migrates active tenant schemas, provisions the QA administrator and verifies application/worker health.
- Use a resolvable loopback wildcard Pilot base domain and preserve the Compose gateway port when the interface opens a published store.
- Add a QA runbook with role boundaries, test data rules, the end-to-end journey, expected asynchronous states and known scope limitations.
- Add a structured defect template that captures account, tenant, host, state, request correlation and reproducible evidence without secrets.
- Add automated gates for the QA administrator command and the minimum server-authoritative journey already exercised by the integration suite.
- Correct documentation claims that still describe completed authority work as an insecure browser simulation.

## Out of scope

- Public internet deployment, DNS, TLS certificates or shared remote test hosting.
- Visual redesign or completing every Phase 5 extraction before Pilot testing starts.
- Hard deletion of products; the supported merchant removal action is audited archival.
- Real payment collection, external mail delivery, WhatsApp delivery or social-platform publishing.
- Bypassing review, provisioning, subscription or publication state machines for convenience.
- Seeding a merchant account: testers must exercise real self-registration.

## Pilot acceptance journey

1. Start the full stack and create an explicit local QA administrator without exposing its password in committed files or command output.
2. Register a new merchant through the interface and confirm session restoration after reload.
3. Create a local draft, customize identity/theme/contact content and submit a unique store handle on the starter plan.
4. Sign in as the QA administrator, approve the pending store and observe queued/provisioning/active states rather than an instant-success claim.
5. Publish only after readiness blockers are empty; sign back in as the merchant and load the server-owned workspace.
6. Add a product, set it to published, save it and verify that it appears on the exact tenant Host before editing it.
7. Edit the published product, save/reload, then archive it through the supported removal action and verify that it disappears publicly.
8. Reload or use a second browser session and verify that the saved server state and customization are restored.
9. Record any deviation with the supplied defect template and correlation identifiers, without passwords, cookies or raw sensitive payloads.

## T0–T5

### T0 — Pilot contract and baseline

- [x] Prioritize Pilot testability ahead of further non-blocking frontend decomposition.
- [x] Confirm the real server endpoints exist for registration, submission, administration, workspace, catalog, inventory and orders.
- [x] Complete independent design review of the Pilot preparation boundary and incorporate its host, identity, secret and startup-order controls.

### T1 — Safe QA administration

- [x] Add a non-production-only, explicit and idempotent QA administrator command.
- [x] Reject missing/weak credentials, unrelated existing identities and suspended/deleted identities; never print or persist the plaintext password.
- [x] Revoke database sessions and rotate the remember token when an existing Pilot QA administrator password is rotated.
- [x] Prove production refusal and scoped platform permission assignment.

### T2 — Repeatable environment and handoff

- [x] Add one preparation script for the full Compose application, stable ignored APP_KEY, migrations, identity seed data, plan verification, active tenant migrations, worker and health checks.
- [x] Start worker/scheduler only after schema preparation and fail fast unless the Pilot wildcard hostname resolves to loopback.
- [x] Add the Pilot execution runbook and defect template.
- [x] Document exact supported operations and deliberate limitations.

### T3 — Verification

- [x] Pass focused command tests including idempotency, password rotation and production refusal.
- [x] Prove registration/submission/approval/worker/publication/workspace/catalog behavior through the existing PostgreSQL integration gates.
- [x] Perform a clean local Pilot preparation and live health verification.

### T4 — Operational gates

- [x] Pass repository safety, backend quality, frontend quality and container integration.
- [x] Confirm no credentials, cookies or local environment files enter Git history.
- [x] Confirm worker and scheduler services are running after preparation.

### T5 — Evidence and delivery

- [ ] Record immutable verification evidence and the QA handoff entry point.
- [ ] Complete independent read-only review with no blocking findings.
- [ ] Commit implementation separately from closeout evidence, push, open PR and merge.

## Risks and controls

- **QA credentials escaping into source control:** the normal handoff path uses a secure interactive prompt; the password is forwarded only through a named process environment variable, validated, hashed by the model, never printed and removed from the PowerShell process in `finally`.
- **Unstable encryption key:** the script creates `APP_KEY` once only when absent, writes it to ignored `backend/.env` and never rotates it on rerun.
- **Identity takeover:** an existing account is eligible for credential rotation only when it is already an active Pilot QA super administrator; merchant, reviewer, suspended and deleted identities fail closed.
- **Pilot helper used in production:** the command refuses when `APP_ENV=production` and the preparation script targets local Compose only.
- **False instant readiness:** the runbook preserves approval, queue and publication states and asks QA to observe them.
- **Destructive expectations:** product “delete” is documented and tested as archive; no tenant/database deletion helper is introduced.
- **Environment drift:** preparation uses an isolated Compose project/volume plus the repository's locked Docker images, central migrations, IdentitySeeder, migration-owned plans, active-tenant migrations and full service graph. Rerun is convergent and no destructive reset is implicit.

## Rollback

The command, script and documentation can be removed without schema or API changes. A QA administrator created by the command is ordinary central identity data and must be suspended or removed through an explicit administrative data operation; code rollback does not silently delete it.
