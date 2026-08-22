# WP 5.12 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.12 — Platform settings, branding and landing navigation |
| Status | Complete and merged |
| Verified | 2026-08-22 |
| Branch | `codex/wp-5.12-platform-settings` |
| Base | `040c8a0` |
| Implementation commit | `e457cadcb78704ddc6d27a66ae1556079d3722f5` |

## Delivered product boundary

- Added a central, typed and revisioned settings singleton plus an exact three-item navigation contract with deterministic defaults.
- Added `platform.settings.manage`, seeded only for the system super-admin, and permission-owned public/admin APIs on explicit Host boundaries.
- Added locked actor reauthorization, optimistic revision conflict handling, exact no-op behavior and atomic redacted audit.
- Added `/admin/settings` with a focused editor, safe preview, explicit 409 recovery and dirty-state protection across section navigation, exit, logout, browser history and unload.
- Added one typed public settings provider and applied server-owned identity, landing copy, fixed navigation, support details and storefront attribution without mutating tenant-owned store identity.
- Kept authentication, merchant operations and storefront availability independent of the public presentation endpoint through conservative in-memory defaults.

## Independent review

- The independent review challenged authorization races, singleton/navigation integrity, rollback refusal, public Host behavior, dirty conflict recovery, late responses, unsafe preview rendering and cross-runtime URL parsing.
- Unsafe logo validation now fails closed for malformed UTF-8, malformed percent escapes, nested encoding, reserved managed-asset paths, credentials, fragments and non-HTTPS schemes in both PHP and TypeScript.
- The final nested-percent finding (`%25zz` and deeper encodings) was fixed by validating every decode layer and the post-limit value, with regression coverage proving 422 and no mutation/audit.
- Final independent read-only verdict: **APPROVE**, with no blocking findings.

## Focused verification

- Focused frontend settings gate: **4 files / 11 tests passed**.
- The two platform-settings PostgreSQL classes contribute **12 focused test methods** to the complete database gate.
- Covered safe public mapping, provider replacement/late-response handling, editor save/no-op/conflict behavior, unsafe preview rejection, dirty browser boundaries, two writers, actor-status serialization and destructive rollback refusal.

## Frontend quality gate

- TypeScript/Vite production build: PASS.
- Vitest: **41 files / 229 tests passed**.
- Locked frontend dependency audit: **0 vulnerabilities**.
- The existing production chunk-size warning remains non-blocking and is retained for route-level performance hardening.

## Backend quality gate

- Composer validation and locked dependency audit: PASS; no advisories.
- Laravel Pint: **253 files passed**.
- Larastan: **217 files / no errors**.
- Backend unit suite: **3 tests / 6 assertions passed**.

## Repository and container integration gates

- `scripts/ci/repository-gate.ps1`: PASS.
- `git diff --check`: PASS; the PowerShell LF/CRLF notice is non-blocking.
- Isolated PostgreSQL/container integration: **150 tests / 1,513 assertions passed**.
- Covered system and tenant migration rollback/reapply/adoption including `2026_08_22_000012`, route cache, central/published-tenant/unknown Host behavior, live authentication, settings CSRF and throttle boundaries, scheduler and database worker.
- The isolated project `eoshop-wp512-final2` used local port `18114` and removed its containers, network and volumes after success; the merchant Pilot stack was not reset or mutated.

## Product handoff and retained debt

- Authorized platform managers can now change the public platform identity, landing presentation, fixed navigation and public support details from a real server-owned workspace.
- Central managed logo upload, favicon/image processing and storage ownership remain deferred; the current optional logo accepts a validated external HTTPS URL only.
- Infrastructure secrets and controls for SMTP, WhatsApp, payments, storage, queue, cache, databases and DNS/TLS remain deliberately outside the browser.
- Plan pricing/entitlements, feature flags, arbitrary CMS pages, custom HTML/CSS/scripts, translation management, SEO automation and analytics remain separate future packages.
- Broader browser/device accessibility acceptance and route-level bundle splitting remain product-hardening work after this functional administration sequence.

## Delivery status

- Implementation is recorded separately in `e457cadcb78704ddc6d27a66ae1556079d3722f5`.
- Evidence is recorded separately in `55711890ca00742f2c56fbde5a4980ca4ccf0f9c`.
- Pull request [#48](https://github.com/sas-prog1/Eoshop/pull/48) was merged from final head `55711890ca00742f2c56fbde5a4980ca4ccf0f9c`.
- Pull-request CI run [32580887602](https://github.com/sas-prog1/Eoshop/actions/runs/32580887602) passed all four required jobs: Repository safety, Backend quality, Frontend quality and Container integration.
- Merge commit: `ad0a210b9f09f4487d3ea936f473b75a284a26d7`.
- Protected-main CI run [32581245406](https://github.com/sas-prog1/Eoshop/actions/runs/32581245406) passed the same four required jobs after merge.
