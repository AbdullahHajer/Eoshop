# Eoshop current delivery state

Updated: 2026-09-07

## Product position

Eoshop has a server-authoritative commerce core, a repeatable local Pilot, two distinct public-storefront templates and a verified journey from onboarding appearance through review, provisioning, customization and publication. The active merged launch baseline is `08381c9994f861859dc648822ba61856b8d43624`, produced by merging PR #100. Secure guest fulfillment tracking and separate manual fulfillment evidence are now part of `main`, while the bounded marketing campaign core proceeds in parallel before per-merchant payment integration. Automated verification and protected-branch CI remain mandatory.

## Delivered

- Phase 0: repository baseline, single Laravel application server, CI and protected `main`.
- Phase 1: central identity, database sessions, authentication, scoped roles, policies and audit.
- Phase 2: tenant isolation, domains, recoverable provisioning, plans, subscriptions and publication.
- Phase 3: unified frontend transport, server-owned workspaces and UI adapter boundary.
- Phase 4.1–4.3: catalog/pricing/media, inventory ledger/reservations and server-authoritative orders.
- Phase 5.1–5.3: initial frontend boundaries and repeatable local QA Pilot.
- WP 5.4–5.5: merchant portal, server-owned drafts, rejected-store correction/resubmission and merchant publication controls.
- WP 5.6: route-owned merchant store operations for catalog, orders, inventory and store modules.
- WP 5.7: focused product editor with ID-keyed changes, truthful archive/media behavior and removal of duplicate order/inventory builder modules.
- WP 5.8: focused store profile and appearance editor with tenant-isolated managed logo/hero assets and no second workspace writer.
- WP 5.9: focused checkout policy and About/contact content tasks with truthful payment/contact behavior, immutable receipt presentation and managed About media.
- WP 5.10–5.12: permission-driven platform administration, operator lifecycle and server-owned platform branding/navigation/settings.
- WP 5.13: guided authentication, merchant account and durable three-step onboarding routes with recoverable submission handoff.
- WP 5.14: bounded visual template selection, real preview and appearance-only onboarding persistence.
- WP 5.15: server-owned storefront section ordering/visibility, truthful first-party theme composition and focused renderer decomposition.
- WP 5.16: durable onboarding draft continuity, explicit submission requirements and truthful resume behavior.
- WP 5.17: nullable-contact workspace boundary hotfix for newly provisioned stores.
- WP 5.18: authenticated-shell narrow-screen, keyboard and structural accessibility acceptance hardening.
- WP 5.19: end-to-end existing-store customization completion, bounded provisioning refresh and server-confirmed publication continuity.
- WP 5.20: discoverable merchant store management, capability-aware shortcuts and recoverable public-storefront loading.
- WP 5.21: public-storefront loading/error semantics, keyboard and cart/checkout focus behavior, reduced motion, readable merchant colors, secure local-HTTP request identity and verified 320–1440 px reflow.
- WP 5.22: one canonical, permission-aware merchant launch console backed by tenant database aggregates and existing operational modules, verified and merged.
- WP 5.23: server-owned store application requirements, private evidence, a durable review timeline and targeted correction/resubmission, verified, merged and deployed to the retained Pilot.
- WP 5.24: detailed platform application review, required-evidence decisions and tenant/domain/subscription/provisioning/publication operations are verified, merged and deployed to the retained Pilot.
- WP 5.25: the tenant-isolated customer-checkout to merchant-processing cycle, protected order detail, permission-aware transitions and authoritative stock completion are verified, merged and deployed to the retained Pilot.
- WP 5.26.1–5.26.2B: premium platform landing, shared platform identity and its managed editor are merged.
- WP 5.27.1–5.27.3C: public storefront foundation, Elegant Stories and Tech Bento journeys, navigation and bounded merchant customization are merged.
- WP 5.27.5B–5.27.6C: managed platform identity assets, hero customization, store-builder polish and storefront customization parity are merged.
- WP 5.27.7A: onboarding appearance now continues through the authoritative draft, review snapshot, provisioning, merchant workspace and public storefront; PR #98 is merged at `d2710c56a02760ec5d0884abd9e466ebefa61e55`.
- WP 5.28A: receipt truth, the rejected-store administration action and safe checkout activation/rollback are verified and merged through PR #99 at `74430e5294730620e5f71bf6fe2e101aa22ad852`.
- WP 5.28B: private guest tracking, separate manual fulfillment evidence and protected merchant transitions are verified and merged through PR #100 at `08381c9994f861859dc648822ba61856b8d43624`.

## Active

- WP 5.30A marketing campaign core completed its documentation-only T1 from the former baseline `74430e5294730620e5f71bf6fe2e101aa22ad852`. Before T2 it must renumber its colliding ADR from 0042 to 0043 and merge the current `main` baseline `08381c9994f861859dc648822ba61856b8d43624`; T2 remains an isolated backend/database slice using tenant migration `000011`.
- WP 5.29A completed its bounded merchant BasGate connection slice locally from `3d712a153d86615812635b4ffdccf12f7beb8d2c`: encrypted central write-only credentials, redacted status and merchant settings UI are verified, but no provider call, verification, customer payment option or financial state transition exists. It remains uncommitted and unmerged pending review, while WP 5.29B is blocked by the remaining provider addendum.

## Approved next sequence

1. Keep WP 5.30A T2 limited to its independent campaign backend/database core until the next planned integration point, with ADR 0043 and tenant migration `000011`.
2. Review and merge the bounded WP 5.29A connection slice independently. Add the hosted payment lifecycle only after sanitized provider documentation fixes the remaining contract; do not store merchant credentials in public or storefront configuration.
3. Integrate order attribution and the bounded V1 marketing report only after the order, fulfillment and payment contracts are stable.
4. Finish production acceptance with HTTPS/DNS, secrets, mail/password recovery, backup/restore, monitoring and complete live journeys on one release SHA.

## Deliberately deferred

- Refunds, chargebacks, settlement accounting and multi-provider payment abstraction beyond the selected V1 gateway.
- Returns automation and shipping-company integrations; WP 5.28B covers only the bounded manual V1 fulfillment/tracking cycle.
- External custom-domain DNS/TLS automation.
- Production mail/WhatsApp/social publishing.
- Product variants, multi-warehouse inventory and advanced analytics.
- Destructive tenant/schema deletion and retention automation.
- Redis, object storage/CDN, production monitoring, backup drills and load targets.

## Control rule

No work package is considered complete from code alone. Its Work Package status, T0–T5 gates, evidence, commit/PR/CI/merge facts and this current-state sequence must agree.
