# ADR 0031 — Publication continuity boundary

## Status

Accepted on 2026-08-25 for WP 5.19.

## Context

The onboarding builder and an existing store workspace currently share the same completion callback. In an existing store this can open the domain-and-plan submission modal even though the tenant, domain reservation and subscription request already exist.

Provisioning is asynchronous. The server and worker can complete an approved tenant while the merchant and platform store lists still display the snapshot loaded immediately after approval. Manual refresh corrects the data, but the visible journey appears stalled.

## Decision

1. Builder completion has two explicit intents:
   - a new or correction draft continues to the domain, plan and submission flow;
   - an existing active workspace saves its current server revision and returns to the merchant portal.
2. Existing-store completion must never open the new-store submission modal.
3. Navigation occurs only after the server save succeeds. A conflict or failed save keeps the merchant in the editor.
4. Merchant and platform store lists poll only while a visible store is in a server-owned transitional lifecycle state.
5. Polling is sequential, bounded, cancelled on route change/unmount and stops as soon as the server reports a terminal state.
6. The UI never infers readiness. Publication actions and the public URL continue to come only from server capabilities, blockers and the published domain.

## Consequences

- Duplicate submission intent is removed from existing-store editing.
- Approval and provisioning progress becomes visible without logout or manual page reload.
- A slow or failed worker does not generate endless requests; the existing manual refresh and retry paths remain available.
- No backend lifecycle, tenant database or publication rule changes are required.

## Rollback

Restore the previous frontend image. No persisted data rollback is required.
