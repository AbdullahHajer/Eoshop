# WP 0.3 branch-protection evidence

| Field | Value |
|---|---|
| Date | 2026-08-12 |
| Repository | `sas-prog1/Eoshop` |
| Protected branch | `main` |
| Verified commit | `1f261207319d6662910f260b291093263f53feb6` |
| Verification result | Active |

## Activation sequence

1. [WP 0.2 PR 1](https://github.com/sas-prog1/Eoshop/pull/1) was merged into `main` with history preserved.
2. [WP 0.3 PR 2](https://github.com/sas-prog1/Eoshop/pull/2) was retargeted to `main`.
3. A new pull-request run passed all four gates against the new base.
4. PR 2 was merged and [CI run 31622453881](https://github.com/sas-prog1/Eoshop/actions/runs/31622453881) passed on `main`.
5. Branch protection was activated and read back through the GitHub API.

## Verified rules

- Pull requests are required; direct pushes are not an accepted change path.
- Pull requests currently require zero approvals because `sas-prog1` is the repository's only collaborator.
- Stale-approval dismissal remains enabled for the future multi-maintainer policy.
- Review conversations must be resolved before merge.
- Branches must be up to date before merging (`strict` status checks).
- Rules are enforced for repository administrators.
- Force pushes and branch deletion are disabled.

## Required checks

- `Repository safety`
- `Frontend quality`
- `Backend quality`
- `Container integration`

The API readback returned `protected: true` for `main`, all four check contexts, zero required approvals, administrator enforcement, and disabled force pushes and deletion. The pull-request requirement remains active; only the impossible independent-approval condition is disabled for the sole maintainer.

When another trusted collaborator receives write access, raise `required_approving_review_count` to one and enable `require_last_push_approval`.
