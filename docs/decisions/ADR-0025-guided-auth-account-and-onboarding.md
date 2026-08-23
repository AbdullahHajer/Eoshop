# ADR 0025 — Route-owned authentication, account profile and guided merchant onboarding

## Status

Accepted for WP 5.13 implementation.

## Context

The server already owns identity, sessions, one recoverable unbound store draft, store submission, review, provisioning and publication. The visible entry journey still divides those truths across an authentication modal, a local-only business-information modal, template state coordinated by `App.tsx`, and a later submission modal. A signed-in user also has no durable account page for reviewing or changing the safe fields of their identity.

WP 5.13 must improve that journey without introducing another identity store, another draft writer, browser-owned lifecycle state or a shortcut around the existing submission/provisioning/publication boundaries.

## Decision

### 1. Route ownership

- Central SPA routes `/login`, `/register`, `/forgot-password`, `/reset-password` and `/app/account` are first-class reload-safe routes.
- `/app/new`, `/app/new/design` and `/app/new/review` are the only new-store onboarding routes. They compose the existing server draft and submission APIs; they never manufacture a tenant or public URL in the browser.
- A signed-in active identity visiting `/login` or `/register` is redirected to a validated same-origin destination or `/app`. A guest visiting `/app/**` is redirected to `/login` with the single optional `returnTo` query parameter.
- `returnTo` is a query-free application path with one value and at most 256 decoded characters. It is decoded exactly once by the query parser; a remaining percent escape, encoded or literal slash/backslash bypass, fragment, nested query, scheme, protocol-relative path or host is rejected before canonical comparison.
- The literal allowlist is `/app`, `/app/account`, `/app/new`, `/app/new/design`, `/app/new/review`, the five known `/admin` routes, and `/app/stores/{lowercase-ulid}` with only the known store sections or `/correction`. `/login`, `/register`, `/forgot-password` and `/reset-password` are never return targets, and reset-token query data is never copied forward.
- After authentication the destination is authorized again: an unavailable merchant/store route falls back to `/app`; an admin destination requires the exact section permission and otherwise falls back to the first permitted admin section or `/app`. A parsed path is navigation intent, never proof of authorization.

### 2. Identity and account profile

- `users` remains the sole identity authority. WP 5.13 adds a positive `profile_revision` for optimistic profile updates.
- `GET /api/auth/session` remains the account read model. It adds `profileRevision` and safe account timestamps; it never exposes password, remember token, session generation, membership rows or reset state.
- `PUT /api/account/profile` accepts `expectedRevision`, name and optional phone. Email is read-only until a separately designed verified-email-change lifecycle exists.
- Profile updates lock the active, non-deleted identity on the central connection, compare the revision, normalize bounded fields, increment the revision only on a material change and write a redacted audit event in the same transaction. An exact no-op returns the current projection without audit or revision change.
- Phone normalization accepts a bounded Yemen-friendly local or international digit form, removes presentation separators and rejects extensions, control characters and ambiguous free text. It does not claim phone verification.
- `PUT /api/account/password` requires the current password, a policy-compliant new password and confirmation. Under the same identity-lifecycle advisory lock used by reset-link issuance, the service locks and revalidates the active identity, verifies the current password, changes the hash, increments `session_generation`, rotates `remember_token`, deletes every reset token for the identity email, deletes all other database sessions and writes an audit event atomically.
- The controller regenerates and rebinds the surviving current session to the new password hash and generation after commit. A failure cannot restore another session; at worst the caller must sign in with the new password.
- Passwords, hashes, reset tokens and raw session identifiers never enter API output, logs or audit values.
- Password change, reset-link issuance and token redemption serialize on the shared lifecycle lock. A link issued before a successful password change is unusable; link-vs-change and reset-vs-change races have one ordered winner and cannot restore an older credential.

### 3. Server-owned onboarding progress

