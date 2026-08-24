# ADR 0028 — Authoritative onboarding draft continuity and explicit submission

- Status: Accepted
- Date: 2026-08-24
- Work package: WP 5.16

## Context

WP 5.13–5.14 established a revisioned three-stage onboarding flow and a reliable idempotent submission boundary. A Pilot journey showed that a merchant could save business and design data, reach the review screen, leave without a domain or final submission, and then see neither a store in the platform review queue nor any continuation state in the merchant portal. The database was correct—the record remained an unbound `draft`—but the product experience incorrectly implied that the journey had disappeared. The review action was also disabled from an eventually consistent availability value, so a missing or changing handle could fail without a clear action-level explanation.

## Decision

### Authority and lifecycle

- The existing central `store_drafts` record remains the only authority for an unfinished new-store journey. It is not a store submission, tenant, domain reservation or platform review item.
- `/api/merchant/stores` continues to return submitted stores only. `/api/merchant/store-draft` remains the separate owner-scoped projection for the one current unbound draft.
- The merchant portal loads both projections. A draft is rendered as a distinct “not submitted” continuation card and never counted or labelled as a pending store.
- Platform administration continues to exclude unsubmitted drafts. A store appears in the review queue only after the authoritative idempotent submission succeeds.

### Resume behavior

- The server-owned `nextRequiredStep` decides where a generic create/continue entry resumes. `submit` resumes at review; a caller cannot skip a missing server prerequisite by entering a later URL.
- An explicit in-flow back action remains available. Reloading the generic `/app/new` entry advances to the latest server-required step instead of rewriting completed business data.
- Every create-store action in the merchant portal becomes a continuation action while a current draft exists. The empty-account state is hidden when a draft exists or when draft recovery is uncertain.

### Independent recovery

- Submitted-store recovery and unfinished-draft recovery are independent reads. A non-authentication failure of the draft read must not hide or disable already submitted stores.
- A failed draft read is shown as an explicit recoverable warning. The portal does not claim that no draft exists and offers a retry/route that lets onboarding recover the server state directly.
- An authentication failure from either merchant projection remains fail-closed and clears tenant-owned client state through the existing session-expiry boundary.

### Review gate and availability concurrency

- The final action is not silently disabled for missing business input. Pressing it surfaces the first exact blocker and the review screen continuously lists all current blockers.
- Client readiness is explanatory only. The existing review writer and submission service remain authoritative for plan activity, handle normalization/availability, workspace quota, revision and lifecycle state.
- Every availability request is bound to the normalized handle and a monotonically increasing request generation. Changing the handle immediately invalidates the previous result; an aborted, late or mismatched response cannot authorize the new value.
- Availability transport failure is distinct from “unavailable” and is communicated without attempting submission.
- The established order remains: save review against the expected draft revision, then submit with the stable idempotency key. Navigation to the store overview occurs only after a complete authoritative submission resource maps successfully.

### Exit behavior

- The onboarding header names its action as leaving for the merchant portal, not as submitting or completing the store.
- If the current step has unsaved data, leaving requires an explicit confirmation and preserves the last server-saved revision only.
- A saved incomplete journey remains visible in the portal with its next step, progress and last-save date.

### Data, authorization and deployment

- No schema, tenant database, permission, domain or queue change is introduced.
- The current authenticated owner scope on `currentDraft`, revisioned writers and submission service remains unchanged. No cross-owner or cross-tenant draft is added to the store list.
- The new web client is compatible with the existing backend contract. Rollback is a web-only deployment; durable drafts and submitted stores remain unchanged.

## Consequences

- Merchants can distinguish “saved locally on the server” from “submitted for platform review” and can always resume the former.
- Platform review queues stay truthful and operational data remains separated from onboarding state.
- A secondary draft-read outage degrades only draft continuation instead of taking down management of active stores.
- The portal performs one additional bounded authenticated read while restoring merchant state.

## Rejected alternatives

- Include drafts in `/api/merchant/stores`: rejected because it would mix incompatible identities, capabilities and lifecycle states and could expose store actions before a tenant exists.
- Show unsubmitted drafts in platform administration: rejected because it would turn private onboarding activity into an operational review item without an explicit merchant submission.
- Reserve a domain while the merchant types: rejected because availability checking is not a reservation and would create abandoned-domain cleanup and denial-of-service concerns.
- Keep the disabled final button: rejected because it concealed the reason no request reached the server and produced a false completion impression.
