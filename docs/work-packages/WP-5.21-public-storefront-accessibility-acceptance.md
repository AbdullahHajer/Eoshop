# WP 5.21 — Public storefront accessibility acceptance

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.21 |
| Status | Ready for protected-branch delivery |
| Started | 2026-08-26 |
| Branch | `codex/wp-5.21-public-storefront-accessibility` |
| Base | Protected `main` at `b2bcd64e0268ba604de175c79458f948cfbea8bc` |
| Dependencies | WP 5.20 |
| Decision | [ADR 0033](../decisions/ADR-0033-public-storefront-accessibility-boundary.md) |

## Objective

Make the server-confirmed public storefront purchase journey usable and understandable at narrow widths and from the keyboard without changing backend authority or redesigning the product.

## Scope

- Explicit public loading, ready and safe retryable error states.
- Skip-to-content, main landmark, semantic navigation and named product/cart actions.
- Modal cart focus management and checkout focus/error continuity.
- Payment-choice semantics, form metadata and server-failure data preservation.
- Reduced-motion support, readable merchant-color foregrounds and 320–390 px layout hardening.
- Automated regression coverage plus a retained Pilot browser matrix.

## Exclusions

- Visual redesign or restoration of additional appearance controls.
- New merchant/platform management tabs.
- Backend checkout abuse controls, payment verification or notifications; these follow in WP 5.22.
- API, authorization, tenant, database, migration or persisted storefront-contract changes.
- Bundle splitting; the existing size warning remains performance debt.

## T0–T5

### T0 — Scope and baseline

- [x] Confirm the storefront already uses the server-owned configuration, catalog and order receipt.
- [x] Record keyboard, error-state, contrast and narrow-screen gaps without changing backend contracts.

### T1 — Design

- [x] Record the accessibility boundary in ADR 0033.
- [x] Keep browser/device rendering claims separate from automated structural verification.

### T2 — Implementation

- [x] Remove blank terminal rendering and add skip/main/error focus behavior.
- [x] Implement cart-dialog focus containment, dismissal and checkout handoff.
- [x] Add semantic navigation, product, payment and form behavior.
- [x] Add reduced-motion, safe-area, narrow-grid and readable-foreground behavior.

### T3 — Verification

- [x] Add focused accessibility regressions and foreground unit tests.
- [x] Pass TypeScript and the production build; pass all 56 frontend files / 313 tests in the final Docker verification run.
- [x] Pass repository, backend and container gates before delivery.

### T4 — Pilot

- [x] Deploy the web-only Pilot image without replacing PostgreSQL/backend/worker/scheduler.
- [x] Complete the retained 320/360/390/768/1024/1440 CSS-pixel reflow, keyboard and Chromium-family matrix.

### T5 — Delivery

- [x] Obtain final independent read-only re-approval after the Pilot-only UUID and 768 px corrections.
- [ ] Record final evidence and rollback.
- [ ] Commit, push, pass required CI and merge through protected `main`.

## Acceptance criteria

- Public loading cannot end in a blank page; retry remains available and safely announced.
- A keyboard user can skip to content, navigate the store, open/close the cart and continue to checkout without losing focus.
- Cart focus cannot escape while open and returns to its trigger only for dismissal.
- Checkout identifies fields and payment choices, focuses the first validation failure and preserves data after retryable server failure.
- Merchant colors keep readable foreground text without modifying saved settings.
- Product grids, dock and controls remain reachable at 320–390 CSS pixels and respect safe-area insets.
- Reduced-motion preference disables non-essential continuous motion.
- Local HTTP tenant hosts use a secure UUID source and a non-sensitive portable retry fingerprint without requiring secure-context-only Web Crypto APIs.

## Rollback

Deploy the previous web image. This work package has no database or persisted-contract rollback.

## Evidence

See [WP 5.21 verification evidence](../evidence/WP-5.21/verification.md).
