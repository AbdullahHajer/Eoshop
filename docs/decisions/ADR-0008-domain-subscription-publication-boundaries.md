# ADR 0008 — Domain, subscription and publication boundaries

- Status: Accepted
- Date: 2026-08-15
- Work package: WP 2.3

## Context

WP 2.2 deliberately provisions every tenant behind a deterministic internal hostname and has no server-owned package, subscription or publication contract. The prototype advertises conflicting prices and capabilities, and a technical `active` provisioning state currently also implies that the storefront is reachable.

## Decision

1. A merchant chooses one ASCII public handle below `TENANT_BASE_DOMAIN`. Arbitrary external domains, ownership proof, DNS automation and TLS issuance are not claimed by WP 2.3.
2. The requested hostname is stored in a central reservation record. PostgreSQL partial unique indexes and a hostname advisory transaction lock are the source of truth for race-free reservation.
3. The deterministic WP 2.2 hostname remains an internal identity. A public hostname is added to the tenancy resolver only when publication succeeds.
4. Plans are server-owned catalog records. A tenant subscription snapshots the selected plan relationship and has an independent lifecycle.
5. The free plan may activate automatically. Paid plans require an explicit platform-manager activation with a bounded entitlement end date. WP 2.3 never records or displays a successful payment.
6. Publication is independent from review and technical provisioning: `requested → ready → published`, with `published → unpublished`. Provisioning can finish while the storefront remains closed.
7. Runtime access requires review approval, active provisioning, published state and a currently active subscription.
8. Rejection releases only a user-selected reservation. Adopted WP 2.2 internal hostnames remain reserved and are never transferred.
9. Package limits are persisted now; each resource API must enforce its relevant limit when that resource becomes server-owned. WP 2.3 enforces the store-count entitlement at submission.

## Consequences

- Availability responses are advisory; only reservation inside the write transaction is authoritative.
- A paid-plan request can be provisioned but cannot be published before manual entitlement activation.
- Suspension and subscription expiry fail closed without destroying tenant data or hostname history.
- External custom domains and online payment-provider integration require later infrastructure-specific decisions.
