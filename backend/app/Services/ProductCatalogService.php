<?php

namespace App\Services;

use App\Enums\PermissionKey;
use App\Enums\ProductMediaSource;
use App\Enums\ProductStatus;
use App\Enums\SubscriptionStatus;
use App\Enums\TenantMembershipStatus;
use App\Exceptions\InventoryConflict;
use App\Exceptions\ProductCatalogConflict;
use App\Models\Plan;
use App\Models\PublicationRequest;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Support\CatalogMoney;
use App\Support\ProductCatalogContract;
use App\Support\TenantWorkspaceReadiness;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductCatalogService
{
    public function __construct(private readonly InventoryLedgerService $inventory) {}

    /** @return array{tenantId: string, revision: int, currencyCode: string, products: list<array<string, mixed>>} */
    public function read(Tenant $tenant, User $actor): array
    {
        return $this->withLockedMembership($tenant, $actor, false, function (Tenant $lockedTenant) use ($actor): array {
            $this->assertReady($lockedTenant);

            $catalog = $lockedTenant->run(function () use ($lockedTenant): array {
                return DB::connection('tenant')->transaction(function () use ($lockedTenant): array {
                    DB::connection('tenant')->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

                    return $this->compose($lockedTenant, false, true);
                });
            });

            $catalog['products'] = $this->projectProductsForActor($catalog['products'], $lockedTenant, $actor);

            return $catalog;
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{tenantId: string, revision: int, currencyCode: string, products: list<array<string, mixed>>}
     */
    public function update(Tenant $tenant, User $actor, array $payload): array
    {
        return $this->withLockedMembership($tenant, $actor, true, function (Tenant $lockedTenant) use ($actor, $payload): array {
            $this->assertReady($lockedTenant);
            $limit = $this->lockedProductLimit($lockedTenant);

            $catalog = $lockedTenant->run(fn (): array => DB::transaction(
                fn (): array => $this->mutate($lockedTenant, $payload, $limit, true),
            ));
            $catalog['products'] = $this->projectProductsForActor($catalog['products'], $lockedTenant, $actor);

            return $catalog;
        });
    }

    /**
     * Inventory policy and balances are a separate permission boundary from catalog metadata.
     *
     * @param  list<array<string, mixed>>  $products
     * @return list<array<string, mixed>>
     */
    public function projectProductsForActor(array $products, Tenant $tenant, User $actor): array
    {
        if ($actor->hasTenantPermission($tenant, PermissionKey::TenantInventoryView)) {
            return $products;
        }

        return array_map(static fn (array $product): array => array_diff_key($product, array_flip([
            'stockQuantity',
            'reservedQuantity',
            'availableQuantity',
            'inventoryRevision',
            'manageStock',
            'lowStockThreshold',
        ])), $products);
    }

    /**
     * Caller owns the tenant transaction and must lock the workspace row before this method.
     *
     * @param  array<string, mixed>  $payload
     * @return array{tenantId: string, revision: int, currencyCode: string, products: list<array<string, mixed>>}
     */
    public function mutate(
        Tenant $tenant,
        array $payload,
        ?int $maxProducts,
        bool $includeArchived = false,
        bool $legacyCompatibleIds = false,
    ): array {
        $normalized = ProductCatalogContract::normalize($payload, $legacyCompatibleIds);
        $validator = ProductCatalogContract::validator($normalized, $maxProducts, $legacyCompatibleIds);
        if ($validator->fails()) {
            throw ValidationException::withMessages($validator->errors()->toArray());
        }

        $settings = DB::table('catalog_settings')->where('id', 1)->lockForUpdate()->first();
        if ($settings === null) {
            throw new ProductCatalogConflict('The tenant catalog is not ready.', 'catalog_not_ready');
        }
        $expectedRevision = $normalized['catalogRevision'];
        if ($expectedRevision !== null && (int) $settings->revision !== $expectedRevision) {
            throw new ProductCatalogConflict(
                'The product catalog changed on another device. Reload it before saving.',
                'catalog_revision_conflict',
            );
        }

        $currency = (string) $normalized['currencyCode'];
        if ($currency !== (string) $settings->currency_code && DB::table('products')->exists()) {
            throw new ProductCatalogConflict(
                'Catalog currency cannot change after priced products exist.',
                'catalog_currency_locked',
            );
        }

        $incoming = $normalized['products'];
        $archiveIds = $normalized['archiveProductIds'];
        $incomingIds = collect($incoming)->pluck('id')->filter()->values()->all();
        $existing = DB::table('products')->whereIn('id', $incomingIds)->lockForUpdate()->get()->keyBy('id');
        foreach ($incomingIds as $id) {
            if (! $existing->has($id)) {
                throw new ProductCatalogConflict('A referenced product no longer exists.', 'catalog_product_missing');
            }
        }
        $archiveRows = $archiveIds === []
            ? collect()
            : DB::table('products')->whereIn('id', $archiveIds)->lockForUpdate()->get()->keyBy('id');
        if ($archiveRows->count() !== count($archiveIds)) {
            throw new ProductCatalogConflict('A product selected for archive no longer exists.', 'catalog_product_missing');
        }

        $incomingSkuOwners = collect($incoming)
            ->filter(fn (array $product): bool => is_string($product['sku'] ?? null) && trim($product['sku']) !== '')
            ->mapWithKeys(fn (array $product): array => [mb_strtolower(trim((string) $product['sku'])) => $product['id'] ?? null]);
        if ($incomingSkuOwners->isNotEmpty()) {
            $placeholders = implode(',', array_fill(0, $incomingSkuOwners->count(), '?'));
            $skuRows = DB::table('products')->whereRaw(
                "lower(sku) in ({$placeholders})",
                $incomingSkuOwners->keys()->all(),
            )->lockForUpdate()->get();
            foreach ($skuRows as $skuRow) {
                $expectedOwner = $incomingSkuOwners->get(mb_strtolower((string) $skuRow->sku));
                if ($expectedOwner !== (string) $skuRow->id) {
                    throw new ProductCatalogConflict('A product SKU is already in use.', 'catalog_sku_conflict');
                }
            }
        }

        $currentLive = DB::table('products')->where('status', '!=', ProductStatus::Archived->value)->count();
        $archivingLive = $archiveRows->filter(fn (object $row): bool => $row->status !== ProductStatus::Archived->value)->count();
        $transitionArchivingLive = collect($incoming)->filter(function (array $product) use ($existing): bool {
            if (! isset($product['id']) || ! $existing->has($product['id'])) {
                return false;
            }

            return $existing->get($product['id'])->status !== ProductStatus::Archived->value
                && $product['status'] === ProductStatus::Archived->value;
        })->count();
        $newLive = collect($incoming)->filter(fn (array $product): bool => ! isset($product['id'])
            && $product['status'] !== ProductStatus::Archived->value)->count();
        $restoredLive = collect($incoming)->filter(function (array $product) use ($existing): bool {
            if (! isset($product['id']) || ! $existing->has($product['id'])) {
                return false;
            }

            return $existing->get($product['id'])->status === ProductStatus::Archived->value
                && $product['status'] !== ProductStatus::Archived->value;
        })->count();
        $resultingLive = $currentLive - $archivingLive - $transitionArchivingLive + $newLive + $restoredLive;
        if ($maxProducts !== null && $resultingLive > $maxProducts) {
            throw new ProductCatalogConflict(
                "The selected plan allows at most {$maxProducts} products.",
                'catalog_quota_exceeded',
            );
        }

        $changed = $currency !== (string) $settings->currency_code;
        $now = now();
        foreach ($incoming as $position => $product) {
            $row = isset($product['id']) ? $existing->get($product['id']) : null;
            $id = $row === null ? (string) Str::uuid() : (string) $row->id;
            $currentStatus = $row === null ? null : ProductStatus::from((string) $row->status);
            $nextStatus = ProductStatus::from((string) $product['status']);
            $this->assertTransition($currentStatus, $nextStatus);
            if ($row !== null) {
                $this->assertInventoryProjectionUnchanged($row, $product);
                if ($nextStatus === ProductStatus::Archived && (int) $row->reserved_quantity > 0) {
                    throw new InventoryConflict('A product with active reservations cannot be archived.', 'inventory_reservation_conflict');
                }
            }
            $baseMinor = CatalogMoney::parse((string) $product['basePrice']);
            $saleMinor = $product['salePrice'] === null ? null : CatalogMoney::parse((string) $product['salePrice']);
            $effectiveMinor = $saleMinor ?? $baseMinor;
            $sku = is_string($product['sku'] ?? null) && trim($product['sku']) !== '' ? trim($product['sku']) : null;
            $values = [
                'name' => trim((string) $product['name']),
                'price' => CatalogMoney::format($effectiveMinor),
                'base_price_minor' => $baseMinor,
                'sale_price_minor' => $saleMinor,
                'description' => $product['description'] ?? null,
                'category' => $product['category'] ?? null,
                'image_keyword' => $product['imageKeyword'] ?? null,
                'sku' => $sku,
                'position' => $position,
                'status' => $nextStatus->value,
                'published_at' => $nextStatus === ProductStatus::Published
                    ? ($row === null ? $now : ($row->published_at ?? $now))
                    : ($row === null ? null : $row->published_at),
                'archived_at' => $nextStatus === ProductStatus::Archived
                    ? ($row === null ? $now : ($row->archived_at ?? $now))
                    : null,
                'updated_at' => $now,
            ];

            $rowChanged = $row === null || $this->rowChanged($row, $values);
            if ($row === null) {
                $openingOnHand = (int) ($product['stockQuantity'] ?? 10);
                DB::table('products')->insert([
                    'id' => $id,
                    ...$values,
                    'stock_quantity' => 0,
                    'reserved_quantity' => 0,
                    'manage_stock' => (bool) ($product['manageStock'] ?? true),
                    'low_stock_threshold' => (int) ($product['lowStockThreshold'] ?? 5),
                    'inventory_revision' => 1,
                    'image_url' => null,
                    'image_urls' => null,
                    'revision' => 1,
                    'created_at' => $now,
                ]);
                $this->inventory->recordOpening($tenant, $id, $openingOnHand);
            } elseif ($rowChanged) {
                DB::table('products')->where('id', $id)->update([
                    ...$values,
                    'revision' => (int) $row->revision + 1,
                ]);
            }

            $mediaChanged = $this->syncMedia(
                $tenant,
                $id,
                array_values(array_unique(array_filter([
                    $product['imageUrl'] ?? null,
                    ...((array) ($product['imageUrls'] ?? [])),
                ], 'is_string'))),
            );
            $changed = $changed || $rowChanged || $mediaChanged;
        }

        foreach ($archiveRows as $row) {
            if ($row->status === ProductStatus::Archived->value) {
                continue;
            }
            if ((int) $row->reserved_quantity > 0) {
                throw new InventoryConflict('A product with active reservations cannot be archived.', 'inventory_reservation_conflict');
            }
            DB::table('products')->where('id', $row->id)->update([
                'status' => ProductStatus::Archived->value,
                'archived_at' => $now,
                'revision' => (int) $row->revision + 1,
                'updated_at' => $now,
            ]);
            $changed = true;
        }

        if ($changed) {
            DB::table('catalog_settings')->where('id', 1)->update([
                'currency_code' => $currency,
                'revision' => (int) $settings->revision + 1,
                'updated_at' => $now,
            ]);
        }

        return $this->compose($tenant, false, $includeArchived);
    }

    /** @return array{tenantId: string, revision: int, currencyCode: string, products: list<array<string, mixed>>} */
    public function compose(Tenant $tenant, bool $public, bool $includeArchived = false): array
    {
        $settings = DB::table('catalog_settings')->where('id', 1)->first();
        if ($settings === null) {
            throw new ProductCatalogConflict('The tenant catalog is not ready.', 'catalog_not_ready');
        }

        $query = DB::table('products')->orderBy('position')->orderBy('id');
        if ($public) {
            $query->where('status', ProductStatus::Published->value);
        } elseif (! $includeArchived) {
            $query->where('status', '!=', ProductStatus::Archived->value);
        }
        $rows = $query->get();
        $media = DB::table('product_media')
            ->whereIn('product_id', $rows->pluck('id'))
            ->orderBy('position')
            ->orderBy('id')
            ->get()
            ->groupBy('product_id');

        return [
            'tenantId' => (string) $tenant->getKey(),
            'revision' => (int) $settings->revision,
            'currencyCode' => (string) $settings->currency_code,
            'products' => $rows->map(function (object $product) use ($tenant, $media, $public): array {
                $urls = $media->get($product->id, collect())->map(
                    fn (object $item): string => $item->source_type === ProductMediaSource::Managed->value
                        ? '/api/catalog-media/'.$tenant->getKey().'/'.$item->id
                        : (string) $item->external_url,
                )->values()->all();

                $onHand = (int) $product->stock_quantity;
                $reserved = (int) $product->reserved_quantity;
                $available = (bool) $product->manage_stock ? $onHand - $reserved : null;
                $resource = [
                    'id' => (string) $product->id,
                    'revision' => (int) $product->revision,
                    'status' => (string) $product->status,
                    'name' => (string) $product->name,
                    'price' => CatalogMoney::format((int) ($product->sale_price_minor ?? $product->base_price_minor)),
                    'basePrice' => CatalogMoney::format((int) $product->base_price_minor),
                    'salePrice' => $product->sale_price_minor === null ? null : CatalogMoney::format((int) $product->sale_price_minor),
                    'description' => $product->description,
                    'category' => $product->category,
                    'imageKeyword' => $product->image_keyword,
                    'imageUrl' => $urls[0] ?? null,
                    'imageUrls' => $urls,
                    'stockQuantity' => $public ? $available : $onHand,
                    'availableQuantity' => $available,
                    'manageStock' => (bool) $product->manage_stock,
                    'sku' => $product->sku,
                    'lowStockThreshold' => (int) $product->low_stock_threshold,
                ];
                if (! $public) {
                    $resource['reservedQuantity'] = $reserved;
                    $resource['inventoryRevision'] = (int) $product->inventory_revision;
                }

                return $resource;
            })->all(),
        ];
    }

    private function syncMedia(Tenant $tenant, string $productId, array $urls): bool
    {
        $currentRows = DB::table('product_media')->where('product_id', $productId)->orderBy('position')->lockForUpdate()->get();
        $current = $currentRows->map(fn (object $item): string => $item->source_type === ProductMediaSource::Managed->value
            ? '/api/catalog-media/'.$tenant->getKey().'/'.$item->id
            : (string) $item->external_url)->all();
        if ($current === $urls) {
            return false;
        }

        DB::table('product_media')->where('product_id', $productId)->where('source_type', ProductMediaSource::External->value)->delete();
        DB::table('product_media')->where('product_id', $productId)->where('source_type', ProductMediaSource::Managed->value)->update([
            'product_id' => null,
            'position' => 0,
            'attached_at' => null,
            'cleanup_started_at' => null,
            'updated_at' => now(),
        ]);

        foreach ($urls as $position => $url) {
            if (preg_match('#^/api/catalog-media/([^/]+)/([0-9a-f-]{36})$#i', $url, $matches) === 1) {
                if ($matches[1] !== (string) $tenant->getKey()) {
                    throw new ProductCatalogConflict('Managed media belongs to another tenant.', 'catalog_media_tenant_mismatch');
                }
                $asset = DB::table('product_media')->where('id', $matches[2])
                    ->where('source_type', ProductMediaSource::Managed->value)
                    ->whereNull('cleanup_started_at')
                    ->lockForUpdate()->first();
                if ($asset === null || ($asset->product_id !== null && $asset->product_id !== $productId)) {
                    throw new ProductCatalogConflict('Managed media is unavailable.', 'catalog_media_unavailable');
                }
                DB::table('product_media')->where('id', $asset->id)->update([
                    'product_id' => $productId,
                    'position' => $position,
                    'attached_at' => now(),
                    'cleanup_started_at' => null,
                    'updated_at' => now(),
                ]);

                continue;
            }

            if (! ProductCatalogContract::validMediaReference($url)) {
                throw ValidationException::withMessages(['products.imageUrls' => ['Product media must be HTTPS or managed media.']]);
            }
            DB::table('product_media')->insert([
                'id' => (string) Str::uuid(),
                'product_id' => $productId,
                'source_type' => ProductMediaSource::External->value,
                'external_url' => $url,
                'position' => $position,
                'attached_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('products')->where('id', $productId)->update([
            'image_url' => $urls[0] ?? null,
            'image_urls' => $urls === [] ? null : json_encode($urls, JSON_THROW_ON_ERROR),
        ]);

        return true;
    }

    private function assertTransition(?ProductStatus $from, ProductStatus $to): void
    {
        $allowed = match ($from) {
            null => in_array($to, [ProductStatus::Draft, ProductStatus::Published], true),
            ProductStatus::Draft => true,
            ProductStatus::Published => true,
            ProductStatus::Archived => $to !== ProductStatus::Published,
        };
        if (! $allowed) {
            throw new ProductCatalogConflict('The requested product lifecycle transition is not allowed.', 'catalog_status_transition_invalid');
        }
    }

    /** @param array<string, mixed> $values */
    private function rowChanged(object $row, array $values): bool
    {
        foreach ($values as $column => $value) {
            if ($column === 'updated_at') {
                continue;
            }
            $stored = $row->{$column};
            if (is_bool($value)) {
                if ((bool) $stored !== $value) {
                    return true;
                }
            } elseif ((string) ($stored ?? '') !== (string) ($value ?? '')) {
                return true;
            }
        }

        return false;
    }

    /** @param array<string, mixed> $product */
    private function assertInventoryProjectionUnchanged(object $row, array $product): void
    {
        $projections = [
            'stockQuantity' => (int) $row->stock_quantity,
            'reservedQuantity' => (int) $row->reserved_quantity,
            'availableQuantity' => (bool) $row->manage_stock
                ? (int) $row->stock_quantity - (int) $row->reserved_quantity
                : null,
            'inventoryRevision' => (int) $row->inventory_revision,
            'manageStock' => (bool) $row->manage_stock,
            'lowStockThreshold' => (int) $row->low_stock_threshold,
        ];
        foreach ($projections as $field => $stored) {
            if (array_key_exists($field, $product) && $product[$field] !== null && $product[$field] !== $stored) {
                throw new InventoryConflict(
                    'Inventory fields must be changed through the inventory API.',
                    'inventory_adjustment_required',
                );
            }
        }
    }

    private function assertReady(Tenant $tenant): void
    {
        if (! TenantWorkspaceReadiness::check($tenant)) {
            throw new ProductCatalogConflict('The tenant catalog is not ready.', 'catalog_not_ready');
        }
    }

    private function lockedProductLimit(Tenant $tenant): ?int
    {
        $publication = PublicationRequest::query()->whereKey($tenant->getAttribute('publication_request_id'))
            ->where('tenant_id', $tenant->getKey())->lockForUpdate()->first();
        if (! $publication instanceof PublicationRequest) {
            throw new ProductCatalogConflict('The catalog has no current publication request.', 'catalog_entitlement_unavailable');
        }
        $subscription = TenantSubscription::query()->whereKey($publication->getAttribute('tenant_subscription_id'))
            ->where('tenant_id', $tenant->getKey())->lockForUpdate()->first();
        if (! $subscription instanceof TenantSubscription) {
            throw new ProductCatalogConflict('The catalog has no product entitlement.', 'catalog_entitlement_unavailable');
        }
        $status = $subscription->getAttribute('status');
        if ($status !== SubscriptionStatus::PendingActivation
            && ! ($status === SubscriptionStatus::Active && $subscription->isCurrentlyActive())) {
            throw new ProductCatalogConflict('The product entitlement is unavailable.', 'catalog_entitlement_unavailable');
        }
        $plan = Plan::query()->whereKey($subscription->getAttribute('plan_key'))->lockForUpdate()->first();
        if (! $plan instanceof Plan) {
            throw new ProductCatalogConflict('The product plan is unavailable.', 'catalog_entitlement_unavailable');
        }

        return $plan->getAttribute('max_products') === null ? null : (int) $plan->getAttribute('max_products');
    }

    /**
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
            $membership = $central->table('tenant_user')->where('tenant_id', $lockedTenant->getKey())
                ->where('user_id', $actor->getKey())->lockForUpdate()->first();
            if ($membership === null || $membership->status !== TenantMembershipStatus::Active->value) {
                throw new AuthorizationException('The active tenant membership is required.');
            }
            if ($write && ! $actor->hasTenantPermission($lockedTenant, PermissionKey::TenantProductsManage)) {
                throw new AuthorizationException('Product management permission is required.');
            }

            return $operation($lockedTenant);
        });
    }
}
