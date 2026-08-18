# Eoshop Pilot QA runbook

## Purpose

This runbook starts testing before the visual interface is considered complete. QA should report functional, state, validation and usability problems while engineering continues the remaining frontend work packages.

The Pilot is suitable for registration, store submission, administrative review, asynchronous provisioning, publication, server-owned customization, product add/edit/archive, inventory adjustment and order-flow exploration. It is not a production launch environment.

## 1. Prepare the local Pilot

Prerequisites:

- Docker Desktop with Compose available.
- PowerShell 7 or Windows PowerShell 5.1.
- Ports and credentials dedicated to local testing.

Create the ignored environment files once:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
```

Set the same non-placeholder PostgreSQL password in both files. If `APP_KEY` is empty, the preparation script generates it once inside the ignored `backend/.env`; reruns preserve it. Do not send either value in a defect report.

Run preparation and enter the administrator password only at the secure interactive prompt:

```powershell
./scripts/qa/prepare-pilot.ps1 -AdminEmail 'qa.admin@eoshop.local'
```

Do not assign the plaintext password in a command copied into PowerShell history. The prompt does not echo the value, and the script removes its temporary process variable in `finally`.

The script uses `lvh.me` as the Pilot wildcard base domain and first verifies that a subdomain resolves to `127.0.0.1`. It starts `db`, `backend` and `web`, applies central migrations, seeds identity roles, verifies migration-owned plans, migrates existing active tenant schemas, provisions the administrator, then starts `worker` and `scheduler`. It verifies health and never prints the password. The password environment variable is removed from the PowerShell process in `finally`.

Entry points:

- Merchant application: `http://127.0.0.1:8010/`
- Administration: `http://127.0.0.1:8010/admin`
- Health: `http://127.0.0.1:8010/up`

The default Compose project is `eoshop-pilot`, so its containers and PostgreSQL volume remain isolated from an existing `eoshop` local stack. Preparation never resets either project implicitly.

## 2. Test identities and data rules

- Use the prepared administrator only for review/provisioning/publication actions.
- Every tester creates a new merchant through the real registration screen.
- Use a unique email and handle per run, for example `qa+<tester>-<date>@example.test` and `qa-<tester>-<date>`.
- Never paste passwords, session cookies, CSRF tokens, reset tokens, private customer data or `.env` contents into screenshots or issues.
- Record the visible store/tenant ID, public hostname and request ID when available.

## 3. Minimum acceptance journey

### A. Account registration and session

1. Open the merchant application in a private browser window.
2. Register a new merchant with valid name, email and password.
3. Reload the page and confirm the authenticated session is restored.
4. Log out, verify protected merchant data disappears, then log in again.

Expected: no simulated identity or browser-only account is accepted as server identity.

### B. Draft, customization and store submission

1. Enter the initial business name/type.
2. Select a template and change at least: store name, colors, logo/contact field and one visible text section.
3. Open the publish/submission action.
4. Select the starter plan and a unique available handle.
5. Submit once, then reload and confirm the pending store remains visible.

Expected: submission is pending; it must not claim that provisioning or publication completed instantly.

### C. Administration and asynchronous provisioning

1. Sign out and log in at `/admin` with the prepared QA administrator.
2. Find the pending store and approve it.
3. Refresh and observe `queued` or `provisioning`, followed by `active` after the worker completes.
4. Confirm the starter subscription is active and publication blockers are empty.
5. Publish the store.

Expected: every state change is explicit. A failure exposes retry/error state without deleting the submission or tenant.

### D. Server-owned workspace and products

1. Return to the merchant account and select the approved active store.
2. Reload and confirm the server workspace opens.
3. Add a product with a unique SKU, valid name and price; save.
4. Set the product status to published, save and confirm it appears on the public tenant Host.
5. Edit its name, price and another supported field; save, reload and confirm both merchant and public values changed.
6. Use the product removal action, save and confirm it disappears from the public tenant Host.

Expected: removal archives the product; it is not a hard database deletion. Archived/draft products must not appear as publicly purchasable products.

### E. Customization persistence

1. Change theme colors, store text and contact information in the active server workspace.
2. Save, reload and verify the exact saved result.
3. Open a second private browser, log in with the same merchant and verify the same server state.
4. If a revision conflict is deliberately produced, verify that recovery does not silently overwrite the other browser's changes.

### F. Public store

After publication, the default Pilot URL is `http://<handle>.lvh.me:8010/`. The preparation script fails unless the wildcard hostname resolves to loopback, and the administration link preserves the configured Compose port. For an offline network where `lvh.me` cannot resolve, arrange an exact approved local DNS/hosts mapping and pass the matching `-TenantBaseDomain`; do not change application data to bypass hostname routing.

Verify:

- public store loads only after publication;
- saved branding/text appears;
- published products appear with server-derived price and availability;
- archived/draft products do not appear;
- internal configuration, permissions and inventory reservation counts are not exposed.

## 4. Supported “delete” meaning

For the Pilot, merchant product deletion means **archive**. This preserves order, inventory and audit history. Hard deletion of products, tenants or tenant schemas is not a QA operation and is not exposed as a convenience action.

## 5. Deliberate Pilot limitations

- The visual design and navigation are still being improved.
- External email delivery is not configured; password-reset mail uses the development log transport.
- Real payment collection, bank verification and electronic gateways are not enabled.
- Social-platform publishing/advertisement linkage is future work.
- Public DNS/TLS and internet hosting are outside this local Pilot package.
- AI generation needs a valid provider key; its absence must not block manual store creation/customization.

## 6. Reporting defects

Open a GitHub issue using the **Pilot defect** form. One issue should describe one reproducible problem. Attach sanitized screenshots and the minimum relevant network status/code. Mark data-loss, cross-tenant exposure, authentication bypass, wrong price or overselling as critical immediately.

## 7. Stop and resume

Stop services without deleting Pilot data:

```powershell
docker compose -p eoshop-pilot stop
```

Resume without rebuilding:

```powershell
./scripts/qa/prepare-pilot.ps1 -SkipBuild
```

Do not run `docker compose down --volumes` unless the Pilot database is intentionally being discarded.
