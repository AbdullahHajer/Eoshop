# ADR 0021 — Focused checkout policy and store content tasks

- Status: Accepted for WP 5.9 implementation
- Date: 2026-08-20
- Depends on: ADR 0010, ADR 0012, ADR 0020

## Context

The remaining `checkout` and `pages` routes still open large prototype sections inside `ControlPanel`. Some checkout fields are authoritative inputs to server pricing and order validation, while card/Apple Pay/STC Pay toggles are persisted but have no gateway or order implementation. Preview mode also invents cash, bank and wallet options when they are disabled. The public contact page claims a message was received without sending it anywhere. Thank-you copy and the WhatsApp option are editable but are not respected by the receipt view.

The content route is not a general page system. It currently owns the About presentation and public contact/social details. `aboutImage` remains HTTPS-only even though WP 5.8 introduced an appropriate same-tenant managed asset lifecycle.

## Decision

1. The revisioned store workspace remains the single checkout/content writer. WP 5.9 adds no parallel table, mutation endpoint or browser persistence authority.
2. Extract controlled `MerchantCheckoutSettingsEditor` and `MerchantStoreContentEditor` feature boundaries. `App` continues to own save, dirty state, navigation protection, revision conflict recovery and public preview coordination.
3. Checkout presents only truthful capabilities:
   - page copy, customer requirements, shipping/minimum/tax policy, cash on delivery, validated bank transfer, validated wallets, coupons and receipt copy remain editable;
   - online card, Apple Pay and external gateway controls are not editable or represented as active until a gateway contract exists;
   - no demo account, wallet, coupon or payment method is synthesized when configuration is empty or disabled.
4. Public and merchant preview payment availability derives from the same enabled and usable configuration. Final order pricing and policy validation remain server-authoritative.
5. Order creation derives an immutable `checkoutPresentation` snapshot from the same locked `store_configs` revision used for pricing. The idempotent operation result stores and replays that snapshot with the receipt. It contains bounded receipt title/message plus an optional canonical WhatsApp target. The success view must use this receipt snapshot, never a newer workspace read. Legacy stored results without the snapshot fall back to neutral receipt copy with no WhatsApp action.
6. The content task is named for About and contact content, not arbitrary custom pages. The fake contact submission form is removed until an inbound-message endpoint exists; real `mailto:`/WhatsApp destinations may be shown only from configured values.
7. `aboutImage` may use the existing managed store asset API for an active exact tenant. `StoreAssetPath` reference binding, public serving and cleanup treat it exactly like logo/hero. Draft/provisioning values remain HTTPS-only until a ready tenant exists. Once a managed About image can be written, backend recognition, serving and cleanup support become an additive compatibility floor and are not removed by a frontend rollback.
8. Bank and wallet destination data is intentionally customer-visible when enabled. The editor warns the merchant and accepts destination details only; it never accepts banking credentials, API tokens or gateway secrets.
9. Existing unsupported payment flags may remain readable in the private merchant workspace for compatibility but receive no control or product claim. Public composition forces `enableOnlineCard`, `enableApplePay` and `enableStcPay` to `false`, regardless of legacy JSON. They do not create a payment method and are not part of publication readiness.
10. The existing composite `workspaceManage` capability and aggregate lock/revision contract remain unchanged. Splitting catalog/settings persistence is a later architectural decision, not a shortcut in this extraction.
11. Preview minimum, shipping, discount, tax and payment fees use the same documented rounding/order as the server for explanation, while the submitted server receipt remains final. Preview cannot complete an order with no usable payment method.
12. Printable receipt HTML must escape every customer, product, store and order value before `document.write`; no workspace or shopper string is treated as markup.
13. A direct WhatsApp destination is canonical only when the configured `whatsapp` value, then `phone` as fallback, can be normalized to an international `+` followed by 7–15 digits after removing display separators. Invalid, local-only or absent values produce `null`. The action is described only as shopper-initiated contact/share; WP 5.9 does not claim delivery or notification.
14. `bank_transfer` and `wallet` checkout requests require a non-empty bounded transfer reference. The resulting `transfer_submitted_unverified` state means only that the shopper declared a transfer and supplied its reference; it is neither proof nor platform verification. COD prohibits a reference. Missing references fail validation before an order or inventory reservation is created.
15. Wallet identity is a stable, immutable key in the editor. On save, IDs must be trimmed lower-case ASCII slugs matching `^[a-z0-9][a-z0-9_-]{0,99}$` and must be unique after canonicalization. Public composition drops unusable or duplicate legacy wallets; it never silently retargets an order channel.
16. All new-store presets and draft baselines start with bank transfer, wallets, coupons and unsupported gateways disabled and with no destination/account/coupon records. Existing local or server drafts are normalized fail-closed before editing: demo/incomplete bank and wallet records, duplicate/noncanonical wallet IDs, and unsupported enabled gateway flags cannot appear as active capabilities and are not silently written back. The merchant must deliberately enter valid real values and explicitly enable each supported capability.
17. Public contact composition renders a phone, WhatsApp action, email, physical address or business-hours value only when that exact value is saved and valid for its action. It invents no fallback identity, address, opening hours, response time or support SLA. When no usable destination exists, the page shows an explicit unavailable/empty state and makes no contact-success claim.

## Consequences

- Existing merchant and public APIs stay compatible and checkout calculations retain their tested server authority.
- The remaining builder becomes substantially smaller and route-specific checkout/content journeys no longer expose unrelated prototype tabs.
- Managed About images gain the same tenant isolation and cleanup guarantees as logo/hero without another migration.
- Real gateway capture, inbound contact messages, legal/custom page collections, notification delivery and payment verification remain explicit later work.

## Verification requirements

- Characterize every checkout field that affects server validation/pricing and prove the public receipt reflects saved presentation values.
- Prove disabled/empty payment configuration yields no invented option in preview or live mode.
- Prove unsupported gateway toggles have no merchant control or availability claim.
- Prove About managed assets cannot cross tenants, bind through encoded/reserved paths or remain public after unreference/unpublish.
- Prove the public contact experience makes no successful-delivery claim without an actual destination.
- Prove order replay returns the exact stored receipt presentation after the workspace is changed, and that legacy results fail closed.
- Prove unsupported legacy gateway flags are false in public composition.
- Prove bank/wallet reference requirements and canonical wallet-ID uniqueness fail before order side effects.
- Prove phone normalization rejects local/invalid values and never invents a contact target.
- Prove every new-store preset/baseline contains no enabled or populated demo payment/coupon capability and legacy drafts are normalized fail-closed without silent republishing.
- Prove every public contact field is saved data or absent, with no fallback address/hours/response-time claim and an honest empty state.
- Prove print/receipt content is escaped and checkout copy, minimum, shipping, tax and confirmation settings are actually rendered.
- Preserve workspace save/409/dirty/account-switch behavior and all existing product, inventory, order, publication and onboarding tests.