- `store_drafts` gains `onboarding_stage` and a hidden `onboarding_stage_baseline`, each with the ordered values `business`, `design`, `review`; the baseline records the migration/create-time value for conservative rollback.
- The stage means the furthest server-validated step completed, not the currently visible browser page. Going back to edit an earlier step does not reduce it.
- Existing unbound drafts are adopted as `design` unless both a valid active plan key and syntactically valid handle are already stored, in which case they are `review`. Linked/correction/submitted drafts are adopted as `review`. The adopted value is copied to `onboarding_stage_baseline` and is never changed by application code.
- The existing one-unbound-draft-per-user invariant remains the only source of new-store draft identity.
- The unbound full-aggregate writer is replaced by three central, revisioned writers. `PUT /api/merchant/store-draft/business` accepts only `expectedRevision`, `storeName` and `businessType`; on first creation it adds a product-free, contact-free server baseline configuration and never accepts owner, theme, handle or plan authority from this payload. `PUT /api/merchant/store-draft/design` accepts only `expectedRevision`, `themeStyle` and `config`, preserves business/handle/plan fields, and forcibly synchronizes `config.storeName` and `config.themeStyle` from the locked draft/accepted theme before structural validation. `PUT /api/merchant/store-draft/review` accepts only `expectedRevision`, `handle` and `planKey`, preserves business/design fields, locks the active plan and validates the complete workspace against its product quota.
- Extra payload keys fail with `422`; correction keeps its existing linked aggregate endpoint and cannot call the unbound onboarding writers. Exact field-and-stage no-ops return the current projection without audit or revision change. A field change or monotonic stage advance increments the revision once and records only changed safe field names, never full config.
- A step may advance only when all prerequisites pass under the locked current revision. The fixed lock order is active user → unbound draft → plan → advisory domain namespace check. A stale revision returns `409` with `draft_revision_conflict` and the authoritative projection; invalid draft state returns `409` with `draft_state_conflict`; unknown/out-of-order stage or incomplete prerequisite returns `422` with a stable machine code; a currently unavailable handle returns `409` with `domain_unavailable`.
- `onboarding_stage` is progress history, not permanent readiness. Every draft response includes derived `onboardingReadiness` and `nextRequiredStep`. Readiness revalidates current business fields, config structure, active plan/quota and current handle availability without claiming a reservation. Editing an earlier step preserves the furthest stage but may make `review` readiness false until the dependent checks pass again.
- Submission still uses the existing durable idempotency receipt, locks and final full validation. `review` is not approval, provisioning, subscription activation or publication.
- Correction/resubmission keeps its existing linked-draft contract and does not re-enter new-store onboarding.

### 4. Frontend state and recovery

- Authentication forms are page-owned, accessible forms with explicit loading, validation, generic credential/reset messaging and no credential persistence.
- The account page shows safe identity data, separates profile and password mutations, preserves a dirty profile on recoverable failure and reloads on revision conflict before any manual reapply.
- The onboarding shell displays a fixed progress model: business details → design → address/plan review → submit. Every Next action first persists the current server step; navigation alone never claims completion.
- Reload resumes from the furthest server stage. Direct access to a later step is redirected to the first unmet prerequisite. A server/network error is not interpreted as “no draft”.
- All draft/account requests use abort or generation guards. Logout, account switch, store switch and route exit invalidate stale responses and protect dirty state.
- Ambiguous submit/resubmit recovery preserves the existing idempotency key and replays the lifecycle request before attempting another draft write.
- Local storage may hold only an idempotency key plus version, authenticated owner ID, draft ID and a Web Crypto SHA-256 digest of the canonical request. It must never hold the canonical request, config, contact data or another store payload. The record is scoped to owner+draft, constant-time compared where practical, and cleared/invalidated on logout or account switch. It is not an identity, profile, onboarding-stage or store-data authority.
- Passive session expiry preserves that bounded recovery record so the same authenticated owner can resume an ambiguous submission after signing in again. It is cleared only after authoritative recovery, explicit successful logout or a confirmed identity switch.

### 5. Security and operational boundaries

- All account and merchant mutations require the central domain, database-backed authenticated active session, CSRF and bounded throttles.
- Authorization is revalidated under the same central row locks used by the mutation. Hidden controls are never the authorization boundary.
- Account and draft audit records contain actor, subject, changed safe field names, request ID, bounded IP/User-Agent attribution and time; they exclude full store config and secrets.
- Database constraints cover positive profile revisions, known onboarding stages, `baseline <= current`, `review` requiring handle+plan, and every linked/submitted/correction draft requiring `review`. The migration also normalizes the bounded repeatedly encoded legacy `plans.features` shape to a JSON `list<string>` and aborts on an unsupported payload instead of publishing a malformed plan contract. Rollback refuses if any `profile_revision > 1` or `onboarding_stage <> onboarding_stage_baseline`; this intentionally conservative rule distinguishes adopted baseline from post-migration progress and runs only under the documented drain-and-downgrade procedure.

## Out of scope

- Verified email change, phone OTP, avatar upload, account deletion, MFA, SSO, passkeys or device/session administration.
- Merchant team invitations, ownership transfer, billing history, plan self-service or analytics.
- Redesigning product, inventory, order, checkout or public storefront business rules.
- External SMTP delivery, payments, DNS/TLS, social publishing or advertising linkage.
- Replacing the existing aggregate store workspace writer in this package.

## Consequences

- The user gets a coherent entry and account experience while the current server authorities remain intact.
- One small central migration and focused account/onboarding services are required.
- `App.tsx` loses authentication/onboarding modal orchestration incrementally, but full router-library adoption and complete coordinator decomposition remain later performance work.
