# WP 5.22 — Merchant launch console

| Field | Value |
|---|---|
| Phase | Phase 5 — Launch product completion |
| Work Package | WP 5.22 |
| Status | Implementation and final local gates complete; review and delivery in progress |
| Started | 2026-08-27 |
| Branch | `codex/wp-5.22-merchant-launch-console` |
| Base | Protected `main` at `f0ba6b88` |
| Dependencies | WP 5.20–5.21 |
| Decision | [ADR 0034](../decisions/ADR-0034-canonical-merchant-launch-console.md) |

## Objective

Turn the existing route-owned store operations center into the merchant's truthful daily launch dashboard without creating a third dashboard, duplicating workspace state or weakening tenant and permission boundaries.

## Scope

- Preserve `/app` as the store-selection and store-lifecycle portal.
- Preserve `/app/stores/{tenant}` as the canonical store center.
- Add one strict server dashboard projection for the selected tenant.
- Show actionable daily tasks, completed sales, order/product/stock metrics, recent orders, seven-day sales and top products.
- Link dashboard tasks and tools to the existing products, orders, inventory, design, checkout and pages modules.
- Scope facts and tasks to effective tenant permissions.
- Exclude customer PII from the overview projection.
- Add stale-response, session-expiry, authorization, contract and PostgreSQL regressions.

## Exclusions

- A second or third merchant dashboard.
- Customer directory, staff invitations, advanced reports or marketing automation.
- New order, inventory or workspace writers.
- Platform store-application review and active-store health; these form the next platform work package.
- Business-data schema changes, analytics warehouse, Redis caching or production observability. Additive query indexes are in scope.
- Broad visual-polish work unrelated to the launch journey.

## T0–T5

### T0 — Scope and baseline

- [x] Confirm the authoritative store list and active “My stores” entry already exist.
- [x] Confirm the route-owned operations center and focused modules already exist.
- [x] Reject a parallel-dashboard implementation.

### T1 — Design

- [x] Record the canonical portal/center boundary in ADR 0034.
- [x] Define one minimal permission-aware server projection.
- [x] Keep customer PII out of the overview.

### T2 — Implementation

- [x] Add the aggregate merchant dashboard service, controller and protected route.
- [x] Add the strict frontend adapter contract.
- [x] Replace three independent overview reads with one cancellable dashboard read.
- [x] Implement tasks-first metrics, recent orders, sales trend, top products and module shortcuts.
- [x] Emit only tasks whose action is authorized.

### T3 — Verification

- [x] Add frontend contract and component regressions.
- [x] Add PostgreSQL authorization, tenant-data and no-PII integration coverage.
- [x] Pass locked frontend and backend quality gates.
- [x] Add bounded query indexes and verify the configured business-day boundary.
- [x] Pass the complete container integration gate on the final implementation tree.

### T4 — Pilot

- [x] Deploy the final backend and web images to the retained local Pilot and migrate all active tenant schemas through the lifecycle-aware QA command.
- [ ] Verify merchant store selection, dashboard loading, tasks and direct module navigation in-browser.

### T5 — Delivery

- [x] Obtain independent read-only approval with no remaining P0/P1/P2 findings.
- [ ] Record final evidence, commit, PR, required CI and protected-branch merge.

## Acceptance criteria

- A merchant can use “My stores” to select a store and open one canonical store center.
- Opening the overview makes one dashboard HTTP request, not independent catalog/order/inventory overview requests.
- Sales and order facts come from the tenant database and are never synthesized in the browser.
- Restricted members see unavailable metrics instead of invented zeros or unauthorized facts.
- Every emitted task opens an authorized existing module.
- Recent-order summaries contain no customer name, phone, email or address.
- Switching tenants aborts or ignores the older tenant response.
- Failure and expired-session states remain explicit and safe.

## Rollback

Restore the previous backend and web images. The additive dashboard indexes can remain safely; an exact rollback removes only the four indexes and no business records.

## Evidence

See [WP 5.22 verification evidence](../evidence/WP-5.22/verification.md).
