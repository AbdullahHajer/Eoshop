# ADR 0022 — Platform administration console foundation

- Status: Accepted for WP 5.10 implementation
- Date: 2026-08-21
- Depends on: ADR 0003, ADR 0005, ADR 0007, ADR 0008, ADR 0009, ADR 0015, ADR 0016

## Context

The platform already owns central identities, permission-scoped administration, attributable audit records, recoverable provisioning, subscriptions and publication. The interface still exposes those operations through a modal whose local filtering and totals represent only the first API page. The protected audit endpoint has no interface, and the browser has no authoritative operational overview.

Platform user management and writable settings are materially different security domains. A users screen needs lifecycle, session revocation, role-assignment and self-lockout rules. A settings screen needs typed server schemas, validation, authorization, audit and secret boundaries. Rendering either as a browser-owned placeholder would recreate the prototype problem the platform is removing.

## Decision

1. `/admin` becomes a route-owned full-page console. Its canonical routes are `/admin` for overview, `/admin/stores` for store operations and `/admin/audit` for the audit explorer. Direct refresh restores the requested authorized section. It may share the React application bundle for WP 5.10, but it is not presented as a modal and it owns its loading/navigation state outside `App.tsx`.
2. WP 5.10 exposes only capabilities that have server contracts: platform overview, store operations and read-only audit exploration.
3. Console entry requires `platform.stores.view` **or** `platform.audit.view`. It is never inferred from a system-role name. `GET /api/admin/overview` and the stores section require `platform.stores.view`; the audit section and endpoint require `platform.audit.view` independently. A stores reviewer without a super-admin role enters normally, an audit-only operator enters directly on `/admin/audit`, and a merchant is denied.
4. `GET /api/admin/overview` is an authoritative central read model with this stable projection:
   - `generatedAt` from PostgreSQL transaction time in UTC;
   - `stores.total`;
   - `stores.verification.{pending,approved,rejected,suspended}`;
   - `stores.provisioning.{notStarted,queued,provisioning,retrying,active,failed}`;
   - `stores.publication.{requested,published,unpublished,rejected}`;
   - `attention.{review,provisioning,subscription,publication}`.
   All values are read inside one central `REPEATABLE READ` transaction. Attention counts call the same reusable predicates as the corresponding list filter, so an overview card and the first filtered page cannot use different definitions.
5. `GET /api/admin/stores` accepts only these query parameters:
   - `search`: optional trimmed Unicode string, 2–100 characters, searched case-insensitively only in `store_name`, `owner_name` and `owner_email`;
   - `verification`: one `TenantVerificationStatus` value;
   - `provisioning`: one `ProvisioningState` value;
   - `publication`: one `PublicationStatus` value;
   - `attention`: one of `review`, `provisioning`, `subscription`, `publication`;
   - `page`: integer 1–100000;
   - `perPage`: integer 10–100, default 25.
   Supplied filters combine with logical AND. Results order by `created_at DESC, id DESC`. Any supplied invalid value returns 422; values are never clamped or silently ignored.
6. Operational queues are named server filters, not browser guesses:
   - `review` means verification is pending;
   - `provisioning` means authoritative `tenants.provisioning_status = failed`; the latest run is diagnostics only;
   - `subscription` follows only `tenants.publication_request_id -> publication_requests.tenant_subscription_id` and means status is `pending_activation` or `expired`, or status is `active` with a non-null `ends_at <= transaction_timestamp()`;
   - `publication` means verification is `approved`, provisioning is `active`, and publication is one of `requested`, `unpublished` or `rejected`.
7. `GET /api/admin/audit-logs` accepts `search` (trimmed 2–100 characters), optional exact `action` (1–120), optional exact `tenantId` (1–255), `page` (1–100000) and `perPage` (10–100, default 25). Search is limited to actor-user ID, tenant ID, action, subject type, subject ID and request ID; it never searches old/new JSON, IP or User-Agent. Ordering is `occurred_at DESC, id DESC`.
8. Audit list projection is allowlisted to event ID, actor-user ID, tenant ID, action, subject type/ID, changed field names, bounded IP, request ID and occurred time. Raw `oldValues`, `newValues` and `userAgent` are not returned by the list endpoint. Historical rows outside the current allowlist fail closed to field names only.
9. Overview, list and audit queries use the explicit central connection/model context and never initialize tenancy.
10. Existing review, metadata, retry, subscription and publication services remain the only write authorities. The console calls them through the existing CSRF-protected routes and refreshes the server read model after success.
11. A 401 invalidates console request state, clears the local authenticated profile and opens authentication with only one of the three fixed admin return paths. A 403 remains inside the shell as a visible authorization boundary. A 5xx/network failure retains the last successful data and offers an explicit safe reload. Mutations are never replayed automatically.
12. A section without its required permission is hidden and its API is never requested. If a direct URL names such a section, the console selects the first authorized fixed route or shows an access-denied state when none exists.
13. Permission keys drive both route policy and interface visibility. `platform.stores.review` controls initial pending decisions, `platform.stores.manage` controls existing management actions, and `platform.audit.view` controls the audit section. No role name grants implicit authority.
14. Platform users and settings are subsequent work packages. WP 5.10 shows no enabled placeholder that could be mistaken for a working control.
15. No schema migration is required. If a later package needs durable settings, queue ownership or user-lifecycle state, it must introduce its own ADR and migration gates.

## Consequences

- Platform operators gain a useful administration home immediately using real server capabilities.
- Counts, filters and queues remain truthful when the platform grows beyond one page of stores.
- Administration orchestration leaves the application root and becomes independently testable.
- User lifecycle and platform settings remain explicit follow-up boundaries rather than unsafe mock interfaces.

## Verification requirements

- Prove guest, merchant, reviewer and manager boundaries for overview, stores, mutations and audit.
- Prove search and each enumerated queue filter on PostgreSQL, including invalid values and pagination caps.
- Prove overview totals are independent of the currently loaded page.
- Prove audit search cannot mutate records and does not return secret/workspace payloads.
- Prove the console hides unauthorized sections/actions while treating the server response as final.
- Prove 401, 403, 422, network and mutation failures have distinct visible states with no unsafe automatic replay.
- Preserve all existing provisioning, subscription, publication, audit and Host-boundary integration tests.
