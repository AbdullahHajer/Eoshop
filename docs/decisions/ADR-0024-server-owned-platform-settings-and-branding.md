# ADR 0024 — Server-owned platform settings, branding and landing navigation

- Status: Accepted
- Date: 2026-08-22
- Work Package: WP 5.12

## Context

The platform console now owns stores, users and audit, but the product identity remains compiled into React as a mixture of `Eoshop` and `مبتكر`. Landing copy, support destinations, announcement text and the small landing navigation cannot be changed by an authorized operator. There is no central schema, policy, revision, audit or public projection for platform settings. Adding browser-only controls would therefore recreate the same false persistence boundary that earlier work packages removed from merchant configuration.

This boundary is presentation configuration, not infrastructure administration. SMTP credentials, payment secrets, DNS/TLS, queue/cache drivers, environment variables, plan entitlements and arbitrary HTML or scripts must never pass through a browser settings form.

## Decision

1. The central PostgreSQL database owns one typed `platform_settings` singleton and three fixed `platform_navigation_items`. Both models always use the central connection, including after tenant tenancy has been initialized. The exact schema is frozen below.
2. The settings record has a positive monotonically increasing `revision`. It contains only these presentation fields: platform name, tagline, optional external HTTPS logo URL, primary colour, landing headline and description, announcement enabled/text, support email/phone/WhatsApp, landing visibility for the how-it-works and pricing sections, and storefront attribution enabled/text.
3. Navigation is an exact server allowlist: `templates`, `how_it_works` and `pricing`. An update carries each key exactly once with a bounded plain-text label, navigation visibility and unique position. The mapping is fixed: `templates` invokes the existing React templates view, `how_it_works` targets `#how-it-works`, and `pricing` targets `#pricing`. Navigation visibility does not itself control sections. Validation requires `how_it_works.isVisible=false` when the how-it-works section is hidden and `pricing.isVisible=false` when pricing is hidden, so no visible link can target a hidden section. The templates navigation item may be hidden without disabling the core create-store/template workflow. No arbitrary route, URL, HTML, icon name or executable content is accepted.
4. `GET /api/platform-settings` is a safe public projection available only on a configured central domain or an exact published tenant domain through `known.domain`. Unknown or unready hosts receive 404. It exposes the current revision and presentation fields but never actor IDs, internal timestamps, audit values or infrastructure configuration.
5. `GET /api/admin/platform-settings` and `PUT /api/admin/platform-settings` are central-domain, database-session and policy protected by the new `platform.settings.manage` permission. The seeded platform super-admin receives it; reviewer and merchant roles do not.
6. The update body is closed and typed. It carries `expectedRevision` plus the complete settings and navigation projection. Missing, extra, malformed, unsafe-URL and duplicate navigation values fail with 422. Phone and WhatsApp destinations use bounded international `+`-prefixed digits; optional values are stored as `null` after trimming.
7. The service opens one central transaction, locks and rechecks the actor, locks the singleton, reauthorizes the permission, compares `expectedRevision`, and updates settings and navigation atomically. A stale revision returns machine code `platform_settings_revision_conflict` with HTTP 409 and no mutation or audit event.
8. Normalized exact no-op updates return the current resource without incrementing the revision or writing an audit record. A real change increments the revision once and records `platform.settings.updated` in the same transaction. Audit values are allowlisted presentation fields only and contain no request body, secret, HTML or file content. Audit failure rolls back all changes.
9. A single `PlatformSettingsProvider` owns the in-memory public projection. It loads once per application boot through the typed API adapter with an AbortSignal/request generation so an old response cannot replace a newer saved projection. It does not persist settings in local storage and does not automatically replay writes. Successful administration save replaces the provider projection with the response from that same revision; explicit Reload can refetch it. Public responses use `Cache-Control: no-store`. A public read failure uses a conservative compiled presentation fallback with no announcement or support claim; it never blocks authentication, merchant operations or a published storefront.
10. The settings screen is a permission-owned `/admin/settings` section with its own protected projection and request generation. It has an explicit loading/error/forbidden state, grouped form, local preview, dirty-state protection, Save and Discard actions, and explicit 401/403/409/422/network handling. A 401 ends the administration session; a 403 clears the protected record/draft and hides controls; 5xx/network retains the current local draft with an honest error. A 409 preserves the local draft and offers an explicit server reload; it never overwrites or retries automatically. Dirty state is lifted to `App` and guards desktop/mobile section navigation, console exit, logout, browser `popstate` and `beforeunload`; cancelling a back navigation restores the current settings URL.
11. Saved identity is applied to the central landing header/copy/navigation, authentication presentation, merchant shell and platform console. The global attribution projection is applied to the public storefront footer. Commerce, tenant identity and merchant-owned workspace values remain unchanged.
12. Primary colour is a strict `#RRGGBB` value applied through platform-scoped CSS variables and accessible focus/accent surfaces. The server does not accept arbitrary CSS, class names or font imports. Contrast remains a frontend acceptance gate.
13. Logo upload/storage is not invented in this package. `logoUrl` is either `null` or a trimmed external HTTPS URL of at most 2048 characters, with a non-empty host, no credentials, fragment, backslash or control character. Reserved path checks repeatedly percent-decode and collapse dot segments before rejecting `/api/store-assets/`, `/api/catalog-media/` and the future-reserved `/api/platform-assets/` namespaces on every host. The original trimmed safe HTTPS URL is stored; a future central managed-asset package may replace it without changing the public DTO. Rendered logo images use `referrerPolicy="no-referrer"` and a textual/icon fallback.
14. Rollout order is migrate central schema and permission, run `IdentitySeeder`, deploy backend, then frontend. The migration inserts the exact deterministic snapshot below. Rollback first compares every settings value and all three navigation rows against that full snapshot, including revision and ordering; any difference refuses rollback. For an untouched snapshot it drops the deferred completeness trigger/function and navigation/settings tables, deletes the super-admin system-role permission pivot, refuses if any other pivot still references the permission, then deletes the permission. Reapply restores the identical snapshot and system-role assignment.

