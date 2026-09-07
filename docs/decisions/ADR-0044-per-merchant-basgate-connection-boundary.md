# ADR 0044 — Per-merchant BasGate connection boundary

- Status: Proposed; provider-independent connection slice ready for review, while BasGate runtime activation remains blocked by the remaining provider addendum
- Date: 2026-09-07
- Depends on: ADR 0005, ADR 0009, ADR 0014 and ADR 0042

## Context

Eoshop already owns catalog eligibility, pricing, orders, inventory reservations and guest fulfillment on the server. Payment remains limited to cash on delivery and unverified manual transfers. The V1 commercial decision is that each store receives money through its own BasGate account; Eoshop coordinates the integration and must not become the merchant of record or receive card, wallet-secret, PIN or OTP data.

The supplied BasGate documentation establishes OAuth client credentials, a signed transaction-initiation call, a transaction-status lookup and a `trxToken`. The provider subsequently supplied a sandbox API origin and a hosted Web payment origin. The hosted page is reachable over HTTPS and reads `trxToken` and language from its query, but its return, cancellation, callback and browser-message contracts remain undocumented. BasGate still has not established a webhook contract, idempotency, money precision, complete states or production-safe refund behavior. The official Laravel package is configured as one application-wide account and therefore cannot define Eoshop's tenant boundary.

## Decision

### Package boundary

WP 5.29A owns only the central merchant-to-provider connection and its redacted merchant view. WP 5.29B will own tenant payment sessions, provider transactions, payment events, reconciliation and customer checkout after the remaining provider contract is available.

An active connection never changes an order, commits inventory or proves payment. The online-payment option remains unavailable until both the connection is active and the WP 5.29B runtime declares the selected environment ready. COD and the existing manual methods remain independent.

### Central ownership and isolation

Connection records live only in the central database because they bind a central tenant identity to external credentials. They never enter `StoreConfig`, a tenant workspace JSON document, onboarding snapshots, public storefront projections, browser storage or queue payloads.

Central migration `000017` is reserved for this package. Tenant migration `000011` remains reserved for WP 5.30A, and tenant migration `000012` remains reserved for the later payment lifecycle.

The proposed central aggregate is one BasGate connection per tenant. Its environment is replaced explicitly rather than represented by a second simultaneously usable connection, so the merchant and runtime never have to infer which record is authoritative:

| Field | Contract |
|---|---|
| `id` | UUID primary key |
| `tenant_id` | Central tenant FK; unique with provider |
| `provider` | Closed value `basgate` |
| `environment` | Eoshop-owned closed value `sandbox | production`; the adapter maps it to BasGate's confirmed environment name and URL |
| `state` | `draft | verification_pending | active | verification_failed | disabled` |
| `revision` | Positive monotonic integer |
| `credential_revision` | Positive monotonic version of the encrypted bundle; a verification result must match it |
| `verified_credential_revision` | Nullable version proven by the last successful verification |
| `credential_ciphertext` | Application-encrypted, versioned provider bundle |
| `credential_key_version` | Non-secret key/version metadata for controlled rotation |
| `account_reference_digest` | Keyed blind index of the canonical provider account identifier; never the secret or a plain SHA-256 of a low-entropy identifier |
| `last_verification_code` | Closed, redacted Eoshop result code only |
| `last_verification_attempt_at` | Nullable server timestamp |
| `last_verified_at` | Nullable server timestamp |
| `disabled_at` | Nullable server timestamp consistent with state |
| actor/timestamps | Creator/updater user IDs and database timestamps |

`unconfigured` is a derived API state when no row exists. The exact fields inside the encrypted provider bundle remain provider-versioned and are not fixed in a database column per secret. Bundle version 1 contains the four provider-issued values `clientId`, `clientSecret`, `appId` and `merchantKey`. The project owner confirmed that every store has an independent provider account; the provider still needs to identify which non-secret account field is canonical for duplicate-binding prevention.

The blind-index key is separate from the database and from the credential encryption material. A uniqueness constraint may prevent one provider account from being attached to multiple stores only after BasGate identifies the canonical account field and confirms that reuse is invalid.

### Lifecycle

Saving initial connection material produces `draft`, increments the revision and invalidates any cached token. It does not imply that verification is running, and no credential-save response claims that the account works. `verification_pending` may be entered only when a real, provider-approved verification operation has been durably claimed and scheduled or dispatched.

`active` may be entered only by a documented BasGate verification procedure that proves both authentication and merchant/account binding without charging money or creating an uncontrolled transaction. A token request alone proves only part of the credential set and is insufficient unless BasGate confirms otherwise.

