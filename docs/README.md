# Eoshop documentation index

## Governing documents

- [Architecture modernization plan](architecture-modernization-plan.md) — the phased delivery strategy and target architecture.
- [HTML architecture plan](architecture-modernization-plan.html) — formatted Arabic presentation of the same strategy.
- [Target architecture diagram](architecture-target.svg) — standalone architecture image used by the HTML and Markdown plans.

## Work packages

- [WP 0.1 — Baseline and repository hygiene](work-packages/WP-0.1-baseline.md)
- [WP 0.2 — Single application server](work-packages/WP-0.2-single-application-server.md)
- [WP 0.3 — CI and automated quality gates](work-packages/WP-0.3-ci-quality-gates.md)
- [WP 1.1 — Central identity model](work-packages/WP-1.1-central-identity.md)
- [WP 1.2 — Real authentication and sessions](work-packages/WP-1.2-authentication-and-sessions.md)

## Architecture decisions

- [ADR 0001 — Laravel is the single application server](decisions/ADR-0001-laravel-single-application-server.md)
- [ADR 0002 — Reproducible CI gates](decisions/ADR-0002-reproducible-ci-gates.md)
- [ADR 0003 — Central identity and scoped roles](decisions/ADR-0003-central-identity-and-role-scopes.md)
- [ADR 0004 — First-party same-origin session authentication](decisions/ADR-0004-first-party-session-authentication.md)

## Evidence

- [WP 0.1 verification — 2026-08-12](evidence/WP-0.1/verification-2026-08-12.md)
- [WP 0.2 verification — 2026-08-12](evidence/WP-0.2/verification.md)
- [WP 0.3 verification — 2026-08-12](evidence/WP-0.3/verification.md)
- [WP 0.3 branch-protection activation — 2026-08-12](evidence/WP-0.3/branch-protection.md)
- [WP 1.1 verification — 2026-08-12](evidence/WP-1.1/verification.md)

## Documentation rules

- A Work Package record is created before implementation begins.
- Each record contains scope, exclusions, acceptance criteria, risks, gates and evidence.
- Evidence records facts and command results; it does not claim checks that were not run.
- Architecture decisions that affect more than one Work Package are recorded as ADRs.
- Documentation is updated in the same Pull Request as the behavior it describes.
- Sensitive values must never appear in evidence or examples.
