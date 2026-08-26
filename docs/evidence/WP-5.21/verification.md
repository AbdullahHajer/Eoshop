# WP 5.21 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.21 — Public storefront accessibility acceptance |
| Status | Ready for protected-branch delivery |
| Verified | 2026-08-26 |
| Branch | `codex/wp-5.21-public-storefront-accessibility` |
| Base | `b2bcd64e0268ba604de175c79458f948cfbea8bc` |
| Decision | [ADR 0033](../../decisions/ADR-0033-public-storefront-accessibility-boundary.md) |

## Delivered boundary

- Public bootstrap has explicit loading, ready, retryable error and safe unexpected-response states; no terminal `null` render remains.
- The public page exposes skip-to-content and a focusable main landmark.
- The cart is an accessible modal dialog with initial focus, focus containment, Escape, body scroll lock and deterministic restoration/handoff; background isolation remains active until the exit transition completes.
- Store navigation, brand, category, product, thumbnail and cart actions have names and selection/current-state semantics.
- Checkout fields expose labels, names, autocomplete and invalid state; payment choices expose radio semantics.
- Validation focuses the first missing field; retryable server failure retains customer input and focuses the alert.
- Continuous motion respects reduced motion, the mobile dock respects safe-area insets and product grids collapse safely at 320 px.
- A shared luminance utility chooses readable foregrounds for merchant/platform colors without changing persisted settings, including the storefront root and the elegant hero's white surface.
- The compact storefront navigation remains active through tablet widths; desktop navigation now starts at 1024 CSS pixels so support/cart actions do not leave the viewport at 768 pixels.
- Request idempotency uses native `crypto.randomUUID()` when available and a secure RFC 4122 v4 fallback built from `crypto.getRandomValues()` on local HTTP tenant hosts; no weak-random fallback was introduced.
- No backend or persisted contract changed.

## Automated regression evidence

- `PublicStorefrontAccessibility.test.tsx`: 10 focused tests for nonblank failure, skip/main focus, modal lifecycle/focus behavior, surface-specific conflicting merchant colors, semantic navigation, repeated checkout validation and server-retry continuity.
- `PublicStorefrontReducedMotion.test.tsx`: 1 isolated media-preference regression proving product layout and cart travel are disabled.
- `readableForeground.test.ts`: 7 tests for dark/light/invalid colors, mid-tone AA guarantees and accessible accent correction.
- `randomUuid.test.ts`: 3 tests for the native path, secure RFC 4122 fallback and fail-closed behavior when no secure random source exists.
- `requestFingerprint.test.ts`: 3 tests for the SHA-256 path, deterministic local-HTTP fallback and a rejecting `SubtleCrypto` implementation. The token compares retry payloads only; the mutation identity remains a secure UUID and the server remains authoritative.
- Existing merchant onboarding, customization, checkout, order orchestration and interface tests remain green after accessible-name changes.

## Local gates

- Host TypeScript `--noEmit`: PASS.
- Locked Linux TypeScript and production Vite build in Docker: PASS; 2,149 modules transformed.
- Locked Linux Vitest: PASS; 56 files / 313 tests passed in 190.84 seconds with two workers on the contended final run.
- Focused retry-fingerprint/UUID/API/accessibility coverage: PASS; 52 regressions across fingerprint, UUID, API client, accessibility, reduced-motion and contrast suites also passed within the full run.
- Repository safety gate and final `git diff --check`: PASS.
- Backend quality: PASS; strict Composer validation/audit, Pint on 274 files, Larastan on 237 files and PHPUnit 3 tests / 6 assertions.
- Container integration: PASS; clean migrations, HTTP/auth/tenant/inventory/order/worker/scheduler checks and 161 database tests / 1,735 assertions.
- Known non-blocking debt: the main JavaScript bundle is approximately 865 kB and still emits the existing chunk-size warning.

## Pilot browser acceptance matrix

| Check | Status | Evidence |
|---|---|---|
| Web-only retained Pilot deployment | PASS | `eoshop/web:wp521-pilot-final` serves port 8010; only the web container was replaced. |
| 320 / 360 / 390 / 768 / 1024 / 1440 CSS px | PASS | Every final measured viewport had equal document client/scroll width and no clipped visible interactive control. The initial 768 px run exposed the support/cart breakpoint defect; the corrected run is clean, retains 96 px bottom clearance through 1023 px and places the footer above the 61.8 px dock. At 1024 px the dock is hidden and desktop clearance is 24 px. |
| Keyboard and focus journey | PASS | Skip-to-content targets and focuses `main`; the cart exposes a labelled modal, contains Tab/Shift+Tab, closes with Escape, clears isolation/scroll lock and restores focus to its trigger. Checkout focus/error continuity is covered by the focused browser-like regressions because this retained store has no published product. |
| 200% reflow equivalent and Arabic content | PASS | The matrix reaches 320 CSS pixels, stricter than the 640-CSS-pixel effective viewport of a 1280-pixel browser at 200%; the retained Arabic content wraps without page or control overflow. The in-app browser does not expose a browser-chrome zoom control, so no false native-zoom claim is made. |
| Supported browser smoke | PASS (Chromium family) | The retained Pilot was exercised in the Codex in-app Chromium browser. No separately controllable Edge session was available; an Edge-product-specific claim is deliberately deferred to the later cross-browser review. |

## Independent review and delivery

- Initial read-only review: `REQUEST_CHANGES`; no P0, four P1 findings (exit focus timing, repeated validation focus, reduced-motion coverage and contrast guarantee) plus two P2 findings (modal background isolation and roving radio keyboard behavior).
- All findings have code and regression-test fixes in the working tree.
- The reviewer approved the accessibility fixes with no P0/P1/P2 finding before the local-HTTP UUID and 768 px Pilot corrections.
- The next complete-tree review returned `REQUEST_CHANGES`: P1 because checkout fingerprinting still called secure-context-only `crypto.subtle`, and P2 because bottom clearance still switched at `md` while the fixed dock switched at `lg`.
- Resolution: checkout and provisioning now share a SHA-256-when-available retry fingerprint with a deterministic non-sensitive fallback, and the storefront retains `pb-24` until `lg`. Three fingerprint regressions and a final 768/1024 Pilot measurement pass.
- Final independent verdict: **APPROVED**, with no P0/P1/P2 finding. The reviewer confirmed the portable token never stores the payload, mutation identity remains a secure UUID, the server independently guards payload replay, and the `lg` dock/clearance boundary is consistent.

## Retained Pilot

- Final web image: `eoshop/web:wp521-pilot-final`, manifest list `sha256:0d32e1b381d14c01f8c9a1c81e2dcae947677e6ad2c8852104be49c3484d91e5`.
- Recreated only `eoshop-pilot-web-1` (`148403fbfb5e`); PostgreSQL (`c7b4b6f464a7`), backend (`15683a513754`), worker (`f2fea02847a6`) and scheduler (`1139e8a0ecd2`) identities were retained.
- `http://127.0.0.1:8010/`, `http://noor.lvh.me:8010/` and `http://noor.lvh.me:8010/api/store/config` returned HTTP 200.
- The local HTTP Pilot first exposed a blank/error storefront before any API request because `crypto.randomUUID()` is unavailable outside secure contexts. The secure `getRandomValues()` fallback corrected that environment-specific failure without weakening request identifiers.
- The final review then found the same environment boundary in checkout/provisioning fingerprinting. The portable fallback stores only a compact comparison token, never customer payload data, and its collision cannot authorize or alter a server mutation because the UUID/idempotency contract and server payload validation remain authoritative.

## Rollback

Restore the WP 5.20 web image. No database rollback is required.