A deterministic credential rejection produces `verification_failed`. A network timeout, `429` or provider `5xx` must not become `verification_failed` or `active`; the verification operation records a sanitized transient outcome and returns the connection to `draft` unless a later provider-backed retry contract is accepted. `disabled` blocks all new online sessions without deleting transaction history or re-enabling itself automatically.

Replacement and rotation of an already active credential bundle remain provider-dependent. The implementation must preserve the last verified active bundle until a candidate is verified or require an explicit disable; it must never overwrite a working secret and leave the row falsely `active`. The final candidate schema and transition are part of the BasGate addendum.

There is no physical delete, automatic production activation or browser-controlled state transition in V1. Revocation and eventual credential destruction require a provider-confirmed procedure and retention decision before implementation.

### Authorization, concurrency and audit

- Reads require active exact-tenant membership. Writes require `tenant.store.manage`; the service rechecks the actor and permission under the central tenant/membership lock.
- Platform staff do not receive merchant secrets through platform-store permissions. A future support action may see only the same redacted state unless a separate break-glass decision is accepted.
- Mutations require a UUID `Idempotency-Key`, an `expectedRevision` (`0` for initial creation), a canonical fingerprint and a durable sanitized replay result. Same key/same fingerprint replays; same key/different fingerprint returns `409 payment_connection_idempotency_conflict`.
- Central migration `000017` therefore includes a `payment_connection_operations` ledger keyed by tenant, actor, operation kind and idempotency key. Its request fingerprint is a keyed HMAC over the canonical secret-bearing request, never a plain digest that could aid guessing, and its stored replay response is the redacted Eoshop resource only. Each receipt stores the fingerprint-key version used to produce it.
- Lock order is central tenant, active membership/permission, connection operation claim, then connection row. No provider network call occurs while these locks or a database transaction are held.
- Audit events contain tenant, actor, provider, environment, previous/new redacted state, revision, request ID and occurrence time. They never contain credentials, access tokens, signatures, `trxToken`, full provider bodies or exception text returned by BasGate.

### Secret and transport handling

- Secrets are accepted only over authenticated same-origin HTTPS in production, immediately encrypted, and never returned. A secret replacement is write-only; UI hints may reveal at most a non-sensitive provider account label explicitly approved by BasGate.
- Sandbox credentials supplied out of band are test material only. Their literal values never enter source, fixtures, documentation, command lines or evidence, and they must be rotated before any production use when they have appeared in a conversational channel.
- Decrypted material exists only in the backend process for the scoped operation. It is not serialized into jobs; a job carries the connection ID and reloads/decrypts after reauthorization and state checks.
- Credential encryption and request-fingerprint keys are independent versioned key rings with no `APP_KEY` or development fallback. An encryption key remains available until every row using it is rewrapped. A fingerprint key remains available for the entire lifetime of every idempotency receipt using its version; removing it requires an explicit receipt migration or retention decision and otherwise fails closed.
- Access tokens are cached by connection ID, environment and credential revision, with a safety margin below `expires_in`; they are never shared across stores or logged.
- The adapter uses strict connect/read timeouts, bounded retries only for proven-safe reads, TLS verification and an allowlisted base URL selected from server configuration rather than merchant input.
- Amounts remain integer minor units inside Eoshop. Conversion to BasGate's `amount.value` is forbidden until currency precision and provider units are confirmed; binary floats do not cross the adapter boundary.

### Adapter boundary

Provider-specific code is isolated behind an Eoshop-owned adapter. The official package and its public source may be used as reference, but are not installed or invoked in this package. In particular, Eoshop does not adopt application-wide `.env` credentials, raw request/response logging, per-call token renewal or README success parsing.

The adapter contract is split by capability so unresolved payment behavior does not contaminate account connection:

- `PaymentConnectionVerifier`: provider-approved non-monetary credential/account verification.
- `PaymentSessionGateway`: initiate and query, introduced only in WP 5.29B.
- `PaymentEventVerifier`: webhook verification, introduced only after the webhook addendum.
- `RefundGateway`: omitted from V1 unless a later accepted decision adds a complete refund contract.

Every BasGate response is parsed into a closed Eoshop DTO and unknown fields are discarded. A successful HTTP response or top-level `status=1` is not payment success. WP 5.29B may classify payment as paid only after authenticated server-to-server evidence with `paymentStatus=1202`, matching tenant connection, order reference, amount and currency.

### Redacted HTTP resource

The stable redacted read shape is:

```json
{
  "data": {
    "provider": "basgate",
    "environment": "sandbox",
    "state": "draft",
    "revision": 1,
    "canAcceptOnlinePayments": false,
    "lastVerificationCode": null,
    "lastVerifiedAt": null,
    "updatedAt": "2026-09-07T00:00:00Z"
  }
}
```

