# ADR 0019 — Focused product editor and builder ownership

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-20 |
| Decision owners | Eoshop product and engineering |

## Context

WP 5.6 gave every store a route-owned operations home and dedicated order and inventory modules. Product editing still opens a 3,497-line `ControlPanel` that also contains obsolete order and inventory panels. The product form mixes catalog metadata, inventory controls, media upload and optimistic local language, making the merchant unclear about which action merely edits the draft and which action persists it to the server.

The catalog remains part of the revisioned workspace aggregate used by the full editor. A narrower catalog API also exists for catalog-only writers. This package must improve ownership and language without adding another write path or weakening workspace/catalog conflict handling.

## Decision

1. Extract product editing into a typed `MerchantProductEditor` feature boundary. It receives controlled products, currency and callbacks; it does not import workspace transport services or keep a second product draft.
2. Product metadata, status, pricing, SKU, category, description and ordered media are persisted by this editor only through the existing revisioned workspace save. The existing narrower catalog API remains valid for catalog-only clients; a concurrent catalog write makes the editor save fail with `catalog_revision_conflict` and enter the same explicit 409 recovery path.
3. Stock quantities, reservations and inventory policy remain inventory-owned. The product editor shows the current projection but directs operational changes to the route-owned inventory module.
4. Existing server products are removed from the outgoing products array and their UUID is added to `archiveProductIds`; a browser-only unsaved product is removed without an archive ID. The two sets never overlap. Archive intent remains dirty after any failed/409 save and is cleared only after a successful workspace response. A reservation-based archive rejection remains recoverable through reload/conflict handling.
5. Adding or editing a product marks the workspace dirty. Closing a product form never claims that the server has saved it; only the application-level save action may make that claim after a successful response.
6. Managed media upload continues through the catalog adapter with an exact account/tenant/product/media-generation token. It is invalidated on tenant/account switch, product archive/removal, unmount and conflict reload. A stale upload result is discarded; any unattached managed file is reclaimed by the existing delayed media cleanup contract.
7. Orders and inventory are removed from the design builder navigation and implementation. Their only merchant operational owners are `/orders` and `/inventory` under the selected store.
8. The product route remains a server snapshot for read-only catalog staff. Users with both catalog and workspace management can open the focused editor from that route. Product callbacks are keyed by product ID and apply functional React updates, including after search/sort changes. A new browser-only product uses `draft:${crypto.randomUUID()}` as its React identity; the workspace serializer omits that non-UUID ID so the server allocates the durable product UUID.
9. Workspace revision conflict, account switch, store switch, logout and dirty-navigation guards remain owned by `App` and are not duplicated inside the editor.
10. The inventory handoff is an `App`-owned navigation callback. It is shown only with `inventoryView`, passes through the existing dirty-workspace confirmation, and never invents missing stock values.
11. No migration, new endpoint, authorization rule or server mutation is introduced in WP 5.7.

## Consequences

- Product work becomes understandable and testable as one feature instead of a section hidden among unrelated builder tabs.
- The builder shrinks and becomes closer to its intended design/content responsibility.
- Inventory and order logic have one interface owner, reducing stale-state and double-mutation risk.
- Catalog-only staff retain truthful read access without receiving workspace editing capability.
- A later package may make the focused editor a fully independent screen without changing its feature contract.

## Alternatives rejected

### Add direct product CRUD endpoints now

Rejected because catalog replacement, workspace revision and publication readiness already form one protected aggregate. A second write path would create ordering and conflict ambiguity.

### Keep duplicate order and inventory tabs for convenience

Rejected because route-owned operational modules now exist and duplicates can display stale state or diverging actions.

### Redesign the complete builder in one package

Rejected because checkout, pages, branding and live preview remain large independent concerns. Their extraction should follow focused characterization boundaries.

## Rollback

WP 5.7 is frontend-only. Reverting the focused editor and restoring the prior `ControlPanel` sections changes no central or tenant data and does not alter the workspace API.
