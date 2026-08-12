# WP 0.1 — Baseline and repository hygiene

| Field | Value |
|---|---|
| Phase | Phase 0 — Baseline, governance and unified operation |
| Work Package | WP 0.1 |
| Status | Complete |
| Started | 2026-08-12 |
| Completed | 2026-08-12 |
| Behavioral change | None intended |

## Objective

Protect the existing Eoshop prototype before architectural repairs begin by documenting its current state, defining repository hygiene, excluding sensitive/generated material, and producing evidence that can be attached to the first baseline commit.

## Scope

- Document the product's current engineering status without overstating production readiness.
- Create a discoverable documentation index.
- Strengthen `.gitignore` for secrets, dependencies, build output and Laravel runtime files.
- Standardize text and binary handling through `.gitattributes`.
- Record the current toolchain and validation constraints.
- Prepare the evidence required for a baseline commit.

## Out of scope

- Changing application behavior.
- Reading or modifying the contents of `backend/.env`.
- Removing generated or local dependency directories from the workstation.
- Choosing or implementing the final Laravel/Node architecture; that is WP 0.2.
- Adding authentication, tenant provisioning, API integration or order logic.
- Writing to Git metadata outside `Eoshop`.

## T0 — Scope and baseline

### Observed project shape

- React/Vite frontend under `src/`.
- Laravel skeleton under `backend/`.
- Docker Compose services for PHP-FPM, Nginx, PostgreSQL and PgBouncer.
- Two current AI/API paths: Express in `server.ts` and Laravel in `backend/`.
- Existing architecture plan and diagram under `docs/`.

### Current local/generated material

The following paths were observed by name only and were not opened as part of the sensitive-file check:

- `backend/.env` — present; contents not read.
- `node_modules/` — present.
- `backend/vendor/` — present.
- `dist/` — present.
- `backend/storage/framework/sessions/` — present.
- `backend/bootstrap/cache/` — present.

Their presence on a developer workstation is not by itself a defect. They must not enter the repository baseline.

### Source metrics at start

- Relevant source/config files counted: 33.
- Approximate source/config size: 709,885 bytes.
- Largest frontend files:
  - `src/components/ControlPanel.tsx`: 3,515 lines.
  - `src/components/StorePreview.tsx`: 3,304 lines.
  - `src/App.tsx`: 2,051 lines.
  - `src/components/AdminDashboard.tsx`: 1,053 lines.

Metrics are evidence for later incremental decomposition; they are not acceptance targets for WP 0.1.

## T1 — Design

### Repository hygiene policy

The root `.gitignore` is the single policy for the current project tree. It excludes:

- real environment files while preserving `.env.example` files;
- private keys and local certificates;
- JavaScript/PHP dependency directories;
- frontend build and test output;
- Laravel sessions, compiled views, cache and logs;
- editor and operating-system files.

`.gitattributes` standardizes source text to LF while preserving Windows command scripts as CRLF and marking binary assets explicitly.

### Rollback

This Work Package changes documentation and repository-control files only. Rollback consists of reverting those files after a baseline commit exists. No database or runtime migration is involved.

## T2 — Implementation

- Expanded `.gitignore` with categorized rules.
- Added `.gitattributes`.
- Added `.editorconfig` to prevent new encoding, line-ending and trailing-whitespace drift.
- Added root `README.md` describing the current prototype honestly.
- Added `docs/README.md` as the documentation index.
- Added this Work Package record.
- Initialized an independent Git repository inside `Eoshop` on branch `main`.
- Connected `origin` to `https://github.com/sas-prog1/Eoshop.git` after confirming the remote had no branches or commits.

## T3 — Verification

### Checks completed

| Check | Result |
|---|---|
| Docker Compose syntax (`docker compose config --quiet`) | Passed |
| Current PHP syntax check | 18 application/configuration PHP files passed; no syntax failures |
| Staged whitespace check | Existing baseline contains legacy trailing whitespace; recorded and accepted without mass-formatting |
| Project-local `AGENTS.md` instructions | None found |
| Root `.gitignore` exists | Passed |
| Sensitive/generated path names inventoried without opening `backend/.env` | Passed |
| Existing architecture SVG XML structure | Passed in prior documentation delivery |
| Arabic documentation encoding/mojibake check | Passed in prior documentation delivery |

### Environment constraints

- Host PHP detected: 8.3.28.
- Installed Laravel dependencies require PHP 8.4.1 or newer, so `artisan` cannot be executed on the current host PHP.
- `node` and `npm` were not available on the current command path, so TypeScript/build checks could not be rerun in this Work Package.
- Docker Compose configuration parsed successfully. Docker daemon execution was not required for WP 0.1.

These constraints are recorded as evidence, not treated as application defects. Reproducible toolchain repair belongs to WP 0.2/WP 0.3.

## T4 — Operational gate

| Gate | State | Evidence / action |
|---|---|---|
| No application behavior changed | Passed | Only documentation, `.gitignore` and `.gitattributes` changed |
| Real environment files excluded | Passed by rule | `.env` patterns exclude root and nested real environment files |
| Dependencies/build/runtime files excluded | Passed by rule | Node, PHP, dist and Laravel runtime patterns added |
| Baseline can be committed without files outside project scope | Passed | Independent `.git` initialized inside `Eoshop`; `origin` configured |
| Working tree clean after baseline commit | Passed | Local `main` clean and tracking `origin/main` |

## T5 — Release evidence

### Files delivered

- `.gitignore`
- `.gitattributes`
- `.editorconfig`
- `README.md`
- `docs/README.md`
- `docs/work-packages/WP-0.1-baseline.md`
- `docs/evidence/WP-0.1/verification-2026-08-12.md`

### Verification evidence

- [Verification record — 2026-08-12](../evidence/WP-0.1/verification-2026-08-12.md)

### Completed release actions

1. Created baseline commit `c38c34a0cf29700ca5510d8fc363aa0b1bf21291`.
2. Pushed `main` to `origin` at `https://github.com/sas-prog1/Eoshop.git`.
3. Verified the remote `refs/heads/main` SHA exactly matched the local SHA.
4. Verified local `main` tracks `origin/main` with no uncommitted application changes after the baseline commit.

## Acceptance criteria

- [x] Current state is documented accurately.
- [x] No production-readiness claim is made.
- [x] Sensitive and generated path classes are ignored.
- [x] Documentation is indexed.
- [x] No application behavior was intentionally changed.
- [x] Repository boundary is explicitly decided.
- [x] Proposed tracked files pass the baseline secret-signature check.
- [x] Baseline commit exists and is present on the remote.
- [x] Equivalent baseline checks are recorded; automated CI creation remains WP 0.3.

## Exit decision

WP 0.1 is complete. WP 0.2 may now begin the controlled removal of the Node/Laravel application-server duplication.
