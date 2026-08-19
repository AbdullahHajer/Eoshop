# WP 5.4 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.4 — Merchant portal and store lifecycle |
| Status | Implementation verified; delivery pending |
| Verified | 2026-08-19 |
| Branch | `codex/wp-5.4-merchant-portal` |
| Base | `50600c2169addf12bfd6c9d929f15e16ee313ca8` |
| Implementation commit | `fce2e63b2248ffd3c37015ba957371f243f5e561` |

## Delivered product boundary

- A route-owned merchant application at `/app`, with owned `/app/new` and `/app/stores/{tenant}/design` routes.
- Deterministic session/login restoration into the merchant portal, including a visible retry state for temporary recovery errors and fail-closed logout behavior for an expired session.
- An account summary, multi-store selection, lifecycle timeline, truthful next action and responsible party.
- Server-confirmed published-link copy/open actions; requested and internal domains are never presented as live links.
- Merchant-safe `reviewFeedback`, lifecycle timestamps and explicit per-membership capability projection.
- A full-workspace editor boundary that requires the combined server policy; narrower staff permissions are visible without escalating access.
- A shared `workspace_not_ready` publication blocker derived from the same materialized-workspace invariant enforced by publication.
- A central-host routing guard that keeps tenant public Hosts in the storefront shell.

## Independent review

- The first read-only review identified five blockers: recovery error routing, incomplete workspace readiness, capability-blind builder access, an unowned `/app/new` path and ambiguous rejection-reason exposure.
- All five were corrected in the server projection, shared readiness contract, route ownership and merchant interface.
- The exact-image integration run then exposed one stale test fixture that claimed runtime readiness without a materialized current config. The fixture was corrected without weakening production readiness.
- Final independent read-only verdict: **APPROVE**, with no blocking findings.

## Frontend quality gate

Environment: pinned `node:22.23.1-alpine3.24` through the Docker `frontend-quality` target.

- TypeScript check and Vite production build: PASS.
- Vitest: **25 files / 135 tests passed**.
- Covered merchant lifecycle derivation, malformed projections, capability-limited staff, portal empty/error/rejected/published states, `/app/new`, exact design restoration and dirty-workspace navigation.
- `npm audit --audit-level=high`: **0 vulnerabilities**.

## Backend quality gate

Environment: `eoshop/backend-quality:wp54`, built from the current working tree.

- Composer validation and locked dependency audit: PASS.
- Laravel Pint: **190 files passed**.
- Larastan: **161 files / no errors**.
- Backend unit suite: **3 tests / 6 assertions passed**.

## Repository and container integration gates

- `scripts/ci/repository-gate.ps1`: PASS.
- `git diff --check`: PASS.
- Exact images: `eoshop/backend-quality:wp54`, `eoshop/backend:wp54` and `eoshop/web:wp54`.
- PostgreSQL/container integration: **97 tests / 941 assertions passed**.
- Covered merchant review feedback, owner/staff capabilities, materialized-workspace publication refusal, central/tenant context restoration, migrations, populated rollback/reapply, route cache, HTTP/Host boundaries, database worker and scheduler checks.
- Integration project `eoshop-wp54-pass` and only its network/volumes were removed after the successful run.

## Product handoff

- Human Pilot acceptance remains intentionally paused; automated protection gates remain mandatory.
- WP 5.5 receives server-owned draft/correction/resubmission and merchant publication/unpublication.
- The platform administration console, account/team/billing surfaces and deeper builder decomposition remain separate work packages.

## Delivery status

- Implementation is recorded separately in `fce2e63b2248ffd3c37015ba957371f243f5e561`.
- Evidence commit, pull request, protected CI and merge facts will be appended only after they exist.
