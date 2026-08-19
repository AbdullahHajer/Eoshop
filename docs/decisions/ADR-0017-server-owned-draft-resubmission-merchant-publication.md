# ADR 0017 — Server-owned draft, resubmission and merchant publication

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-19 |
| Decision owners | Eoshop product and engineering |

## Context

WP 5.4 made the merchant lifecycle visible, but a new store is still drafted in browser storage, a rejected request can only be reopened by a platform manager, and publication remains a platform-only operation. The central store submission, domain reservation, subscription, provisioning and publication state machines are already authoritative and must not be duplicated.

## Decision

1. Add one central `store_drafts` aggregate. An unbound draft belongs only to its creating user. Once linked to a tenant, `owner_user_id` remains attribution while every active `merchant_owner` membership may edit a correction; suspended, invited, staff and unrelated users fail closed.
2. Draft states are `draft → submitted → correction_required → submitted`. A platform rejection atomically moves the linked draft from submitted to correction-required and advances its revision. The normal platform `rejected → pending` shortcut is removed; ordinary return to review belongs to merchant resubmission.
3. Every draft write uses optimistic concurrency. Creation expects revision zero, updates require the exact positive revision, and conflicts return the machine code `draft_revision_conflict` with a safe current snapshot. Submitted drafts are immutable; linked drafts are mutable only while correction is required.
4. Draft saves validate bounded shapes and sizes. Submit and resubmit repeat full workspace validation and plan quota under central row locks. A draft handle never reserves a hostname before submission.
5. First submission keeps the existing store-submission idempotency receipt and atomically links the draft. Resubmission has its own immutable receipt keyed by actor and `Idempotency-Key`, with a canonical fingerprint and replay behavior.
6. Resubmission lock order is user, tenant, store submission, draft, current publication request, reservation, subscription, plan, then hostname advisory lock. The corrected payload and a positive store-submission revision are committed before a later approval can queue provisioning.
7. Resubmission preserves history. The rejected publication request and released reservation are never rewritten. A current, temporally valid subscription for the same plan is reused; an elapsed active record is marked expired; a changed, cancelled or expired plan creates a new subscription and leaves the previous record historical.
8. Add `tenant.publication.manage` only to the system merchant-owner role. Merchant publish/unpublish uses dedicated policy abilities and entry points; platform publish/unpublish remains separate. Both call one internal transition core with server-selected audit actions.
9. Merchant publication locks and revalidates the active user, then locks the tenant and exact active merchant-owner membership before publication dependencies. Same-state replay is a no-op after authorization and creates no duplicate audit entry.
10. Merchant projections expose state-specific `draftEdit`, `resubmit`, `publish` and `unpublish` capabilities. Presentation never infers an allowed mutation from status or a broad permission.
11. Audit records actors, tenant, draft/submission revisions, changed field names, handle, plan and lifecycle states. Workspace config, payment data and internal diagnostics are never copied into audit values.
12. Browser storage becomes optional explicit recovery material only. Authenticated draft save and cross-device restoration use the central draft API.

## Consequences

- The existing tenant and provisioning pipelines remain intact; WP 5.5 adds an editable command layer before them.
- Rejected stores can be corrected without creating a second tenant or losing review, reservation or subscription history.
- Merchant publication no longer creates a platform-operator bottleneck after all server readiness checks pass.
- Central draft data adds a migration and a rollback refusal once durable draft or resubmission records exist.

## Alternatives rejected

### Keep drafts in localStorage

Rejected because drafts would remain device-local, could be lost before submission and could not support a truthful correction workflow.

### Create a new tenant for every resubmission

Rejected because it duplicates identity, quota, domain, subscription and audit history and creates orphaned tenant resources.

### Reuse the platform publish policy for merchants

Rejected because it would mix two authorization boundaries and make audit attribution ambiguous.

## Rollback

Code can be reverted while preserving the new tables. The database migration refuses rollback once any draft or resubmission record exists. An empty installation may roll back and reapply the migration. No rollback drops tenant schemas, reservations, subscriptions or publication history.
