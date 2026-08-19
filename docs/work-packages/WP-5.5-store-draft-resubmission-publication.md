# WP 5.5 — Server-owned draft, resubmission and merchant publication

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.5 |
| Status | Complete and merged |
| Started | 2026-08-19 |
| Branch | `codex/wp-5.5-store-draft-publication` |
| Base | Protected `main` at `7fffc5d` |
| Dependencies | WP 2.2–2.3; WP 3.1–3.3; WP 5.4 |
| Decision | [ADR 0017](../decisions/ADR-0017-server-owned-draft-resubmission-merchant-publication.md) |

## Objective

Complete the merchant-controlled store lifecycle: save a new store draft on the server, restore it across sessions, correct and resubmit a rejected request without creating another tenant, and publish or unpublish an eligible store without platform-operator intervention.

## Scope

- Add central draft and resubmission-receipt records with database constraints, adoption and safe rollback refusal.
- Add revisioned draft create/read/update contracts and safe machine-readable conflict responses.
- Link first submission to its authoritative draft without changing the existing recoverable provisioning pipeline.
- Move a rejected linked draft to correction-required atomically with the platform decision.
- Add owner-authorized correction and idempotent resubmission with domain/subscription history preservation.
- Add a dedicated merchant publication permission, policy abilities, endpoints and audit actions.
- Project state-specific draft, resubmit, publish and unpublish capabilities.
- Restore `/app/new` from the server, save authenticated drafts centrally and expose correction/resubmission and publication actions in the merchant portal.
- Keep explicit local draft import only as recovery material.

## Out of scope

- Platform administration-console redesign.
- Team invitation and ownership-transfer UI.
- Payments, refunds, subscription self-service or plan upgrades after approval.
- External custom domains, DNS/TLS, email, WhatsApp or social publishing.
- Store deletion, tenant/schema deletion or destructive retention automation.
- Public storefront visual redesign.

## Product and safety invariants

- One unbound editable draft exists per user; one linked draft exists per submitted tenant.
- A draft handle does not reserve a public domain until submit/resubmit succeeds.
- Submitted data cannot be silently edited while review or provisioning is in progress.
- Rejection, correction and resubmission form one closed state machine; platform management cannot bypass corrected-payload persistence.
- Every resubmission replay has the same actor, key and fingerprint or fails with 409.
- Approval can only provision the corrected payload revision committed before the status returned to pending.
- Historical publication requests, reservations and subscriptions are never rewritten into a new decision.
- Merchant publication requires an active user, active merchant-owner membership, explicit permission and current readiness under locks.
- State-specific capabilities improve the interface but never replace endpoint authorization.
- No audit or error response exposes the full workspace config, SQL, stack traces or secrets.

## T0–T5

### T0 — Contract and migration design

- [x] Audit existing submission, review, provisioning, subscription, reservation and publication state machines.
- [x] Accept ADR 0017 ownership, concurrency, idempotency and authorization decisions.
- [x] Complete independent design review and incorporate all blocking findings.
- [x] Prove migration preflight, constraints, deterministic adoption and rollback refusal.

### T1 — Server-owned draft and resubmission

- [x] Add central models, requests, resources, policies and draft endpoints.
- [x] Link new and adopted submissions to one authoritative draft.
- [x] Make platform rejection atomically open correction and remove the ordinary platform reopen bypass.
- [x] Implement owner correction and idempotent resubmission with corrected provisioning payload.

### T2 — Merchant publication authority

- [x] Add and migrate `tenant.publication.manage` only for merchant owners.
- [x] Add separate merchant publish/unpublish policy abilities and routes.
- [x] Reuse one locked publication core with distinct server-owned audit actions.
- [x] Prove suspension, concurrent decisions and same-state replay fail safely.

### T3 — Merchant journey

- [x] Restore and save `/app/new` through the draft API rather than authenticated localStorage authority.
- [x] Add correction, resubmission, publish and unpublish actions with truthful loading/error/conflict states.
- [x] Preserve an explicit local-recovery import path without automatic overwrite.
- [x] Add focused route, adapter, portal and recovery tests.

### T4 — Gates

- [x] Pass database constraints, adoption, rollback/reapply and populated-refusal tests.
- [x] Pass HTTP 401/403/404/409/419/422/429 and tenant-isolation gates.
- [x] Pass independent-connection concurrency gates for draft, review/resubmit and membership/publication races.
- [x] Pass frontend tests/build/audit, backend quality, repository safety and container integration.

### T5 — Evidence and delivery

- [x] Record exact verification evidence and remaining product handoff.
- [x] Obtain final independent read-only approval with no blocking findings.
- [x] Commit implementation and evidence separately, push, open PR, pass required CI and merge.

## Required acceptance gates

- Two writers using one draft revision produce one success and one `draft_revision_conflict`; no fields are partially overwritten.
- Reusing a resubmission key with another fingerprint returns 409 and changes no lifecycle record.
- Domain races produce one reservation winner without duplicate tenant/publication/subscription state.
- Reject versus resubmit and membership suspension versus publish are serialized and fail closed.
- Same-plan active/pending reuse, elapsed-active expiry, automatic/manual plans and plan replacement preserve partial-unique constraints and history.
- The provisioning worker materializes the corrected payload revision, not the original rejected snapshot.
- Guest, staff, invited, suspended, deleted and unrelated users cannot edit/resubmit/publish.
- `/app/new` reloads the central draft across a fresh browser state; a local recovery draft requires an explicit import decision.
- The interface never claims resubmission or publication success before the server response.

## Rollback

Application changes can be reverted while keeping durable draft data. Database rollback is permitted only on an empty draft/resubmission installation and must refuse before any destructive DDL when records exist.
