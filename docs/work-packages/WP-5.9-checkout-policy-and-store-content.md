# WP 5.9 — Checkout policy and store content tasks

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.9 |
| Status | Implementation |
| Started | 2026-08-20 |
| Branch | `codex/wp-5.9-checkout-content` |
| Base | Protected `main` at `4c44250` |
| Dependencies | WP 3.2; WP 4.3; WP 5.4–5.8 |
| Decision | [ADR 0021](../decisions/ADR-0021-checkout-policy-and-store-content-tasks.md) |

## Objective

Replace the remaining checkout and content prototype panels with focused, truthful merchant tasks while preserving the revisioned server workspace and server-authoritative order policy.

## Baseline

- Checkout and page routes still expose sibling builder tabs and approximately one thousand lines of controls inside `ControlPanel`.
- Shipping, tax, minimum, COD, bank, wallet and coupon settings already affect authoritative order creation.
- Preview mode invents payment options and demo destinations that may be disabled or invalid.
- Card, Apple Pay, STC Pay and WhatsApp-notification controls imply integrations that do not exist.
- Receipt copy is editable but not used, and the contact form claims delivery without an endpoint.
- About content is real public composition, but its image cannot use the managed asset lifecycle delivered in WP 5.8.

## Scope

- Extract focused checkout-policy and store-content editors with typed immutable updates.
- Focus `/checkout` and `/pages` routes and remove unrelated prototype navigation from those tasks.
- Keep shipping, tax, minimum, customer requirements, COD, bank, wallet, coupon and receipt policy in the existing workspace authority.
- Remove synthetic preview payment methods and unsupported gateway controls.
- Remove demo payment/coupon data from all new-store presets and normalize legacy drafts fail-closed before editing.
- Apply saved receipt copy and truthful conditional WhatsApp action to the real order success view.
- Persist and replay a bounded checkout-presentation snapshot from the locked workspace revision with the idempotent order result.
- Align preview minimum/shipping/discount/tax/fee behavior with the server contract and escape printable receipt content.
- Replace the fake contact submission with configured direct-contact destinations and honest unavailable state.
- Extend managed store asset binding to `aboutImage` and add guarded upload in the content editor.
- Add backend/frontend characterization and regression gates without a new schema or mutation endpoint.

## Out of scope

- Card processor, Apple Pay, STC Pay, gateway tokens, payment capture, webhooks, refunds or chargebacks.
- Transfer receipt upload or platform verification workflow.
- Inbound contact-message persistence, email delivery or WhatsApp notification delivery.
- Arbitrary custom/legal page collection, rich text, SEO or localization.
- Shipping zones, carrier integrations or location-specific taxation.
- Splitting the aggregate workspace persistence or permissions model.

## Safety and product invariants

- Workspace revision, catalog revision and explicit save remain mandatory; an editor never writes directly.
- Server order pricing/validation remains final; client preview totals are explanatory only.
- Printable receipt HTML escapes all merchant, catalog and shopper strings before document output.
- Empty/disabled payment configuration never becomes an available method through preview defaults.
- Public workspace composition forces unsupported legacy gateway flags off.
- Enabled bank/wallet destinations must pass the existing non-demo completeness contract before save and before public exposure.
- Bank and wallet checkout require a bounded shopper-supplied transfer reference; COD prohibits it, and no proof or verification claim is made.
- Wallet IDs are immutable canonical lower-case ASCII slugs and unique after canonicalization.
- Receipt presentation is pinned to the order's locked workspace revision and is replayed from the stored operation result; it is never reconstructed from current settings.
- WhatsApp contact uses only a canonical international configured target (`whatsapp`, then `phone`) and remains a shopper-initiated action.
- Coupons are never included in public workspace composition; validation occurs on the server during order creation.
- No contact delivery or notification success is claimed without a real backend/external action.
- No new-store preset contains enabled/populated demo bank, wallet, coupon or unsupported gateway data; legacy drafts cannot reactivate or silently republish it.
- Public contact cards, address, hours and response expectations appear only from saved values; no fallback or support SLA is invented.
- Managed About media is exact-tenant, reference-bound, publication-gated and recoverably cleaned.
- Late uploads cannot cross account, tenant, slot or editor generation.
- Failed save and 409 recovery retain dirty merchant changes and never claim publication.

