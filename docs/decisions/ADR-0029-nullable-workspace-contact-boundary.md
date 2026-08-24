# ADR 0029 — Normalize nullable workspace contact at the typed client boundary

- Status: Accepted
- Date: 2026-08-24
- Work package: WP 5.17

## Context

The retained Pilot completed the full merchant lifecycle for a newly created store: submission, platform approval, tenant provisioning and publication. Opening any merchant module that depends on the shared workspace then failed with a client contract error. The authoritative workspace was healthy and revisioned, but the provisioning baseline stored `phone: null`, which is explicitly accepted by the server's nullable workspace contract. The TypeScript `StoreConfig` form model uses an empty string for an unfilled phone input, while its response mapper incorrectly required a string before the form model could be created.

## Decision

- The server contract remains nullable for optional contact fields.
- The typed workspace response boundary converts an absent or `null` phone to the form-safe empty string.
- A present non-string, non-null phone remains a fail-closed contract error.
- No database row is rewritten and no provisioning, tenant, authorization or publication behavior changes.
- Regression coverage must use the exact newly provisioned shape, including nullable hero fields and an empty catalog.

## Consequences

- Newly provisioned stores without a contact number can open products, inventory, design, checkout and content modules.
- The editor continues to expose a controlled string input and an empty value remains semantically equivalent to no phone.
- Malformed server values still fail closed; the change is normalization of an allowed nullable value, not broad coercion.

## Rollback

Deploy the prior web image. No database or backend rollback is required, although stores with a nullable phone will again fail to open shared workspace modules in that client.
