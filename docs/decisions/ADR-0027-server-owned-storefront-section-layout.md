# ADR 0027 — Server-owned storefront section layout

- Status: Accepted
- Date: 2026-08-24
- Work package: WP 5.15

## Context

WP 5.8 delivered a focused, revisioned store-profile editor for identity, colors, typography and managed logo/hero assets. WP 5.14 deliberately kept pre-submission design bounded. The public storefront still renders its home sections in hard-coded template order, however, and several legacy template blocks contain fixed warranty, delivery, popularity or customer-count claims that are not backed by server data. Restoring the prototype's broad browser-only builder would recreate competing state and unsafe persistence.

## Decision

### Product boundary

- Advanced layout is an existing-store operation under the focused profile/appearance task; onboarding keeps its bounded template and identity controls.
- The first section catalog and default are fixed and server-owned, in this exact order: `[{id: hero, visible: true}, {id: trust, visible: true}, {id: categories, visible: true}, {id: featured_products, visible: true}, {id: about, visible: true}]`.
- The merchant can change order and visibility with keyboard-accessible move/show controls while using the existing desktop/mobile storefront preview.
- Product content, inventory, checkout policy and About/contact copy remain owned by their existing focused modules. The layout editor changes placement and visibility only.

### Persistence and validation

- `config.homeSections` is an ordered list of exactly five objects shaped as `{id, visible}`. Every catalog ID appears exactly once; unknown, duplicate, missing or malformed entries fail with HTTP `422`, code `workspace_validation_failed`, and never mutate the workspace.
- At least one home section must remain visible. Hiding `featured_products` affects the home page only and never changes product publication or the products route.
- `StoreWorkspaceService` remains the only writer. Layout changes use the existing workspace revision, tenant/membership locks, atomic config/catalog transaction, conflict recovery and audit/log correlation; no second endpoint or table is introduced.
- A tenant `store_configs` record that lacks `homeSections` is projected with the exact default above. The next successful workspace write persists it. A present malformed tenant value is never normalized: merchant reads fail with HTTP `409`/`workspace_layout_invalid`, and the public host fails closed with `404`.
- Write omission is compatibility-safe only under the locked current record: if both the incoming config and that locked legacy record lack `homeSections`, the writer injects the default. If the locked record already contains any valid layout, an incoming omission fails with HTTP `422`/`workspace_layout_required` and cannot reset a customized layout. A mixed-version regression covers both cases.
- Central `store_drafts`, rejected corrections, `store_submissions.payload_snapshot` and queued provisioning runs are not layout authorities. Business/design/review draft writers continue to reject or ignore client layout input according to their exact allowlists; submission/provisioning removes any central-source `homeSections` value and injects the exact default before `StoreWorkspaceContract` validation and tenant initialization. Thus old queued submissions converge and no onboarding caller can reserve a future layout.

### Hero ownership and exact section map

- `homeSections.hero.visible` owns visibility of the whole home hero boundary. `showHeroBanner` is retained only as an image-layer choice inside that visible boundary and is relabeled accordingly; it can never hide the semantic hero itself.
- In the tech theme, `hero` is the existing tech introduction hub. In the elegant theme, `hero` is one boundary containing the optional image banner followed by the welcome showcase. Hiding `hero` hides both elegant parts.
- `trust` contains the tech feature/service facts or the elegant trust facts derived only from the allowlist below. Duplicate legacy shipping/service blocks are removed or folded into this one boundary.
- `categories` is the real catalog-category block in both themes; the elegant theme receives the same semantic category navigation with elegant styling.
- `featured_products` is the real published-product grid in both themes. `about` is the current-config About summary in both themes.
- Each theme renders exactly one wrapper with `data-storefront-section` for every visible semantic ID. Reordering/hiding applies only to the home page; header/navigation and the Products/About routes remain reachable and unchanged.

### Rendering and truthful content

- Both first-party themes render the same five semantic section boundaries and apply the exact server order/visibility. Theme styling may differ, but a theme switch cannot resurrect a hidden section or change its order.
- The public and authenticated preview compositions use the same normalized layout. Each rendered boundary exposes a stable internal section identifier for automated verification, not for arbitrary CSS injection.
- All customer-visible `StorePreview` surfaces are in the truthfulness pass, including header, home, products, About and product detail—not only reordered blocks. Fixed warranty periods, free/instant shipping, ratings, sales/popularity, customer totals, guarantees and payment claims are removed unless the exact fact exists in the allowlist below.
- The literal trust-data allowlist is: authoritative published product/category counts; configured phone/WhatsApp/email/working-hours presence; `enableCashOnDelivery === true`; usable public bank transfer; active usable public wallets; and explicitly configured `shippingFee`/`freeShippingThreshold` values. No other config or template prose can create a trust claim in WP 5.15.
- Empty trust data shows `لم يضف المتجر معلومات الخدمة بعد`. Empty real categories/products show bounded empty states rather than sample records or invented counts.

### Client contract and recovery

- The typed API mapper supplies the default only when the field is absent for a legacy workspace. If the server sends a present malformed field, the response fails closed as a contract error.
- Reorder/show actions update one immutable `homeSections` value. They participate in the existing dirty-navigation, save, reload, 409 review/reapply, logout, account-switch and store-switch guards.
- Preview interaction state is not persisted and cannot create an order while used inside the editor.

### Authorization and mixed-version deployment

- The controls are rendered only for the existing `workspaceManage` capability, which requires both `tenant.store.manage` and `tenant.products.manage` under the current aggregate writer. An active member may still use the existing read projection, but store-only, product-only, inactive membership and other-tenant actors cannot enter or write through the layout editor. A direct denied mutation returns `403`, keeps the dirty draft and shows an explicit authorization error; global suspended/deleted identity remains `401`.
- Regression coverage includes store-only, product-only, suspended membership/identity, tenant/account switch and a late response from the previous store.
- Deployment is compatibility ordered under request drain: deploy the new backend/worker first (it accepts old-client omission only for a locked legacy record that also lacks the field), then deploy the new web client. The new web client is never served against the old backend that rejects the new key. Rollback drains requests, deploys the old web client first; while the new backend remains active, old-client writes against a layout-bearing record fail `422` instead of losing layout. Deploying the old backend then restores the documented legacy behavior, and a later old-client save intentionally restores the deterministic default layout; this bounded visual reset is disclosed.

### Deployment and rollback

- This change is additive JSON configuration and requires no database migration. Gates cover an active tenant missing the field, a valid configured tenant, a present malformed tenant, a legacy draft/correction, and a queued submission before deployment.
- Rolling application code back is allowed only after draining requests and accepting that an old client will drop the unknown layout on its next save, restoring deterministic defaults. Durable products, assets, orders and inventory are unaffected.

## Consequences

- Merchants recover useful page composition controls without returning to a monolithic prototype builder.
- Layout remains cross-device, revisioned and public-host consistent.
- Arbitrary sections, rich page building, custom HTML/CSS, per-section content schemas and a template marketplace remain future packages.

## Rejected alternatives

- Persist order in local storage: rejected because it is account/device-local and cannot authorize the public storefront.
- Add a layout-only PATCH endpoint: rejected because it would compete with the workspace revision and permit lost updates.
- Arbitrary user-defined HTML/CSS blocks: rejected because sanitization, accessibility, CSP and template compatibility require a separate architecture.
