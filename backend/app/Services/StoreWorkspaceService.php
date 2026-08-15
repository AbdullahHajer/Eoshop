<?php

namespace App\Services;

use App\Enums\PermissionKey;
use App\Enums\SubscriptionStatus;
use App\Enums\TenantMembershipStatus;
use App\Exceptions\StoreWorkspaceConflict;
use App\Models\Plan;
use App\Models\PublicationRequest;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Support\TenantWorkspaceReadiness;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StoreWorkspaceService
{
    /** @return array{tenantId: string, revision: int, config: array<string, mixed>, updatedAt: ?string} */
    public function read(Tenant $tenant, User $actor): array
    {
        return $this->withLockedMembership($tenant, $actor, false, function (Tenant $lockedTenant): array {
            $this->assertReady($lockedTenant);

            return $lockedTenant->run(fn (): array => $this->composeSnapshot($lockedTenant));
        });
    }

    /** @return array{tenantId: string, revision: int, config: array<string, mixed>, updatedAt: ?string} */
    public function readPublic(Tenant $tenant): array
    {
        $this->assertReady($tenant);

        if (tenancy()->initialized && (string) tenant('id') === (string) $tenant->getKey()) {
            return $this->composeSnapshot($tenant);
        }

        return $tenant->run(fn (): array => $this->composeSnapshot($tenant));
    }

    /**
     * @param  array{revision: int, config: array<string, mixed>}  $payload
     * @return array{tenantId: string, revision: int, config: array<string, mixed>, updatedAt: ?string}
     */
    public function update(Tenant $tenant, User $actor, array $payload): array
    {
        return $this->withLockedMembership($tenant, $actor, true, function (Tenant $lockedTenant) use ($payload): array {
            $this->assertReady($lockedTenant);
            $limit = $this->lockedProductLimit($lockedTenant);
            $products = $payload['config']['products'];

            if ($limit !== null && count($products) > $limit) {
                throw new StoreWorkspaceConflict(
                    "The selected plan allows at most {$limit} products.",
                    'workspace_quota_exceeded',
                );
            }

            return $lockedTenant->run(function () use ($lockedTenant, $payload, $products): array {
                return DB::transaction(function () use ($lockedTenant, $payload, $products): array {
                    $record = $this->currentConfig(true);

                    if ((int) $record->revision !== (int) $payload['revision']) {
                        throw new StoreWorkspaceConflict(
                            'The store workspace changed on another device. Reload it before saving.',
                            'workspace_revision_conflict',
                        );
                    }

                    $this->replaceProducts($products);
                    DB::table('store_configs')->where('id', $record->id)->update([
                        'config_json' => json_encode(Arr::except($payload['config'], ['products']), JSON_THROW_ON_ERROR),
                        'revision' => (int) $record->revision + 1,
                        'products_materialized' => true,
                        'updated_at' => now(),
                    ]);

                    return $this->compose($lockedTenant);
                });
            });
        });
    }

    /** @param array<string, mixed> $config */
    public function initialize(string $configId, array $config): void
    {
        DB::transaction(function () use ($configId, $config): void {
            DB::table('store_configs')->where('is_current', true)->update(['is_current' => false]);
            $now = now();
            DB::table('store_configs')->updateOrInsert(
                ['id' => $configId],
                [
                    'config_json' => json_encode(Arr::except($config, ['products']), JSON_THROW_ON_ERROR),
                    'revision' => 1,
                    'products_materialized' => true,
                    'is_current' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            );
            $this->replaceProducts(is_array($config['products'] ?? null) ? $config['products'] : []);
        });
    }

    private function assertReady(Tenant $tenant): void
    {
        if (! TenantWorkspaceReadiness::check($tenant)) {
            throw new StoreWorkspaceConflict(
                'The tenant workspace is not ready for server-backed editing.',
                'workspace_not_ready',
            );
        }
    }

    private function lockedProductLimit(Tenant $tenant): ?int
    {
        $publication = PublicationRequest::query()
            ->whereKey($tenant->getAttribute('publication_request_id'))
            ->where('tenant_id', $tenant->getKey())
            ->lockForUpdate()
            ->first();
        if (! $publication instanceof PublicationRequest) {
            throw new StoreWorkspaceConflict('The store has no current publication request.', 'workspace_not_ready');
        }

        $subscription = TenantSubscription::query()
            ->whereKey($publication->getAttribute('tenant_subscription_id'))
            ->where('tenant_id', $tenant->getKey())
            ->lockForUpdate()
            ->first();
        if (! $subscription instanceof TenantSubscription) {
            throw new StoreWorkspaceConflict('The store has no server-owned product entitlement.', 'workspace_entitlement_unavailable');
        }

        $status = $subscription->getAttribute('status');
        $entitled = $status === SubscriptionStatus::PendingActivation
            || ($status === SubscriptionStatus::Active && $subscription->isCurrentlyActive());
        if (! $entitled) {
            throw new StoreWorkspaceConflict(
                'The selected product entitlement is not active or awaiting activation.',
                'workspace_entitlement_unavailable',
            );
        }

        $plan = Plan::query()->whereKey($subscription->getAttribute('plan_key'))->lockForUpdate()->first();
        if (! $plan instanceof Plan) {
            throw new StoreWorkspaceConflict('The selected product plan is unavailable.', 'workspace_entitlement_unavailable');
        }

        $limit = $plan->getAttribute('max_products');

        return $limit === null ? null : (int) $limit;
    }

    /**
     * Lock order is tenant, membership, publication request, subscription, plan, then tenant-schema rows.
     *
     * @template T
     *
     * @param  callable(Tenant): T  $operation
     * @return T
     */
    private function withLockedMembership(Tenant $tenant, User $actor, bool $write, callable $operation): mixed
    {
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        return $central->transaction(function () use ($central, $tenant, $actor, $write, $operation): mixed {
            $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
            $membership = $central->table('tenant_user')
                ->where('tenant_id', $lockedTenant->getKey())
                ->where('user_id', $actor->getKey())
                ->lockForUpdate()
                ->first();

            if ($membership === null || $membership->status !== TenantMembershipStatus::Active->value) {
                throw new AuthorizationException('The active tenant membership is required.');
            }
            if ($write && (! $actor->hasTenantPermission($lockedTenant, PermissionKey::TenantStoreManage)
                || ! $actor->hasTenantPermission($lockedTenant, PermissionKey::TenantProductsManage))) {
                throw new AuthorizationException('Both store and product management permissions are required.');
            }

            return $operation($lockedTenant);
        });
    }

    /** @return array{tenantId: string, revision: int, config: array<string, mixed>, updatedAt: ?string} */
    private function compose(Tenant $tenant): array
    {
        $record = $this->currentConfig();
        $config = json_decode((string) $record->config_json, true, 512, JSON_THROW_ON_ERROR);

        if ((bool) $record->products_materialized) {
            $config['products'] = DB::table('products')
                ->orderBy('position')
                ->orderBy('id')
                ->get()
                ->map(fn (object $product): array => [
                    'id' => (string) $product->id,
                    'name' => (string) $product->name,
                    'price' => (string) $product->price,
                    'description' => $product->description,
                    'category' => $product->category,
                    'imageKeyword' => $product->image_keyword,
                    'imageUrl' => $product->image_url,
                    'imageUrls' => $product->image_urls === null
                        ? null
                        : json_decode((string) $product->image_urls, true, 512, JSON_THROW_ON_ERROR),
                    'stockQuantity' => (int) $product->stock_quantity,
                    'manageStock' => (bool) $product->manage_stock,
                    'sku' => $product->sku,
                    'lowStockThreshold' => (int) $product->low_stock_threshold,
                ])
                ->all();
        } else {
            $config['products'] = is_array($config['products'] ?? null) ? $config['products'] : [];
        }

        return [
            'tenantId' => (string) $tenant->getKey(),
            'revision' => (int) $record->revision,
            'config' => $config,
            'updatedAt' => $record->updated_at === null ? null : (string) $record->updated_at,
        ];
    }

    /** @return array{tenantId: string, revision: int, config: array<string, mixed>, updatedAt: ?string} */
    private function composeSnapshot(Tenant $tenant): array
    {
        return DB::connection('tenant')->transaction(function () use ($tenant): array {
            DB::connection('tenant')->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

            return $this->compose($tenant);
        });
    }

    /** @param list<array<string, mixed>> $products */
    private function replaceProducts(array $products): void
    {
        $existing = DB::table('products')->get()->keyBy('id');
        $knownIds = $existing->keys()->all();
        DB::table('products')->delete();
        $now = now();

        foreach ($products as $position => $product) {
            $requestedId = $product['id'] ?? null;
            $id = is_string($requestedId) && Str::isUuid($requestedId) && in_array($requestedId, $knownIds, true)
                ? $requestedId
                : (string) Str::uuid();
            $sku = isset($product['sku']) && trim((string) $product['sku']) !== '' ? trim((string) $product['sku']) : null;

            DB::table('products')->insert([
                'id' => $id,
                'name' => $product['name'],
                'price' => (string) $product['price'],
                'description' => $product['description'] ?? null,
                'category' => $product['category'] ?? null,
                'image_keyword' => $product['imageKeyword'] ?? null,
                'image_url' => $product['imageUrl'] ?? null,
                'image_urls' => isset($product['imageUrls']) ? json_encode($product['imageUrls'], JSON_THROW_ON_ERROR) : null,
                'stock_quantity' => $product['stockQuantity'] ?? 10,
                'manage_stock' => $product['manageStock'] ?? true,
                'sku' => $sku,
                'low_stock_threshold' => $product['lowStockThreshold'] ?? 5,
                'position' => $position,
                'created_at' => $existing->has($id) ? $existing->get($id)->created_at : $now,
                'updated_at' => $now,
            ]);
        }
    }

    private function currentConfig(bool $lock = false): object
    {
        $query = DB::table('store_configs')->where('is_current', true);
        if ($lock) {
            $query->lockForUpdate();
        }

        $record = $query->first();
        if ($record === null) {
            throw new StoreWorkspaceConflict(
                'The tenant workspace has no current configuration record.',
                'workspace_not_ready',
            );
        }

        return $record;
    }
}
