# WP 0.3 — CI and automated quality gates

| Field | Value |
|---|---|
| Phase | Phase 0 — Baseline, governance and unified operation |
| Work Package | WP 0.3 |
| Status | Complete; gates passed and `main` protection active |
| Started | 2026-08-12 |
| Branch | `codex/wp-0.3-ci-gates` |
| Base dependency | WP 0.2 / `codex/wp-0.2-single-server` |
| ADR | [ADR 0002](../decisions/ADR-0002-reproducible-ci-gates.md) |

## Objective

Turn the manually verified WP 0.2 gates into repeatable pull-request checks that fail closed, use committed lock files, exercise the production container path and produce evidence that can be reviewed before merge.

## Scope

- Add a least-privilege GitHub Actions workflow for pull requests and `main`.
- Pin Actions to full commit SHAs and scanner images to immutable digests.
- Add repository hygiene and workflow syntax gates.
- Add Gitleaks full-history secret scanning with redacted output.
- Add a minimal React unit test and Laravel feature tests.
- Add Laravel Pint and Larastan checks.
- Add npm and Composer vulnerability audits.
- Build both production images with GitHub Actions cache.
- Start an isolated Compose stack and execute clean system migrations.
- Smoke-test `/`, `/up` and the `/api` boundary through Nginx.
- Provide local scripts that run the same repository and integration gates.
- Record branch-protection requirements and activation order.

## Out of scope

- Fixing authentication, authorization or exposed administration routes (Phase 1).
- Repairing tenant provisioning or executing tenant migrations (Phase 2).
- Replacing frontend browser simulations (Phase 3).
- Full end-to-end browser testing.
- Deployment, image publication or production secrets.
- Automatically merging WP 0.2 or WP 0.3 without explicit owner approval.

## T0 — Baseline observations

- No `.github/workflows` directory exists.
- No frontend or backend application tests exist.
- PHPUnit is referenced only by dependency metadata and is not a direct development dependency.
- PHP formatting exists through Laravel Pint, but no static-analysis tool is configured.
- WP 0.2 container and smoke gates were manual and are recorded only as evidence.
- The repository has no dedicated secret scanner.
- `main` cannot safely require the new checks until the workflow itself is merged.

## T1 — Design

### Gate graph

```text
Repository safety ─┐
Frontend quality  ─┼─> Container integration
Backend quality   ─┘
```

The three fast gates run independently. The container integration gate starts only after they pass, preventing expensive image builds when a fast deterministic check has already failed.

### Toolchain decisions

| Tool | Baseline |
|---|---|
| Node | `22.23.1` through pinned `actions/setup-node` |
| React tests | Vitest with server-side React rendering |
| PHP tests | PHPUnit 11.5 |
| PHP formatting | Laravel Pint, test mode |
| PHP analysis | Larastan 3.x / PHPStan level 5 |
| Secret scan | Gitleaks `v8.30.1` image digest |
| Workflow lint | actionlint `1.7.12` image digest |
| Container cache | Docker Buildx GitHub Actions cache |

### CI security boundaries

- Workflow-level `contents: read` permission only.
- No production secret is required.
- Test credentials are ephemeral, explicit non-production values.
- No image is pushed and no deployment occurs.
- Secret scanner output is fully redacted.
- Pull-request code never receives a privileged token from this workflow.

### Rollback

Revert the WP commit. If branch protection has already been activated after merge, remove the four WP 0.3 required check names before reverting the workflow to avoid locking `main`.

## Acceptance criteria

- [x] Workflow syntax passes actionlint.
- [x] Workflow uses least privilege and immutable Action/image references.
- [x] Repository hygiene and Gitleaks gates pass.
- [x] Frontend locked install, TypeScript, React tests, build and audit pass.
- [x] Composer validation/install/audit pass.
- [x] Pint and Larastan pass without an ignored-error baseline.
- [x] Laravel feature tests pass.
- [x] Production backend and web images build through Buildx.
- [x] System migrations run against a clean PostgreSQL volume.
- [x] HTTP smoke tests pass through the single Nginx entry point.
- [x] Temporary containers and volumes are removed even after failure.
- [x] Local commands are documented and use the same scripts.
- [x] Evidence records exact local and GitHub results.
- [x] Required branch-protection check names and activation sequence are documented.
- [x] `main` protection is active and independently verified after merge.

## Local execution

Run the fast repository gate:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ci/repository-gate.ps1
```

After building `eoshop/backend:ci` and `eoshop/web:ci`, run the same isolated migration and HTTP gate used by GitHub Actions:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/ci/integration-gate.ps1 -ProjectName eoshop-ci-local
```

The script owns only the supplied Compose project name and removes its temporary containers, network and volumes in a `finally` block.

## Evidence

- [Local verification — 2026-08-12](../evidence/WP-0.3/verification.md)
- [Branch-protection activation — 2026-08-12](../evidence/WP-0.3/branch-protection.md)
- [GitHub Actions run 31620260312](https://github.com/sas-prog1/Eoshop/actions/runs/31620260312)
