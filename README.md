# Eoshop

Eoshop is an Arabic-first platform concept that helps small merchants create a digital storefront without the operational complexity of large e-commerce platforms. The product is especially oriented toward merchants in Yemen and similar markets where selling still starts primarily through social media and direct communication.

## Current status

The repository is an **advanced product prototype under stabilization**, not a production-ready commerce platform yet.

The current React interface demonstrates:

- merchant onboarding and store-template selection;
- AI-assisted store identity and starter-product generation;
- visual store customization and responsive preview;
- product, inventory, checkout and platform-admin experiences;
- a proposed subdomain and store-activation flow.

Some of these flows are currently simulated in the browser. Authentication, administration, store persistence, domain activation, checkout and order processing must not be treated as secure or production-capable until their corresponding modernization work packages are complete.

## Modernization approach

Eoshop will be improved incrementally. The existing product experience will be preserved while simulated browser behavior is replaced with tested server-side operations.

```text
Phase
└─ Work Package
   ├─ Implementation
   ├─ Gates
   ├─ Evidence
   └─ Commit / PR / CI / Merge
```

T0–T5 is a quality and assurance layer inside every Work Package; it is not a separate phase.

The full plan is available in:

- [Architecture modernization plan](docs/architecture-modernization-plan.md)
- [Rendered HTML plan](docs/architecture-modernization-plan.html)
- [Target architecture diagram](docs/architecture-target.svg)
- [WP 0.1 baseline record](docs/work-packages/WP-0.1-baseline.md)

## Current technology map

| Area | Current technology | Intended responsibility |
|---|---|---|
| Web interface | React 19, TypeScript, Vite | Merchant, customer and platform interfaces |
| Current preview server | Express | Legacy preview/development path to be removed as an application server |
| Target application server | Laravel | Authentication, authorization, business rules and API |
| Multi-tenancy | Stancl Tenancy | Tenant resolution and PostgreSQL schema isolation |
| Database | PostgreSQL | Central platform data and tenant operational data |
| Edge server | Nginx | Static assets and reverse proxy |
| AI assistance | Gemini | Store identity and content assistance behind Laravel |
| Local orchestration | Docker Compose | Development services; reproducibility will be repaired in WP 0.2 |

## Repository structure

```text
Eoshop/
├─ src/                 React application
├─ public/              Public web assets
├─ backend/             Laravel application skeleton
├─ docker/              PHP and Nginx container definitions
├─ docs/                Architecture and delivery documentation
├─ reports/             Existing assessment reports
├─ docker-compose.yml   Current local service topology
├─ package.json         Frontend and legacy preview scripts
└─ server.ts            Legacy Express preview/API path
```

## Local prerequisites

The declared toolchain currently expects:

- PHP 8.4 or newer;
- Node.js and npm compatible with the locked frontend dependencies;
- Docker Compose for the containerized path;
- a Gemini API key only when testing AI generation.

Do not place real credentials in committed files. Copy environment examples locally and supply secrets through the runtime environment or an approved secret store.

## Current development commands

These commands describe the current prototype and may remain incomplete until WP 0.2 finishes the reproducible toolchain.

```powershell
npm install
npm run dev
```

Frontend type checking:

```powershell
npm run lint
```

Compose configuration validation:

```powershell
docker compose config --quiet
```

The current Laravel dependencies require PHP 8.4.1 or newer. A host running an older PHP version cannot execute `artisan`, even if individual PHP files pass syntax checks.

## Safety rules

- Do not deploy the current prototype to the public internet.
- Do not use browser `localStorage` as the source of truth for users, stores or orders.
- Do not expose administration or tenant-write endpoints without server-side authentication and authorization.
- Do not trust totals, prices, discounts or stock values sent by the browser.
- Do not commit `.env`, runtime sessions, generated cache, dependencies or build output.
- Every change must belong to a defined Work Package and include gates and evidence.

## Immediate execution order

1. Complete WP 0.1: baseline, repository hygiene and evidence.
2. WP 0.2: establish Laravel as the single application server.
3. WP 0.3: add repeatable CI and quality gates.
4. Build real authentication and authorization.
5. Repair tenant provisioning and connect the existing interface to the API.

