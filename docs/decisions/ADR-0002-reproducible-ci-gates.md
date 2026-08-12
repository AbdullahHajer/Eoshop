# ADR 0002 — Reproducible CI gates

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-12 |
| Decision owners | Eoshop engineering |
| Related work package | WP 0.3 |

## Context

WP 0.2 established a reproducible application runtime, but its gates were run manually. Without an automated pull-request workflow, a later change can bypass TypeScript, PHP, dependency, migration, secret and container checks or execute a materially different command in CI than developers use locally.

The repository currently has no GitHub Actions workflow, no application test suite, no PHP static-analysis configuration and no dedicated secret scanner.

## Decision

Eoshop uses one GitHub Actions workflow with four required logical gates:

1. **Repository safety:** workflow linting, repository invariants and full-history secret scanning.
2. **Frontend quality:** locked install, TypeScript, React unit tests, production build and dependency audit.
3. **Backend quality:** locked Composer install, formatting, Larastan, PHPUnit and dependency audit.
4. **Container integration:** cached production image builds, clean PostgreSQL startup, system migrations and HTTP smoke tests through Nginx.

Commands are exposed through committed npm/Composer scripts and repository PowerShell scripts so the same gates can be run locally and by GitHub-hosted runners.

Third-party and official Actions are pinned to full commit SHAs. Tool containers used directly by the workflow are pinned to immutable image digests. Workflow permissions default to read-only repository contents.

## Required check names

- `Repository safety`
- `Frontend quality`
- `Backend quality`
- `Container integration`

After this workflow exists on `main`, branch protection must require all four names and at least one approving review before merging. Protection is intentionally activated only after the workflow is present on `main`; enabling it earlier would block the prerequisite WP 0.2 pull request because that branch cannot emit the new checks.

## Migration boundary

CI executes central/system migrations against a new PostgreSQL volume. Tenant migrations are syntax/static-analysis checked but are not executed until tenant provisioning is repaired in Phase 2, where a real tenant lifecycle can supply the required database context.

## Consequences

### Positive

- Pull requests receive fast, separately attributable failures.
- Production containers and local gate commands use the same lock files.
- Secrets are scanned across Git history with redacted output.
- Central migrations are proved against a clean PostgreSQL instance.
- Docker layer caching limits repeated CI build cost.

### Trade-offs

- The first uncached PHP container build is relatively expensive.
- Dependency audits can expose upstream advisories that require an explicit remediation decision.
- Branch protection remains a post-merge repository setting and cannot be fully expressed by a workflow file alone.

## Rollback

Revert the WP 0.3 commit and remove the four required status checks from branch protection before removing the workflow. No application or database behavior is changed by the rollback itself.

## Authoritative references

- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub secure use of third-party actions](https://docs.github.com/en/actions/reference/security/secure-use)
- [Docker Buildx Action](https://github.com/docker/setup-buildx-action)
- [Larastan](https://github.com/larastan/larastan)
- [Gitleaks](https://github.com/gitleaks/gitleaks)
