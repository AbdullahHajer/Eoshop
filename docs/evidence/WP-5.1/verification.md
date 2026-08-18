# WP 5.1 verification evidence

| Field | Value |
|---|---|
| Work Package | WP 5.1 — Frontend application shell decomposition |
| Branch | `codex/wp-5.1-frontend-feature-shell` |
| Base | `dcbb63c8819197f04d2fede566bfd2e9646694ab` |
| Verification date | 2026-08-18 |
| Status | Local gates passed; PR delivery pending |

## Implemented boundaries

- `src/app/AppToast.tsx` owns the application notification viewport.
- `src/app/appTypes.ts` owns the application view contract.
- `src/app/hostRouting.ts` owns exact central-host classification.
- `src/features/storefront/PublicStorefrontScreen.tsx` owns public storefront success/error rendering.
- `src/features/store-builder/WorkspaceRecoveryOverlays.tsx` owns conflict, manual-review and local-draft recovery prompts.
- `src/App.tsx` composes these boundaries and fell from 2,513 to 2,382 lines without changing the builder, admin or storefront layout.

## Frontend gate

Command:

```text
docker build --target frontend-quality --tag eoshop/frontend-quality:wp51-final --file docker/nginx/Dockerfile .
```

Result:

- TypeScript: PASS.
- Production Vite build: PASS.
- Vitest: **20 files, 95 tests passed**.
- New shell characterization: **10 tests passed**.
- Existing storefront orchestration and checkout characterization: PASS.
- Output: `index-BRej5hwM.js` 799.19 kB / 205.83 kB gzip; the existing large-chunk warning remains visible and is a later Phase 5 concern.

Dependency audit:

```text
docker run --rm eoshop/frontend-quality:wp51 npm run audit
```

- `npm audit --audit-level=high`: **0 vulnerabilities**.

## Backend quality gate

Command:

```text
docker run --rm eoshop/backend-quality:ci sh -lc "composer validate --strict --no-check-publish && composer audit --locked && composer check"
```

Result:

- Composer validation and locked audit: PASS, no advisories.
- Laravel Pint: PASS, 187 files.
- Larastan: PASS, 159 files, no errors.
- Non-database PHPUnit: **3 tests, 6 assertions passed**.

## Repository safety gate

Command:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ci/repository-gate.ps1
```

Result: **Repository gate passed**; tracked-file, single-server, dependency and Compose invariants remained valid.

## Container integration gate

Command:

```text
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ci/integration-gate.ps1 -ProjectName eoshop-wp51-local -Port 18080
```

Result:

- PostgreSQL PHPUnit: **91 tests, 858 assertions passed**.
- Central and tenant migration, rollback/reapply, route-cache and HTTP/Host checks: PASS.
- Scheduler and worker service checks: PASS.
- Clean teardown removed containers, network and volumes.

## Review finding and closure

The independent reviewer found no production-code drift but blocked the first review because safe reapply, manual conflict review, and local-draft guards lacked direct tests. The test suite was expanded from 5 to 10 application-shell tests to cover:

- safe reapply only after the server copy has loaded;
- archive/discard actions for manually conflicting fields;
- local-draft import blocked during conflict, loading and saving.

Final independent verdict: **APPROVE**, with no blocking findings remaining.

## Rollback observation

No backend or database files changed. Reverting the frontend extraction restores the inline JSX and host helper in `App.tsx`; it does not modify tenant data, server contracts, browser drafts or migrations.

## GitHub delivery

- Implementation commit: `b70f29f` (`refactor(wp5.1): extract frontend application shell`).
- Pull request: pending.
- Required pull-request checks: pending.
- Merge commit and protected-main checks: pending.