`GET /api/merchant/stores/{tenant}/payment-connections/basgate` returns this shape or an `unconfigured` projection with `environment: null`, `state: "unconfigured"`, `revision: 0` and nullable timestamps. It uses `Cache-Control: no-store` and never returns an internal connection ID, credential presence flags per field, encrypted values, account digests or provider payloads.

The authenticated merchant configuration endpoint is fixed as `PUT /api/merchant/stores/{tenant}/payment-connections/basgate`. It requires a UUID `Idempotency-Key` and this closed body:

```json
{
  "expectedRevision": 0,
  "environment": "sandbox",
  "credentials": {
    "appId": "write-only",
    "merchantKey": "write-only",
    "clientId": "write-only",
    "clientSecret": "write-only"
  }
}
```

The server trims only the two UUID identifiers. It treats `merchantKey` and `clientSecret` as literal opaque values, bounds them, and rejects Unicode control, formatting, separator and other invisible characters rather than silently rewriting a secret. Unknown fields are rejected, the bundle is encrypted immediately, and the response is the redacted `draft` resource. It does not expose per-field presence and does not mark the connection verified. The verification endpoint and disconnect/revocation semantics remain deliberately uncommitted until BasGate documents a non-monetary verification operation and lifecycle.

Closed connection error codes reserved by T1 are:

- `payment_connection_unavailable`
- `payment_connection_revision_conflict`
- `payment_connection_idempotency_conflict`
- `payment_connection_state_conflict`
- `payment_connection_operation_in_progress`
- `payment_connection_account_unavailable`
- `payment_connection_validation_failed`
- `payment_connection_credentials_required`
- `payment_connection_environment_invalid`
- `payment_connection_verification_required`
- `payment_connection_verification_failed`
- `payment_provider_unavailable`
- `payment_provider_contract_invalid`

Generic `401`, `403`, `419`, `422` and `429` keep the existing API error contract.

## Provider addendum required before runtime work

The following remain blocking decisions, not implementation details:

1. the non-monetary verification operation, canonical provider account identifier, credential rotation and revocation rules;
2. the hosted page's confirmed required query fields, return/cancel behavior, allowed return origins and whether `postMessage` is a supported public contract;
3. webhook events, verification, replay identity, retry policy and acknowledgement contract;
4. `orderId` idempotency, token/session expiry and the complete status table;
5. currency precision, amount units, limits, fees and rate limits;
6. canonical request/response signature test vectors and timestamp rules;
7. refund/void/cancel operations and late-success behavior.

## Consequences

- A compromised or mistaken store credential cannot be selected for another tenant through shared process configuration.
- Connection management can progress without making browser redirects or provider callbacks a source of truth.
- WP 5.30A can continue independently because it owns no central payment tables, payment routes or payment UI.
- Product implementation pauses at a narrow boundary rather than encoding assumptions that later require data migration or unsafe compatibility behavior.

## Rejected alternatives

- One BasGate account in global `.env`: rejected because each store must receive into its own account and tokens would cross tenant scope.
- Store secrets in workspace JSON or tenant schema: rejected because public/config projections and tenant jobs have broader exposure than the central credential boundary.
- Install the official SDK unchanged: rejected because its singleton configuration and logging behavior do not meet the multi-tenant secrecy contract.
- Treat the SDK return or browser redirect as paid: rejected because BasGate itself requires a server-to-server truth check.
- Mark a connection active after merely saving fields: rejected because persistence is not provider verification.
- Build a credential form from the current examples: rejected until BasGate confirms whether those four credentials belong to every independent merchant.
- Add refunds now because the SDK names a method: rejected because the endpoint has no complete public contract, states or idempotency rules.

## Verification and rollback

The WP 5.29A connection slice proves two-store isolation, exact membership and write permission, write-only secrets, encrypted-at-rest content, sanitized API/audit/replay paths, revision conflicts, no-op behavior, first-writer and same-key idempotency races, multi-version key rotation, tamper failure, literal opaque-secret validation and destructive-rollback refusal. Repository, frontend, backend and PostgreSQL container gates run without any BasGate network call or real staging credential. Token-cache separation, provider timeout behavior, verification/disable transitions, transaction sessions and event handling remain WP 5.29B obligations after the provider addendum.

Rollback before connection rows exist is ordinary code/schema rollback. Once encrypted connection material or audit provenance exists, destructive down migration refuses; operational rollback disables online-payment capability, retains the redacted aggregate and deploys a forward fix. Rollback never restores older credentials or writes them to logs.
