# Eoshop documentation index

## Governing documents

- [Architecture modernization plan](architecture-modernization-plan.md) — the phased delivery strategy and target architecture.
- [HTML architecture plan](architecture-modernization-plan.html) — formatted Arabic presentation of the same strategy.
- [Target architecture diagram](architecture-target.svg) — standalone architecture image used by the HTML and Markdown plans.

## Work packages

- [WP 0.1 — Baseline and repository hygiene](work-packages/WP-0.1-baseline.md)
- [WP 0.2 — Single application server](work-packages/WP-0.2-single-application-server.md)
- [WP 0.3 — CI and automated quality gates](work-packages/WP-0.3-ci-quality-gates.md)

## Architecture decisions

- [ADR 0001 — Laravel is the single application server](decisions/ADR-0001-laravel-single-application-server.md)
- [ADR 0002 — Reproducible CI gates](decisions/ADR-0002-reproducible-ci-gates.md)

## Evidence

- [WP 0.1 verification — 2026-08-12](evidence/WP-0.1/verification-2026-08-12.md)
- [WP 0.2 verification — 2026-08-12](evidence/WP-0.2/verification.md)
- [WP 0.3 verification — 2026-08-12](evidence/WP-0.3/verification.md)

## Documentation rules

- A Work Package record is created before implementation begins.
- Each record contains scope, exclusions, acceptance criteria, risks, gates and evidence.
- Evidence records facts and command results; it does not claim checks that were not run.
- Architecture decisions that affect more than one Work Package are recorded as ADRs.
- Documentation is updated in the same Pull Request as the behavior it describes.
- Sensitive values must never appear in evidence or examples.
