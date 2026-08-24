# Eoshop current delivery state

Updated: 2026-08-24

## Product position

Eoshop has a server-authoritative commerce core and a repeatable local Pilot. Human Pilot acceptance is paused while Phase 5 turns the prototype-style navigation into coherent merchant and platform product shells. Automated verification and protected-branch CI remain mandatory.

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

## Active

- WP 5.15: server-owned storefront section order/visibility inside the existing focused appearance editor.

## Approved next sequence

1. Complete the bounded storefront section layout without reintroducing the prototype builder.
2. UX/browser acceptance, accessibility and responsive hardening across merchant, platform and public shells.
3. Local-market payment verification/notifications, then Phase 6 staging, observability, backup and scale work.

## Deliberately deferred

- Real payment gateway capture, webhooks, refunds and chargebacks.
- Transfer-proof verification, returns, fulfillment and shipping integrations.
- External custom-domain DNS/TLS automation.
- Production mail/WhatsApp/social publishing.
- Product variants, multi-warehouse inventory and advanced analytics.
- Destructive tenant/schema deletion and retention automation.
- Redis, object storage/CDN, production monitoring, backup drills and load targets.

## Control rule

No work package is considered complete from code alone. Its Work Package status, T0–T5 gates, evidence, commit/PR/CI/merge facts and this current-state sequence must agree.
