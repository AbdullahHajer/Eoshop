# WP 5.15 — Storefront section layout and truthful template composition

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.15 |
| Status | Implementation complete; delivery pending |
| Started | 2026-08-24 |
| Branch | `codex/wp-5.15-storefront-sections` |
| Base | Protected `main` at `45cc3e70` |
| Dependencies | WP 3.2–3.3; WP 5.6–5.9; WP 5.14 |
| Decision | [ADR 0027](../decisions/ADR-0027-server-owned-storefront-section-layout.md) |

## Objective

Extend the existing-store profile and appearance task with a safe, server-owned home-section layout so merchants can arrange and show the important storefront blocks without restoring the prototype's monolithic browser-only builder or weakening workspace authority.

## Scope

- Add one exact `homeSections` contract to the revisioned workspace configuration.
- Normalize only absent legacy values and reject present malformed layouts.
- Strip layout from all central draft/submission sources and inject the exact default during provisioning.
- Add accessible move/show controls to the focused store profile editor.
- Render both first-party themes from the same semantic section order and visibility.
- Remove unsupported fixed commercial claims from every customer-visible storefront surface.
- Preserve exact authenticated preview/public-host parity and existing workspace conflict recovery.

## Out of scope

- Pre-submission section editing or sample products becoming durable.
- Arbitrary sections, custom HTML/CSS/JavaScript, a page-builder canvas or a template marketplace.
- Editing product, inventory, checkout or About/contact content from the layout section.
- New database tables, write endpoints, permissions, publication states or asset types.

## T0–T5

### T0 — Contract and baseline

- [x] Confirm the existing focused appearance editor and revisioned workspace authority.
- [x] Record ADR 0027 section catalog, validation, rendering and rollback decisions.
- [x] Complete independent design review and resolve blockers.

### T1 — Server and typed contract

- [x] Add shared default/normalization logic and exact workspace validation.
- [x] Project the same normalized layout to merchant and public compositions.
- [x] Preserve onboarding's appearance-only boundary and provisioning defaults.

### T2 — Focused layout experience

- [x] Add order/visibility controls to the existing profile editor.
- [x] Apply exact order/visibility in both themes and desktop/mobile preview.
- [x] Remove unsupported fixed commercial claims from every customer-visible storefront surface.

### T3 — Verification

- [x] Cover legacy absence, exact valid save and malformed/duplicate/missing/empty rejection.
- [x] Cover central draft/correction and queued-submission default injection without layout authority.
- [x] Cover accessible reorder/show actions, theme switching and dirty/save/reload/409 behavior.
- [x] Cover authenticated preview/public-host order parity, truthful empty states and every allowed trust fact.
- [x] Scan both themes across header, home, products, About and product-detail surfaces for unsupported fixed claims.
- [x] Cover workspaceManage's two-permission matrix, 401/403 dirty retention and stale tenant/account responses.
- [x] Preserve product, inventory, checkout, order, onboarding and publication characterization.

### T4 — Gates

- [x] Pass focused frontend and PostgreSQL tests.
- [x] Pass frontend/backend quality, repository safety and isolated container integration.
- [x] Update the retained Pilot without deleting merchant data and hand off manual visual acceptance to the product owner.

### T5 — Evidence and delivery

- [ ] Record immutable evidence and retained debt.
- [ ] Obtain final independent read-only approval.
- [ ] Commit implementation and evidence separately.
- [ ] Push, open PR, pass required CI and merge.

## Acceptance criteria

- An authorized merchant can reorder and show/hide the five supported home sections from the existing design task.
- Reload and the exact public host render the same server-confirmed order and visibility.
- A stale workspace produces the existing explicit 409 recovery instead of silently overwriting layout.
- Unknown, duplicate, missing, malformed or all-hidden layouts fail without mutation.
- Onboarding cannot submit layout overrides and never persists preview sample products.
- Both themes preserve the selected layout and all customer-visible storefront surfaces contain no unsupported warranty, shipping, payment, rating, popularity or customer-count claims.
- Product publication, inventory, checkout policy, orders and About/contact content remain controlled by their existing modules.

## Rollback

Drain writes, deploy the old web client while the compatible new backend accepts omission only for a locked legacy record that itself lacks the layout and rejects omission against a layout-bearing record, then deploy the prior backend. Accept deterministic default layout restoration on the next old-client save. No database rollback or destructive data operation is required; products, assets, inventory and orders remain intact.
