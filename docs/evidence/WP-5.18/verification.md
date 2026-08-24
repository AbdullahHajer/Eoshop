# WP 5.18 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.18 — Authenticated shell acceptance hardening |
| Status | Verified; delivery pending |
| Verified | 2026-08-24 |
| Branch | codex/wp-5.18-acceptance-hardening |
| Base | 8e0531cc254d0728da3123926230f3664567a309 |
| Decision | [ADR 0030](../../decisions/ADR-0030-accessible-responsive-shell-boundaries.md) |

## Delivered boundary

- Added one shared, first-focusable skip link for the merchant portal, merchant store operations and platform administration shells.
- Added stable focusable main landmarks and a global offset :focus-visible treatment that does not change layout.
- Projected merchant navigation as compact horizontal controls below the desktop breakpoint while preserving desktop side navigation.
- Exposed the active store module and active platform section through aria-current=page.
- Kept platform website and logout actions available on narrow screens through the same guarded callbacks used by the desktop shell.
- Kept existing permission, disabled-capability, dirty-settings and logoutPending behavior unchanged.
- No backend, API, database, authentication, authorization, provisioning, tenant, catalog, inventory or order contract changed.

## Final verification

### Frontend and repository

- Focused TypeScript and shell regression gate: 3 files / 31 tests passed.
- Pinned Node 22.23.1 frontend-quality image: PASS.
- TypeScript --noEmit: PASS.
- Production Vite build: PASS; 2,142 modules transformed.
- Complete Vitest gate: 47 files / 267 tests passed.
- Production assets: index-BahA7rZ9.js at 848.74 kB / 227.61 kB gzip and index-oVrU5nZ1.css at 108.73 kB / 15.93 kB gzip.
- git diff --check: PASS.
- Immutable quality image: sha256:0e299ca8a385d9e3bed7ba35d5ff92097631e8ee83bd927634ed89c9b5188961.
- Immutable web image: sha256:bd44bd9b5d5f3840644d6407702cc87fea2edf3fbeeca6faa26d8fa7252219b0.

### Backend and dependency safety

- composer validate --strict --no-check-publish: PASS.
- composer audit --locked: PASS; no security vulnerability advisories.
- Pint: PASS across 274 files.
- Larastan: PASS across 237 files with no errors.
- PHPUnit unit gate: 3 tests / 6 assertions passed.

### Isolated container integration

- The gate used an isolated central database and test-only application storage.
- Central database integration: 161 tests / 1,735 assertions passed.
- Migration adoption and rollback safety, live HTTP, authentication, authorization, tenant isolation, provisioning worker, scheduler, workspace, assets, catalog, inventory and order boundaries: PASS.
- Final result: Container integration gate passed.
- The isolated containers, network and test-only volumes were removed by the gate; retained Pilot resources were not part of the integration project.

## Independent review

- Final verdict: **APPROVED**, with no P0, P1 or P2 finding.
- The reviewer confirmed the skip-link targets, focus order, responsive navigation, active-route semantics and mobile platform actions.
- The reviewer also confirmed that permission gates, disabled capabilities, dirty-settings protection and logout protection retain their previous callback boundaries.
- The reviewer made no code or documentation changes.

## Retained Pilot

- Replaced only eoshop-pilot-web-1, from eoshop/web:wp517-pilot to eoshop/web:wp518-pilot.
- Backend, worker, scheduler and PostgreSQL containers were not recreated.
- Post-update state: web container running and healthy; http://127.0.0.1:8010/ returned HTTP 200.
- Served WP 5.18 assets: index-BahA7rZ9.js and index-oVrU5nZ1.css.
- Pilot is ready for human narrow-screen and keyboard visual acceptance on the authenticated merchant and platform routes.
- Rollback is web-only by restoring eoshop/web:wp517-pilot; no data rollback is required.

## Retained debt

- The main JavaScript bundle remains 848.74 kB minified / 227.61 kB gzip and triggers the existing Vite chunk-size warning. Route/component splitting remains a later performance work package.
- Automated structural tests do not claim complete WCAG conformance or full browser/device certification.
- Public storefront narrow-screen, keyboard and cross-browser acceptance remains the next bounded work package.
- Richer appearance options remain deferred to bounded server-owned contracts rather than restoring the prototype builder as a second source of truth.

## Delivery

- T0 documentation commit: 2e12678.
- Implementation commit: d142e22.
- Evidence commit: pending.
- Pull request, required CI, merge commit and protected-main CI: pending.