## T0–T5

### T0 — Contract and baseline

- [x] Inventory operational, presentation-only and unsupported checkout/content fields.
- [x] Accept ADR 0021 single-writer and truthfulness decisions.
- [x] Complete independent design review.

### T1 — Checkout policy task

- [x] Extract checkout copy, customer requirements, fees/tax, truthful payment destinations, coupons and receipt copy.
- [x] Remove demo fallbacks and unsupported gateway activation controls.
- [x] Make preview availability and the successful receipt honor the saved configuration.

### T2 — Store content task

- [x] Extract About, contact and social presentation into a focused editor.
- [x] Add guarded managed About-image upload and backend reference validation.
- [x] Remove the fake contact-success journey and expose only configured direct destinations.

### T3 — Verification

- [x] Cover controlled immutable edits, empty states, duplicate IDs/codes and validation messaging.
- [x] Cover server-authoritative minimum/shipping/tax/COD/bank/wallet/coupon behavior after workspace changes.
- [x] Cover no synthetic payment option in preview/live and no unsupported gateway claim.
- [x] Cover clean ELEGANT/TECH/new-draft baselines and fail-closed normalization of legacy demo payment/coupon data.
- [x] Cover receipt copy, conditional real WhatsApp target and absence of fake contact delivery.
- [x] Cover absent phone/email/address/hours, no invented response SLA and an honest contact empty state.
- [x] Cover immutable receipt-presentation replay after workspace changes and fail-closed legacy operation results.
- [x] Cover public fail-closed projection of unsupported legacy gateway flags.
- [x] Cover required transfer references, canonical wallet IDs and no-side-effect validation failures.
- [x] Cover preview pricing/rounding and safe escaping of printable customer/catalog/config values.
- [x] Cover About asset upload, exact tenant binding, public/preview visibility, unreference and cleanup.
- [x] Cover focused routing, dirty navigation, failed save, 409 recovery and account/store switch guards.
- [x] Preserve storefront, catalog, inventory, order, lifecycle, publication and onboarding characterization.

### T4 — Gates

- [x] Pass frontend tests, production build and dependency audit.
- [x] Pass backend quality, repository safety and isolated container integration.

### T5 — Evidence and delivery

- [x] Record exact evidence and retained gateway/contact/legal-page debt.
- [x] Obtain final independent read-only approval.
- [ ] Commit implementation and evidence separately, push, open PR, pass required CI and merge.

## Acceptance criteria

- A merchant opens dedicated checkout and content tasks from the operations center without unrelated builder modules.
- A saved operational checkout setting changes the next server-created order or its allowed payment choices as specified.
- The preview never invents a payment destination, coupon or payment method.
- The public receipt uses configured confirmation copy and offers WhatsApp only with explicit enablement and a configured target.
- Retrying an idempotent order after checkout settings change returns the original receipt presentation and target.
- A bank/wallet order without a reference is rejected before order, payment or reservation rows are written.
- The public contact view cannot report a message as received without a delivery mechanism.
- New stores start with no enabled demo payment/coupon capability, and legacy demo values cannot become live through an unrelated save.
- An empty contact configuration shows no invented destination, address, working hours or response promise.
- An authorized merchant can upload, save and publish an About image through the managed asset lifecycle.

## Rollback

Revert the focused editor boundaries while retaining backend `aboutImage` recognition, serving and cleanup as a compatibility floor for already-written managed references. Do not delete managed asset rows or files; the WP adds no schema. Existing workspace JSON remains compatible with the previous composition path, and unsupported public gateway flags remain forced off.
