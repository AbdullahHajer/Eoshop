# Eoshop

Eoshop is an Arabic-first platform concept that helps small merchants create a digital storefront without the operational complexity of large e-commerce platforms. The product is especially oriented toward merchants in Yemen and similar markets where selling still starts primarily through social media and direct communication.

## Current status

The repository is an **advanced product prototype under stabilization**, not a production-ready commerce platform yet.

The current React interface supports real server-owned authentication, tenant provisioning, publication, store persistence, product catalog, inventory and order processing. The interface is still undergoing incremental usability and structural refinement, and local Pilot operation is not a claim of public production readiness. Use the [Pilot QA runbook](docs/qa/pilot-test-runbook.md) for the supported test journey and deliberate limitations.

## Modernization approach

Eoshop is improved incrementally. The existing product experience is preserved while simulated browser behavior is replaced with tested server-side operations.

```text
Phase
└─ Work Package
   ├─ Implementation
   ├─ Gates
   ├─ Evidence
   └─ Commit / PR / CI / Merge
```

T0–T5 is a quality and assurance layer inside every Work Package; it is not a separate phase.

Key records:

- [Architecture modernization plan](docs/architecture-modernization-plan.md)
- [Rendered HTML plan](docs/architecture-modernization-plan.html)
- [Target architecture diagram](docs/architecture-target.svg)
- [WP 0.1 baseline record](docs/work-packages/WP-0.1-baseline.md)
- [WP 0.2 single-server record](docs/work-packages/WP-0.2-single-application-server.md)
- [WP 0.3 CI and automated gates](docs/work-packages/WP-0.3-ci-quality-gates.md)

## Technology map

| Area | Technology | Responsibility |
|---|---|---|
| Web interface | React 19, TypeScript, Vite | Merchant, customer and platform interfaces |
| Frontend development | Vite | Frontend-only development server; proxies `/api` to Laravel |
| Application server | Laravel 12 | Single owner of API behavior and future business rules |
| Multi-tenancy | Stancl Tenancy | Tenant resolution and PostgreSQL schema isolation |
| Database | PostgreSQL | Central platform data and tenant operational data |
| Edge server | Nginx | Static assets and FastCGI gateway for `/api` and `/up` |
| AI assistance | Gemini | Store identity and content assistance behind Laravel |
| Local orchestration | Docker Compose | Reproducible Nginx, PHP-FPM and PostgreSQL runtime |

## Repository structure

```text
Eoshop/
├─ src/                 React application
├─ public/              Public web assets
├─ backend/             Laravel application
├─ docker/              PHP and Nginx container definitions
├─ docs/                Architecture and delivery documentation
├─ reports/             Existing assessment reports
├─ docker-compose.yml   Local service topology
└─ package.json         Frontend development and build scripts
```

## Prerequisites

The Docker path is the authoritative reproducible runtime. Running components directly on the host requires:

- PHP 8.4.1 or newer for Laravel;
- Node.js 22 and npm 10 or newer for Vite;
- Docker Compose for the containerized stack;
- a Gemini API key only when testing AI generation.

Do not place real credentials in committed files. Copy environment examples locally and supply secrets through the runtime environment or an approved secret store.

## Development

Frontend development:

```powershell
npm ci
npm run dev
```

Vite proxies `/api` to `VITE_API_BASE_URL`, which defaults to `http://localhost:8000`. Laravel remains the only application server.

Frontend gates:

```powershell
npm run check
npm run audit
```

Repository and container integration gates are documented in the [WP 0.3 record](docs/work-packages/WP-0.3-ci-quality-gates.md). Pull requests run four automated checks: repository safety, frontend quality, backend quality and container integration.

Containerized startup requires local, uncommitted environment files based on their examples:

```powershell
Copy-Item .env.example .env
Copy-Item backend/.env.example backend/.env
docker compose run --rm --no-deps backend php artisan key:generate --show
docker compose config --quiet
docker compose up --build
```

Copy the generated key into `APP_KEY` in the local `backend/.env` before starting the stack.

The web entry point defaults to `http://127.0.0.1:8000`. PostgreSQL and PHP-FPM are not published to the host.

## Safety rules

- Do not deploy the current prototype to the public internet.
- Do not use browser `localStorage` as the source of truth for users, stores or orders.
- Do not expose administration or tenant-write endpoints without server-side authentication and authorization.
- Do not trust totals, prices, discounts or stock values sent by the browser.
- Do not commit `.env`, runtime sessions, generated cache, dependencies or build output.
- Every change must belong to a defined Work Package and include gates and evidence.

## Immediate execution order

1. WP 0.3: add repeatable CI and quality gates.
2. Build real authentication and authorization.
3. Repair tenant provisioning and connect the existing interface to the API.
