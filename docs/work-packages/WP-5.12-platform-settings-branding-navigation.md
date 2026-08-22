# WP 5.12 — Platform settings, branding and landing navigation

| Field | Value |
|---|---|
| Phase | Phase 5 — Product experience and incremental frontend decomposition |
| Work Package | WP 5.12 |
| Status | Implementation complete; delivery in progress |
| Started | 2026-08-22 |
| Branch | `codex/wp-5.12-platform-settings` |
| Base | Protected `main` at `040c8a0` |
| Dependencies | WP 1.1–1.3; WP 3.1–3.3; WP 5.10–5.11 |
| Decision | [ADR 0024](../decisions/ADR-0024-server-owned-platform-settings-and-branding.md) |

## Objective

Give an authorized platform manager a real server-owned settings workspace for the platform identity, safe public support details, landing presentation and fixed navigation while keeping secrets, infrastructure and tenant-owned store configuration outside the browser.

## Baseline

- The administration console has durable stores, users and audit sections but no settings section.
- Platform identity is hardcoded inconsistently as `Eoshop` and `مبتكر` across the landing page, merchant portal, administration console and storefront attribution.
- Landing copy/navigation and public support destinations have no server source, policy, revision or audit history.
- `platform_super_admin` has operational permissions, but no dedicated settings permission exists.
- Merchant store branding is already server-owned and must remain isolated from global platform presentation.

## Scope

- Add a central typed settings singleton and fixed navigation item records with deterministic defaults.
- Add and seed `platform.settings.manage` for the platform super-admin only.
- Add safe public settings and protected administration read/update APIs.
- Add locked optimistic update, exact no-op behavior and atomic redacted audit.
- Add permission-owned `/admin/settings` navigation and a focused settings editor with preview and dirty-state protection.
- Apply saved settings to the landing, authentication, merchant and platform shells plus public storefront attribution.
- Remove conflicting hardcoded public platform names/copy where the new projection is authoritative.
- Preserve platform availability with a conservative frontend fallback when the public presentation endpoint is unavailable.

## Out of scope

- SMTP, WhatsApp provider, payment, storage, queue, cache, database, DNS/TLS or other infrastructure secrets/configuration.
- Plan prices, entitlements, quotas, feature flags or subscription policy editing.
- Arbitrary pages, HTML, CSS, JavaScript, URLs or navigation destinations.
- Central managed logo/file upload, favicon generation or image processing.
- Tenant/store branding, theme, content or checkout settings.
- Translation management, multi-language CMS, SEO automation or analytics scripts.
- Deployment, maintenance mode, backup, monitoring or destructive data controls.

## Safety and product invariants

- The server is the sole authority; the browser never stores authoritative settings in local storage.
- Public output is allowlisted presentation data and contains no actor, audit, timestamps, environment or secret fields.
- Only `platform.settings.manage` authorizes administration reads/writes and section entry; role names never authorize.
- Every write uses exact optimistic revision and one central transaction with locked actor reauthorization.
- Settings and all three navigation items change atomically; stale or malformed writes have no side effects.
- Exact no-op does not increment revision or create an audit event.
- Plain text only; no user-supplied HTML, scripts, CSS or arbitrary route/URL destinations.
- Optional logo is external HTTPS only; `data:`, `blob:`, scheme-relative, credentialed, fragmented and reserved managed-asset URLs fail closed.
- Global platform presentation never mutates or overrides tenant store identity/configuration.
- Public endpoint availability cannot block authentication, merchant operations, order processing or storefront loading.
- 401, 403, 409, 422, throttle, network and server failures stay distinct; no mutation is automatically retried.
- Rollback compares the complete deterministic settings/navigation snapshot and cannot silently discard an operator or direct-SQL modification.

## T0–T5

### T0 — Contract and baseline

- [x] Inventory hardcoded platform identity, current admin permissions/routes and missing settings persistence.
- [x] Draft ADR 0024 typed fields, public projection, authorization, concurrency and rollout boundaries.
- [x] Complete independent design review and freeze the contract before migration work.

### T1 — Central model and APIs

- [x] Add the frozen settings/navigation schema, deferred exact-three invariant, deterministic defaults and safe permission migration.
- [x] Add central models, policy, public/admin resources and closed validation.
- [x] Add locked revision service with no-op and atomic audit behavior.
- [x] Add public known-Host and protected central admin routes.

### T2 — Administration and product application

- [x] Add `/admin/settings` permission routing and focused editor/preview.
- [x] Add App-owned dirty section/exit/logout/popstate/unload protection and explicit conflict recovery.
- [x] Add one provider-owned typed public-settings adapter, abort/generation protection and conservative in-memory fallback.
- [x] Apply saved identity/navigation/copy to central shells and storefront attribution without changing tenant identity.

### T3 — Verification

- [x] Cover schema constraints, migration adoption/rollback/reapply and central connection after tenancy.
- [x] Cover public central/tenant/unknown Host behavior and safe projection.
- [x] Cover admin permission, session, CSRF, throttle, validation and audit boundaries.
- [x] Cover no-op, stale revision, two writers, permission/status race and audit rollback.
- [x] Cover frontend late-response/fallback/provider refresh, permission loss, every dirty navigation boundary, 409 recovery and no mutation replay.
- [x] Cover saved branding/navigation across landing, auth, merchant/admin shells and storefront attribution.

### T4 — Gates

- [x] Pass focused frontend and PostgreSQL tests.
- [x] Obtain final independent implementation review after focused gates are green.
- [x] Pass frontend/backend quality, repository safety and isolated full container integration.

### T5 — Evidence and delivery

- [x] Record exact evidence and retained managed-logo/secrets/plans/CMS debt.
- [x] Commit implementation and evidence separately.
- [ ] Push, open PR, pass required CI, merge and record protected-main facts.

## Acceptance criteria

- A settings-only operator can enter `/admin/settings` but cannot read stores, users or audit without their permissions.
- Reviewer, merchant and guest requests cannot read the admin settings record or mutate it.
- An authorized manager sees the exact saved server projection, previews edits and saves one atomic revision.
- Two managers editing the same revision produce one winner and one explicit 409 without silent overwrite.
- A real change is attributable in audit; a no-op, rejected or failed change produces no success audit.
- Public settings load on the central application and exact published tenant Hosts, while unknown/unready Hosts fail closed.
- Saved platform name, tagline, landing text/navigation and optional announcement/support values appear only where configured.
- Saved platform branding appears in the auth, merchant and admin shells; storefront attribution changes globally without changing the merchant's store name, logo or theme.
- Unsafe URLs/content and unsupported settings fields are rejected and never rendered.
- Losing permission or session clears the protected settings projection; network/5xx retains the local unsaved draft with an honest error.
- Dirty settings cannot be discarded through section navigation, exit, logout or unload without an explicit confirmation.
- No infrastructure secret, plan editor, arbitrary page/CSS/HTML or tenant-setting control appears in the interface.

## Rollback

Drain writes, deploy the frontend without the settings section/public dependency, then roll back the backend routes/service. The central migration compares the complete settings row and all three navigation rows with the frozen default snapshot and refuses on any difference. For an untouched snapshot it removes the exact-three trigger/function and tables, removes the system super-admin pivot, verifies no remaining role references and removes the permission. The compiled conservative fallback keeps the platform usable throughout rollback.
