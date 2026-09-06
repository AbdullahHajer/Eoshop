# Public checkout rollout and kill switch

## Purpose

`ORDER_CHECKOUT_ENABLED` is the global public-checkout kill switch. It is not a store setting and it is not a secret. The safe default remains `false`: published stores continue to load, while attempts to create new orders return `503` with `order_checkout_unavailable`.

The root Compose stack passes this value explicitly to `backend`, `worker` and `scheduler`. For that stack, the authoritative local or deployment value belongs in the root `.env`; changing only `backend/.env` does not override Compose.

Enabling the flag is necessary but not sufficient. `OrderReadiness` still requires the tenant schema and authoritative order tables to be operational.

## Enable checkout

1. Keep `ORDER_CHECKOUT_ENABLED=false` while deploying the new backend and completing central and tenant migrations.
2. Run the Repository, Frontend, Backend and Container integration gates on the release SHA.
3. Verify every store selected for launch is provisioned, published and passes order readiness.
4. Set `ORDER_CHECKOUT_ENABLED=true` in the deployment's root environment source. Do not commit the real deployment `.env`.
5. Recreate `backend`, `worker` and `scheduler` so they receive the new environment value.
6. Verify the effective Laravel configuration inside the recreated backend with `php artisan config:show orders`. Do not print the full process environment.
7. Submit one controlled canary order against a launch store. Confirm a single order, a single reservation and the same receipt on an idempotent retry.
8. Confirm the order appears in the merchant workspace before opening checkout to general traffic.

## Disable checkout safely

1. Set `ORDER_CHECKOUT_ENABLED=false` in the root deployment environment.
2. Recreate `backend`, `worker` and `scheduler`.
3. Confirm public storefront browsing still returns normally.
4. Confirm a new order submission returns `503 order_checkout_unavailable` and creates no order. When database inspection is available, additionally confirm that no order-owned reservation was created.
5. Existing orders remain in the merchant workflow; disabling new checkout does not delete or rewrite them.

## Verification evidence

- `scripts/ci/repository-gate.ps1` verifies that the explicit `false` in root `.env.example` and an explicit process-level `true` both propagate consistently to `backend`, `worker` and `scheduler`. The Compose file also retains `${ORDER_CHECKOUT_ENABLED:-false}` as its fail-safe fallback, but this assertion does not claim to exercise a completely absent variable.
- `StoreWorkspaceTest::test_checkout_flag_does_not_take_storefront_browsing_offline` verifies that browsing remains available, order submission returns `503 order_checkout_unavailable` and no order is created. It does not directly count reservation rows.
- Container integration runs with checkout enabled and verifies the server-authoritative order, inventory reservation and idempotency path.

## Failure response

If the canary fails, return the flag to `false` before investigation. Do not work around `order_checkout_unavailable` in the frontend, and do not enable checkout for a tenant that fails `OrderReadiness`.
