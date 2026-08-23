# WP 5.14 — Visual onboarding, template preview and reliable submission handoff

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.14 |
| Status | Complete and merged |
| Started | 2026-08-23 |
| Branch | `codex/wp-5.14-visual-onboarding` |
| Base | Protected `main` at `4b267de3` |
| Dependencies | WP 2.2–2.3; WP 3.1–3.3; WP 5.4–5.9; WP 5.13 |
| Decision | [ADR 0026](../decisions/ADR-0026-visual-store-onboarding-and-preview.md) |

## Objective

Turn the secure three-stage onboarding foundation into a merchant-friendly visual journey with discoverable entry, truthful template previews, bounded pre-submission customization, a complete review summary and a reliable successful-submission handoff.

## Scope

- Fix the incomplete immediate submission projection and defer browser-recovery cleanup until successful mapping.
- Add a persistent create-store navigation action to the merchant portal.
- Present first-party template thumbnails and an exact selected-template storefront preview.
- Add safe visual customization before submission and persist it through the revisioned design writer.
- Enforce the appearance-only contract on the server and keep all sample products preview-only.
- Show the exact storefront preview and business/design/plan/domain summary before submission.
- Preserve server stage prerequisites, optimistic revision, idempotency, domain collision and publication boundaries.

## Out of scope

- New database-backed template marketplace or arbitrary merchant-authored HTML/CSS.
- Product creation, managed media upload, payments, shipping integrations or live order creation before provisioning.
- Automatic approval, public URL claims, DNS/TLS or social publishing.

## T0–T5

### T0 — Contract and diagnosis

- [x] Reproduce the successful-submit/client-contract mismatch from code and the observed Pilot state.
- [x] Record ADR 0026 and the exact preview/customization authority.
- [x] Complete independent design review and resolve blockers.

### T1 — Reliable handoff

- [x] Return the complete submission resource projection after create/replay.
- [x] Clear ambiguous recovery metadata only after mapping the authoritative response.
- [x] Add backend and frontend regression tests for the exact mismatch.

### T2 — Visual design journey

- [x] Add bounded template metadata and thumbnails.
- [x] Add safe visual controls with desktop/mobile preview using the storefront renderer.
- [x] Persist the customized design before advancing.

### T3 — Review and entry experience

- [x] Add a complete visual/business/domain/plan summary before submit.
- [x] Add persistent portal navigation entry and truthful post-submit routing.
- [x] Cover reload, direct-route, conflict, unavailable-domain and preview-only behavior.

### T4 — Gates

- [x] Pass focused frontend and PostgreSQL tests.
- [x] Pass full frontend/backend/repository/container gates.
- [x] Update the retained Pilot without resetting data and pass live root/session/service health checks.

### T5 — Evidence and delivery

- [x] Record immutable evidence and retained debt.
- [x] Obtain final independent read-only approval.
- [x] Commit implementation and evidence separately.
- [x] Push, open PR, pass required CI and merge.
- [x] Record PR, final head, merge commit and protected-main CI before marking complete.

## Acceptance criteria

- A successful first submission cannot be displayed as a response-contract error.
- A malformed successful response retains recovery metadata and can be recovered safely.
- A merchant can enter onboarding from the merchant portal without knowing a URL.
- Template choices have meaningful visual thumbnails and the selected template renders as a storefront preview.
- The merchant can customize safe identity and hero fields before submit and those changes survive reload.
- The final step shows the selected design, business information, plan and requested domain before the submit action.
- Preview interactions never create a live order or imply that the store is approved or published.
- Products, inventory, currency, contacts, checkout and payment settings are rejected by the design endpoint and remain unchanged in the server draft.
- Switching templates resets preview cart/category state, and neither template can persist its sample products.
