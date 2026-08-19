# WP 5.4 — Merchant portal and store lifecycle

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.4 |
| Status | Complete and merged |
| Started | 2026-08-19 |
| Branch | `codex/wp-5.4-merchant-portal` |
| Base | Protected `main` at `50600c2` |
| Dependencies | WP 1.2–1.3; WP 2.2–2.3; WP 3.1–3.3; WP 4.1–4.3; WP 5.1–5.3 |
| Decision | [ADR 0016](../decisions/ADR-0016-merchant-and-platform-product-shells.md) |

## Objective

Turn the authenticated merchant experience from a collection of modals and a store builder into a durable product portal. A merchant must land in one predictable place, understand every store's lifecycle, see blockers or rejection reasons, obtain the published link and enter the correct management module without learning the backend state machine.

## Scope

- Add a route-owned `/app` merchant shell and deterministic authenticated navigation.
- Add a merchant overview with account context, store counts, lifecycle summaries and an explicit new-store entry.
- Add a store list and selected-store overview with verification, provisioning, subscription and publication stages.
- Expose merchant-safe review feedback, activation, public-domain and per-membership capability fields owned by the server.
- Derive one truthful next action and responsible party from the complete state tuple.
- Expose copy/open published-link actions only when the server reports a published domain.
- Route approved, provisioned stores into the existing design, product, inventory and order modules without duplicating business logic.
- Preserve current builder/storefront behavior behind compatibility navigation while it is moved into the shell.
- Correct the documentation control index and record the current roadmap state.
- Add focused API mapping, lifecycle-state and route-shell characterization tests.

## Out of scope

- Server-owned pre-submission drafts and correction/resubmission; WP 5.5.
- Merchant publication/unpublication ability; WP 5.5 after a dedicated policy and concurrency contract.
- Full account-profile editing, team invitations, billing history and analytics.
- Full platform administration console; a later platform-shell work package.
- Visual redesign of the public storefront or complete builder decomposition.
- External email, payments, DNS/TLS, WhatsApp or social publishing.

## Product invariants

- Login/session restoration never leaves an authenticated merchant on an unexplained landing state.
- The browser never invents lifecycle success or infers a public URL from a non-published reservation.
- Rejection, provisioning failure and publication blockers are visible and safe; internal stack/SQL details are not.
- Store actions are capability and state driven. Hidden buttons are not an authorization boundary.
- The full workspace editor requires the server-projected `workspaceManage` capability; narrower staff capabilities are displayed without widening access.
- Review feedback is explicitly merchant-facing and appears only for a rejected store; internal operational reasons never share that projection.
- "Ready to publish" requires a materialized current workspace, not provisioning state alone.
- Pending, rejected, suspended and failed stores remain visible in the merchant portal even when they have no tenant workspace.
- Switching stores cannot discard dirty workspace state without an explicit decision.
- The current server-owned workspace remains authoritative; browser drafts stay explicitly local.

## T0–T5

### T0 — Product contract and baseline

- [x] Audit the complete merchant and platform journeys against the real API and interface.
- [x] Accept the five product decisions in ADR 0016.
- [x] Separate WP 5.4 portal visibility from WP 5.5 draft/publication mutations.
- [x] Complete independent design review and resolve blocking findings.

### T1 — Merchant lifecycle contract

- [x] Add safe public-domain, review-feedback, capability and lifecycle timestamps to the merchant store projection.
- [x] Add a typed lifecycle view model with explicit stage, severity, next action and responsible party.
- [x] Prove malformed/unknown states fail closed in the frontend mapper.

### T2 — Merchant portal shell

- [x] Add durable `/app`, `/app/new` and store-design navigation with deterministic login/session routing.
- [x] Add account/store overview, lifecycle cards, state timeline and published-link actions.
- [x] Keep pending/rejected/failed stores accessible without opening the tenant editor.
- [x] Route ready stores to the current builder modules without bypassing capability checks.

### T3 — Characterization and accessibility

- [x] Cover empty, pending, rejected, provisioning, failed, ready, blocked and published states.
- [x] Cover login redirect, reload restoration, store selection and dirty-workspace navigation guards.
- [x] Provide keyboard-accessible navigation, status semantics and responsive behavior.

### T4 — Operational gates

- [x] Pass frontend lint/tests/build/audit, backend quality, PostgreSQL integration and repository safety.
- [x] Pass container migration/route-cache/live-host gates without changing server authority.
- [x] Confirm human Pilot acceptance remains paused while automated gates remain required.

### T5 — Evidence and delivery

- [x] Record exact verification evidence and remaining WP 5.5 handoff items.
- [x] Obtain independent read-only approval with no blocking findings.
- [x] Commit implementation and evidence separately, push, open PR, pass required CI and merge.

## Risks and controls

- **Portal becomes another presentation wrapper:** route every card to one real action and remove generic success claims.
- **Frontend reconstructs server policy:** the server returns authoritative state fields; the view model only explains them and never authorizes mutations.
- **Large `App.tsx` change:** extract the merchant shell behind typed props and migrate one navigation boundary at a time.
- **Pending stores disappear because no schema exists:** portal reads central store projections and never requires tenant initialization for lifecycle visibility.
- **Published URL ambiguity:** expose the exact published domain; requested/internal domains are labeled separately and are never presented as live.
- **QA pause weakens rigor:** only human acceptance pauses; unit, contract, PostgreSQL, container and protected-CI gates remain mandatory.

## Acceptance criteria

- An authenticated merchant who opens or reloads the central application reaches `/app` and sees their stores or a clear empty state.
- Every store is visible regardless of verification/provisioning/publication state.
- A rejected store shows the safe reason and a WP 5.5 correction notice, not a generic design-ready status.
- A provisioning failure shows a safe action-owner message without exposing internal diagnostics.
- A published store exposes one exact copy/open URL; non-published stores expose none.
- An approved/active store can enter the existing full builder only when its membership has the combined workspace capability; narrower staff capabilities remain visible without escalation.
- No lifecycle mutation or permission moves into presentation components.
- Current storefront, builder, conflict, inventory and order behavior remains green.

## Rollback

The merchant portal, route helper and additional response fields can be reverted without database migration. Existing endpoints and builder behavior remain compatible. No server state is deleted or transformed in WP 5.4.
