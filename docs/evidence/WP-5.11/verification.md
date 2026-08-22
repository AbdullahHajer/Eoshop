# WP 5.11 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.11 — Platform user lifecycle and role assignment |
| Status | Complete and merged |
| Verified | 2026-08-22 |
| Branch | `codex/wp-5.11-platform-user-lifecycle` |
| Base | `8188c82` |
| Implementation commit | `17f3bb9b2d20731a60788593b06dc2ed2dbe021d` |

## Delivered product boundary

- Added a permission-owned `/admin/users` workspace with server-side search, exact status filtering, bounded pagination, invitation, role replacement, suspension and guarded reactivation.
- Added central policies, requests, resources and lifecycle/read services; every listed or mutated target is an existing platform operator and no merchant identity can be silently promoted.
- Added passwordless pending invitations through Laravel's broker without accepting, returning, logging or auditing a password or token.
- Added exact optimistic role/status preconditions, self-mutation protection and a locked last-effective-manager invariant.
- Made suspension global and atomic across reset tokens, database sessions, remember state and the checked `session_generation` credential epoch.
- Replaced the previous reset callback with a locked reset matrix that activates only a valid pending platform invitation and never reactivates a suspended identity.
- Extended the integration gate to roll back and reapply the session-generation migration explicitly.

## Independent review

- The independent review challenged timing enumeration, stale-session resurrection, cross-scope permissions, lifecycle lost updates, reset-token races, invitation ABA transitions and protected frontend state.
- Reset-link creation now happens under the lifecycle lock while external notification occurs after commit; notification failure removes only the token owned by that dispatch.
- Invitation dispatch captures both `session_generation` and its raw in-process token; stale reconciliation removes only that exact token and cannot delete a newer dispatch token after suspend → pending ABA.
- Platform user resources expose a server-owned `resumeStatus` and only an active-membership count, so the browser does not infer credential lifecycle from email verification or receive tenant membership details.
- The administration adapter is injected from the console shell into the users panel, preserving the existing leaf-component dependency boundary.
- Final independent read-only verdict: **APPROVE**, with no blocking findings.

## Focused verification

- PostgreSQL lifecycle and concurrency gate: **19 tests / 159 assertions passed**.
- Covered passwordless invitation and activation, exact-token cleanup, forgot/reset-versus-suspend races, role/status stale writes, two-manager concurrency, late database-session reinsertion, remember-cookie generation binding, audit rollback and database constraints.
- Focused frontend regression gate: **4 files / 40 tests passed**.
- Covered the users panel, adapter architecture boundary and the two previously slow interface/storefront orchestration paths; both timing failures from the earlier parallel run passed in isolation and again in the complete suite.

## Frontend quality gate

- TypeScript/Vite production build: PASS.
- Vitest: **37 files / 216 tests passed**.
- Locked frontend dependency audit: **0 vulnerabilities**.
- Covered permission-derived `/admin/users` routing, list/filter states, invitation truthfulness, stale conflict recovery, session expiry, global-suspension confirmation and serialized mutations.
- The existing large production chunk warning remains non-blocking and is retained for route-level performance hardening.

## Backend quality gate

- Laravel Pint: **239 files passed**.
- Larastan: **205 files / no errors**.
- Backend unit suite: **3 tests / 6 assertions passed**.

## Repository and container integration gates

- `scripts/ci/repository-gate.ps1`: PASS.
- `git diff --check`: PASS; the existing PowerShell LF/CRLF notice is non-blocking.
- Isolated PostgreSQL/container integration: **138 tests / 1,415 assertions passed**.
- Covered system and tenant migration rollback/reapply/adoption including `2026_08_21_000011`, route cache, live Host/authentication/CSRF/permission boundaries, scheduler and database worker.
- The isolated project `eoshop-wp511-integration` used local port 18091 and removed its containers, network and volumes after success; the merchant Pilot stack was not reset or mutated.

## Product handoff and retained debt

- Authorized platform managers can now invite and govern platform operators without exposing credentials, adopting merchant accounts or risking silent last-manager removal.
- The local Pilot still has no external SMTP delivery proof; the interface reports broker acceptance, throttling or failure and never claims delivery.
- Hard deletion/restoration, email reassignment, custom roles, raw permission editing, impersonation, MFA, SSO and device/session administration remain outside WP 5.11.
- Tenant staff and membership administration remains a separate merchant-team package.
- Writable platform settings, branding, navigation, feature flags, plan editing and secret management remain deferred until their schemas, policies and audit contracts are designed.
- Broader responsive, accessibility and browser acceptance plus route-level bundle splitting remain product-hardening work after the functional administration sequence.

## Delivery status

- Implementation is recorded separately in `17f3bb9b2d20731a60788593b06dc2ed2dbe021d`.
- Evidence is recorded separately in `0949e46618f203378d3827765791f2fbceeabd06`.
- Pull request [#46](https://github.com/sas-prog1/Eoshop/pull/46) was merged from final head `0949e46618f203378d3827765791f2fbceeabd06`.
- Pull-request CI run [32560333237](https://github.com/sas-prog1/Eoshop/actions/runs/32560333237) passed all four required jobs: Repository safety, Backend quality, Frontend quality and Container integration.
- Merge commit: `c6232050121e215361d0e4f30a25b1813463b5e1`.
- Protected-main CI run [32560626924](https://github.com/sas-prog1/Eoshop/actions/runs/32560626924) passed the same four required jobs after merge.
