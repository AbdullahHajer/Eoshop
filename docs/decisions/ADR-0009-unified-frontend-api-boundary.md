# ADR 0009 — Unified frontend API boundary

- Status: Accepted
- Date: 2026-08-15
- Work package: WP 3.1

## Context

The frontend already calls real Laravel endpoints, but transport concerns live in the authentication service. CSRF state, response parsing and errors are therefore coupled to authentication while administration, plans and provisioning import that implementation indirectly. Components also repeat loading and error handling, and raw response objects can flow directly into interface state.

## Decision

Use one same-origin JSON API client as the only owner of `fetch`, credentials, CSRF acquisition and normalized transport errors.

- Only root-relative paths are accepted; absolute and protocol-relative targets fail before network access.
- Mutations acquire a CSRF token through a single in-flight request shared by concurrent callers.
- A `419` response clears the token and replays the rejected request once. No other status or network failure is retried automatically.
- Errors are categorized as unauthenticated, forbidden, conflict, CSRF, validation, throttled, server, network, aborted or unexpected.
- Validation fields, retry timing and request correlation are structured metadata rather than component-specific parsing.
- `5xx` response text is not displayed as a trusted user message.
- Domain services map explicit DTO fields to interface models. Unknown response fields are discarded.
- Reusable React task state owns loading and normalized error. Retaining arguments for explicit retry is opt-in for safe reads or domain-proven idempotent operations; sensitive mutations do not retain arguments.
- Every logical request has a client request UUID that remains stable through a one-time `419` replay. Callers cannot replace protected transport headers.

The provisioning service continues to own its durable idempotency key because idempotency is a business-operation contract, not a generic transport retry policy.

## Consequences

Frontend behavior becomes consistent and future services have one tested integration boundary. Domain services remain small, and interface components do not need to understand Laravel response failure shapes.

The client remains intentionally lightweight and does not perform runtime schema validation for every field. Domain mapping plus TypeScript and contract tests provide the boundary for this phase; stronger schema generation can be adopted later if the API surface grows enough to justify it.

## Rejected alternatives

- Keep transport helpers inside `authApi`: preserves misleading ownership and coupling.
- Add automatic retry for `429` and `5xx`: unsafe for mutations unless each operation proves idempotency.
- Introduce a new request library: adds dependency and migration cost without solving domain mapping or retry policy.
