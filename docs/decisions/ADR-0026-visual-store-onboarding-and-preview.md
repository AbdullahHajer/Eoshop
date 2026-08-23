# ADR 0026 — Visual store onboarding and truthful pre-submission preview

## Status

Accepted for WP 5.14 implementation.

## Context

WP 5.13 made authentication, account data and the three onboarding stages server-owned and reload-safe. The design stage still exposes only two color cards, the final review does not show the resulting storefront, and a successful first submission can be reported as a client contract error when its immediate resource projection omits unloaded nullable relations.

## Decision

1. The existing server stages remain `business`, `design` and `review`; WP 5.14 improves their product experience without inventing a second draft or bypassing their revision contract.
2. The design stage presents a bounded first-party template catalog. Template identifiers remain the existing `elegant` and `tech` values; arbitrary template code, HTML or remote executable content is not accepted.
3. Selecting a template changes only a server-enforced appearance allowlist: slogan, logo icon, palette, font, announcement text and hero presentation. The design request cannot carry products, inventory, currency, contacts, checkout or payment configuration; the server merges the validated appearance into the locked server-owned draft.
4. Template cards use bounded thumbnails, while the selected design and final review use the same `StorePreview` renderer as the builder in explicit preview mode. Bounded sample products exist only in the in-memory preview projection, are reset when the selected template changes, and are never sent to or persisted by the draft API. Preview checkout stays non-persistent and cannot create an order.
5. The final review shows business, design, requested address and selected plan together before the single submit action. It states that submission creates a review request, not an approved or public store.
6. A successful submission response must load the complete `StoreSubmissionResource` relation set. The browser clears ambiguous-submission recovery metadata only after the full response is mapped successfully.
7. Domain availability remains advisory. A collision at atomic submission is still authoritative and returns conflict; the UI must not claim reservation before submission.
8. Entry remains available from the authenticated landing header and the merchant portal. The portal exposes a persistent create-store action in its navigation as well as the empty state and overview call to action.

## Consequences

- No central or tenant schema migration is required.
- The onboarding route becomes materially useful before approval while preserving provisioning, publication, inventory and order boundaries.
- Product/catalog editing, managed asset upload and advanced checkout configuration remain available only after the tenant workspace is ready; a direct API client cannot smuggle them through the onboarding design writer.
- Additional templates can be introduced later only through an explicit server-compatible template catalog contract.