## Frozen central schema

`platform_settings` has exactly these columns:

| Column | PostgreSQL/Laravel shape | Constraint |
|---|---|---|
| `id` | unsigned small integer primary key | `id = 1` |
| `revision` | unsigned big integer, default `1` | `revision >= 1` |
| `platform_name` | varchar(80), not null | trimmed length 2–80 |
| `tagline` | varchar(160), nullable | null or trimmed length 2–160 |
| `logo_url` | varchar(2048), nullable | application canonical contract in decision 13 |
| `primary_color` | char(7), not null | uppercase `^#[0-9A-F]{6}$` |
| `landing_headline` | varchar(160), not null | trimmed length 10–160 |
| `landing_description` | varchar(500), not null | trimmed length 20–500 |
| `announcement_enabled` | boolean, not null, default false | enabled requires non-empty `announcement_text` |
| `announcement_text` | varchar(240), nullable | null or trimmed length 2–240 |
| `support_email` | varchar(254), nullable | null or lowercase RFC-shaped email |
| `support_phone` | varchar(16), nullable | null or `+` followed by 8–15 digits |
| `support_whatsapp` | varchar(16), nullable | null or `+` followed by 8–15 digits |
| `show_how_it_works` | boolean, not null, default true | — |
| `show_pricing` | boolean, not null, default true | — |
| `storefront_attribution_enabled` | boolean, not null, default true | enabled requires non-empty attribution text |
| `storefront_attribution_text` | varchar(180), nullable | null or trimmed length 2–180 |
| `updated_by_user_id` | nullable ULID FK to `users.id` | `nullOnDelete`; not in public projection |
| timestamps | timezone-aware `created_at`, `updated_at` | not null |

`platform_navigation_items` has `platform_setting_id` (unsigned small integer FK to settings with cascade on delete), `item_key` varchar(32), `label` varchar(40), `is_visible` boolean, and `position` unsigned small integer. Its primary key is `(platform_setting_id,item_key)`, `(platform_setting_id,position)` is unique, key is checked to the exact three-key allowlist, position is checked to 1–3, and label is trimmed length 2–40.

A PostgreSQL deferred constraint trigger validates at commit that every existing settings singleton has exactly the three allowlisted navigation keys and positions. Model/resource reads also fail closed with a server error if the three-key invariant is not present; they never substitute browser defaults for a corrupt administrative record.

## Public defaults

- Platform name: `مبتكر`
- Tagline: `منصة المتاجر الرقمية`
- Primary colour: `#0284C7`
- Landing headline: `أنشئ متجرك الإلكتروني بذكاء وسرعة`
- Landing description: `صمم هوية متجرك واختر قالبًا قابلًا للتخصيص، ثم أرسل طلبك للمراجعة والتجهيز قبل النشر.`
- Announcement and support destinations: disabled/empty
- How-it-works and pricing sections: visible
- Navigation order and labels: `templates` / `القوالب`, `how_it_works` / `كيف تعمل المنصة؟`, `pricing` / `الباقات والأسعار`; all visible
- Storefront attribution: enabled with `متجر إلكتروني مدعوم من منصة مبتكر.`
- Logo URL: `null`

## Consequences

- Platform identity becomes consistent, cross-device and controlled by a permissioned server workflow.
- Public pages can reflect a saved brand without exposing the administration record or infrastructure configuration.
- Optimistic revision and one transaction prevent silent last-write-wins loss across administrators.
- Navigation remains intentionally bounded; this is not a CMS, arbitrary page builder or remote-code mechanism.
- External logo hosting remains a known limitation until central managed platform assets are designed.

## Rejected alternatives

- **Browser/local-storage settings:** rejected because they are device-local, unaudited and do not affect other users.
- **One unvalidated JSON settings blob:** rejected because it allows unknown capability claims, weak migrations and accidental secret storage.
- **Environment variables for editable presentation:** rejected because every copy or colour change would require deployment and would not provide operator attribution.
- **Arbitrary navigation URLs/HTML/CSS:** rejected because it creates open-redirect, injection, content-safety and accessibility risks.
- **Secrets or plan editing in the same form:** rejected because their authorization, encryption, lifecycle and operational consequences require separate work packages.

## Required verification

- Prove the frozen columns/lengths/nullability/FKs, singleton, positive revision, fixed navigation keys/positions, deferred exact-three trigger and central-connection behavior in PostgreSQL.
- Prove migration defaults, untouched rollback/reapply, changed-data rollback refusal and permission seeding.
- Prove public central/tenant Host success, unknown/unready Host 404 and absence of administrative metadata.
- Prove admin 401/403/CSRF/422/throttle boundaries and permission-only console routing.
- Prove no-op, stale revision, two-writer race, actor permission/status race and audit-failure rollback.
- Prove unsafe logo URLs, extra fields, invalid contacts/colour and malformed navigation fail closed.
- Prove Abort/generation handling, public fallback, provider replacement after save, protected projection clearing, every dirty navigation boundary and explicit 409 recovery without mutation replay.
- Prove saved identity appears in the landing, auth, merchant/admin shells and storefront attribution while tenant store identity remains unchanged.
