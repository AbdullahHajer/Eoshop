<?php

namespace App\Services;

use App\Enums\InventoryActorType;
use App\Enums\InventoryMovementKind;
use App\Enums\InventoryOperationKind;
use App\Enums\PermissionKey;
use App\Enums\ProductStatus;
use App\Enums\TenantMembershipStatus;
use App\Exceptions\InventoryConflict;
use App\Models\Tenant;
use App\Models\User;
use App\Support\InventoryIdentity;
use App\Support\TenantWorkspaceReadiness;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class InventoryLedgerService
{
    public function __construct(private readonly InventoryOperationService $operations) {}

    /** @return array{tenantId: string, items: list<array<string, mixed>>} */
    public function read(Tenant $tenant, User $actor): array
    {
        return $this->withLockedMembership($tenant, $actor, PermissionKey::TenantInventoryView, function (Tenant $lockedTenant): array {
            $this->assertReady($lockedTenant);

            return $lockedTenant->run(function () use ($lockedTenant): array {
                return DB::transaction(function () use ($lockedTenant): array {
                    DB::statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
                    $items = DB::table('products')
                        ->where('status', '!=', ProductStatus::Archived->value)
                        ->orderBy('position')->orderBy('id')->get()
                        ->map(fn (object $product): array => $this->balanceResource($product))
                        ->all();

                    return ['tenantId' => (string) $lockedTenant->getKey(), 'items' => $items];
                });
            });
        });
    }

    /**
     * @param  array{lines: list<array{productId: string, expectedInventoryRevision: int, movementKind: string, delta: int}>, reasonCode: string, note?: ?string}  $payload
     * @return array<string, mixed>
     */
    public function adjust(
        Tenant $tenant,
        User $actor,
        array $payload,
        string $idempotencyKey,
        ?string $requestId,
    ): array {
        return $this->withLockedMembership($tenant, $actor, PermissionKey::TenantInventoryManage, function (Tenant $lockedTenant) use ($actor, $payload, $idempotencyKey, $requestId): array {
            $this->assertReady($lockedTenant);
            $lines = collect($payload['lines'])->sortBy('productId')->values()->all();
            $canonical = [
                'lines' => $lines,
                'reasonCode' => $payload['reasonCode'],
                'note' => $payload['note'] ?? null,
            ];

            return $lockedTenant->run(function () use ($lockedTenant, $actor, $canonical, $lines, $idempotencyKey, $requestId): array {
                return DB::transaction(function () use ($lockedTenant, $actor, $canonical, $lines, $idempotencyKey, $requestId): array {
                    $claim = $this->operations->claim(
                        InventoryOperationKind::ManualAdjustment,
                        'user:'.$actor->getKey(),
                        $idempotencyKey,
                        $canonical,
                        InventoryActorType::User,
                        (string) $actor->getKey(),
                        'merchant_api',
                        (string) $canonical['reasonCode'],
                        $canonical['note'],
                        $requestId,
                    );
                    $operation = $claim['operation'];
                    if ($claim['replayed']) {
                        return $this->operations->replayResult((string) $operation->id);
                    }

                    $ids = array_column($lines, 'productId');
                    $products = DB::table('products')->whereIn('id', $ids)
                        ->orderBy('id')->lockForUpdate()->get()->keyBy('id');
                    if ($products->count() !== count($ids)) {
                        throw new InventoryConflict('An inventory product no longer exists.', 'inventory_product_missing');
                    }

                    foreach ($lines as $line) {
                        $product = $products->get($line['productId']);
                        if ((int) $product->inventory_revision !== (int) $line['expectedInventoryRevision']) {
                            throw new InventoryConflict('Inventory changed on another device.', 'inventory_revision_conflict');
                        }
                        $kind = InventoryMovementKind::from($line['movementKind']);
                        $delta = (int) $line['delta'];
                        $this->assertManualDelta($kind, $delta);
                        $afterOnHand = (int) $product->stock_quantity + $delta;
                        $reserved = (int) $product->reserved_quantity;
                        if ($afterOnHand < $reserved) {
                            throw new InventoryConflict('The adjustment would reduce stock below active reservations.', 'inventory_insufficient_available');
                        }
                        $afterRevision = (int) $product->inventory_revision + 1;
                        $this->insertMovement(
                            (string) $operation->id,
                            (string) $product->id,
                            null,
                            $kind,
                            (int) $product->stock_quantity,
                            $reserved,
                            $delta,
                            0,
                            $afterOnHand,
                            $reserved,
                            (int) $product->inventory_revision,
                            $afterRevision,
                        );
                    }

                    $this->bindOperation((string) $operation->id);
                    foreach ($lines as $line) {
                        $product = $products->get($line['productId']);
                        DB::table('products')->where('id', $product->id)->update([
                            'stock_quantity' => (int) $product->stock_quantity + (int) $line['delta'],
                            'inventory_revision' => (int) $product->inventory_revision + 1,
                            'updated_at' => now(),
                        ]);
                    }

                    Log::info('merchant.inventory.adjusted', [
                        'request_id' => $requestId,
                        'actor_user_id' => (string) $actor->getKey(),
                        'tenant_id' => (string) $lockedTenant->getKey(),
                        'operation_id' => (string) $operation->id,
                        'line_count' => count($lines),
                    ]);

                    return $this->operations->storeResult(
                        (string) $operation->id,
                        $this->movementResult($lockedTenant, $operation, false),
                    );
                });
            });
        });
    }

    /** @return array<string, mixed> */
    public function updatePolicy(
        Tenant $tenant,
        User $actor,
        string $productId,
        int $expectedRevision,
        bool $manageStock,
        int $threshold,
        string $idempotencyKey,
        ?string $requestId,
    ): array {
        return $this->withLockedMembership($tenant, $actor, PermissionKey::TenantInventoryManage, function (Tenant $lockedTenant) use ($actor, $productId, $expectedRevision, $manageStock, $threshold, $idempotencyKey, $requestId): array {
            $this->assertReady($lockedTenant);
            $payload = compact('productId', 'expectedRevision', 'manageStock', 'threshold');

            return $lockedTenant->run(fn (): array => DB::transaction(function () use ($lockedTenant, $actor, $payload, $productId, $expectedRevision, $manageStock, $threshold, $idempotencyKey, $requestId): array {
                $product = DB::table('products')->where('id', $productId)->lockForUpdate()->first();
                if ($product === null) {
                    throw new InventoryConflict('The inventory product no longer exists.', 'inventory_product_missing');
                }

                $claim = $this->operations->claim(
                    InventoryOperationKind::PolicyUpdate,
                    'user:'.$actor->getKey(),
                    $idempotencyKey,
                    $payload,
                    InventoryActorType::User,
                    (string) $actor->getKey(),
                    'merchant_api',
                    'inventory_policy_update',
                    null,
                    $requestId,
                );
                $operation = $claim['operation'];
                if ($claim['replayed']) {
                    return $this->operations->replayResult((string) $operation->id);
                }
                if ((int) $product->inventory_revision !== $expectedRevision) {
                    throw new InventoryConflict('Inventory changed on another device.', 'inventory_revision_conflict');
                }
                if ((bool) $product->manage_stock === $manageStock && (int) $product->low_stock_threshold === $threshold) {
                    throw new InventoryConflict('The requested inventory policy is already current.', 'inventory_policy_no_change');
                }
                if (! $manageStock && (int) $product->reserved_quantity > 0) {
                    throw new InventoryConflict('Tracking cannot be disabled while stock is reserved.', 'inventory_tracking_conflict');
                }

                $afterRevision = (int) $product->inventory_revision + 1;
                DB::table('inventory_policy_changes')->insert([
                    'id' => (string) Str::uuid(),
                    'operation_id' => $operation->id,
                    'product_id' => $product->id,
                    'before_manage_stock' => (bool) $product->manage_stock,
                    'after_manage_stock' => $manageStock,
                    'before_low_stock_threshold' => (int) $product->low_stock_threshold,
                    'after_low_stock_threshold' => $threshold,
                    'before_inventory_revision' => (int) $product->inventory_revision,
                    'after_inventory_revision' => $afterRevision,
                    'created_at' => now(),
                ]);
                $this->bindOperation((string) $operation->id);
                DB::table('products')->where('id', $product->id)->update([
                    'manage_stock' => $manageStock,
                    'low_stock_threshold' => $threshold,
                    'inventory_revision' => $afterRevision,
                    'updated_at' => now(),
                ]);

                return $this->operations->storeResult(
                    (string) $operation->id,
                    $this->policyResult($lockedTenant, $operation, false),
                );
            }));
        });
    }

    /**
     * Caller owns the tenant transaction and has inserted the product at zero balance.
     */
    public function recordOpening(Tenant $tenant, string $productId, int $openingOnHand): void
    {
        $schema = (string) DB::selectOne('SELECT current_schema() AS name')->name;
        $operationId = InventoryIdentity::opening($schema, $productId);
        $claim = $this->operations->claim(
            InventoryOperationKind::Opening,
            'system:catalog-opening',
            $operationId,
            compact('productId', 'openingOnHand'),
            InventoryActorType::System,
            null,
            'product_catalog',
            'product_opening_balance',
            operationId: $operationId,
        );
        if ($claim['replayed']) {
            return;
        }
        $this->insertMovement(
            $operationId,
            $productId,
            null,
            InventoryMovementKind::Opening,
            0,
            0,
            $openingOnHand,
            0,
            $openingOnHand,
            0,
            1,
            1,
        );
        if ($openingOnHand > 0) {
            $this->bindOperation($operationId);
            DB::table('products')->where('id', $productId)->update([
                'stock_quantity' => $openingOnHand,
                'updated_at' => now(),
            ]);
        }
    }

    /** @return array<string, mixed> */
    public function history(Tenant $tenant, User $actor, ?string $productId, int $page, int $perPage): array
    {
        return $this->withLockedMembership($tenant, $actor, PermissionKey::TenantInventoryView, function (Tenant $lockedTenant) use ($productId, $page, $perPage): array {
            $this->assertReady($lockedTenant);

            return $lockedTenant->run(fn (): array => DB::connection('tenant')->transaction(function () use ($lockedTenant, $productId, $page, $perPage): array {
                DB::connection('tenant')->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
                $query = DB::table('inventory_movements')
                    ->join('inventory_operations', 'inventory_operations.id', '=', 'inventory_movements.operation_id')
                    ->when($productId !== null, fn ($builder) => $builder->where('inventory_movements.product_id', $productId));
                $total = (clone $query)->count();
                $rows = $query->orderByDesc('inventory_movements.created_at')->orderByDesc('inventory_movements.id')
                    ->offset(($page - 1) * $perPage)->limit($perPage)
                    ->get([
                        'inventory_movements.*', 'inventory_operations.reason_code', 'inventory_operations.note',
                        'inventory_operations.actor_type', 'inventory_operations.actor_user_id', 'inventory_operations.source',
                    ])->map(fn (object $row): array => [
                        'id' => (string) $row->id,
                        'operationId' => (string) $row->operation_id,
                        'productId' => (string) $row->product_id,
                        'kind' => (string) $row->kind,
                        'onHandDelta' => (int) $row->on_hand_delta,
                        'reservedDelta' => (int) $row->reserved_delta,
                        'afterOnHand' => (int) $row->after_on_hand,
                        'afterReserved' => (int) $row->after_reserved,
                        'reasonCode' => (string) $row->reason_code,
                        'note' => $row->note,
                        'actorType' => (string) $row->actor_type,
                        'actorUserId' => $row->actor_user_id,
                        'source' => (string) $row->source,
                        'createdAt' => (string) $row->created_at,
                    ])->all();

                return [
                    'tenantId' => (string) $lockedTenant->getKey(),
                    'data' => $rows,
                    'page' => $page,
                    'perPage' => $perPage,
                    'total' => $total,
                    'lastPage' => max(1, (int) ceil($total / $perPage)),
                ];
            }));
        });
    }

    public function bindOperation(string $operationId): void
    {
        DB::selectOne("SELECT set_config('eoshop.inventory_operation_id', ?, true)", [$operationId]);
    }

    public function insertMovement(
        string $operationId,
        string $productId,
        ?string $reservationId,
        InventoryMovementKind $kind,
        int $beforeOnHand,
        int $beforeReserved,
        int $onHandDelta,
        int $reservedDelta,
        int $afterOnHand,
        int $afterReserved,
        int $beforeRevision,
        int $afterRevision,
    ): void {
        DB::table('inventory_movements')->insert([
            'id' => (string) Str::uuid(),
            'operation_id' => $operationId,
            'product_id' => $productId,
            'reservation_id' => $reservationId,
            'kind' => $kind->value,
            'before_on_hand' => $beforeOnHand,
            'before_reserved' => $beforeReserved,
            'on_hand_delta' => $onHandDelta,
            'reserved_delta' => $reservedDelta,
            'after_on_hand' => $afterOnHand,
            'after_reserved' => $afterReserved,
            'before_inventory_revision' => $beforeRevision,
            'after_inventory_revision' => $afterRevision,
            'created_at' => now(),
        ]);
    }

    /** @return array<string, mixed> */
    private function movementResult(Tenant $tenant, object $operation, bool $replayed): array
    {
        $items = DB::table('inventory_movements')
            ->join('products', 'products.id', '=', 'inventory_movements.product_id')
            ->where('inventory_movements.operation_id', $operation->id)
            ->orderBy('inventory_movements.product_id')->get()->map(fn (object $movement): array => [
                'productId' => (string) $movement->product_id,
                'name' => (string) $movement->name,
                'sku' => $movement->sku,
                'movementKind' => (string) $movement->kind,
                'onHandDelta' => (int) $movement->on_hand_delta,
                'reservedDelta' => (int) $movement->reserved_delta,
                'onHand' => (int) $movement->after_on_hand,
                'reserved' => (int) $movement->after_reserved,
                'available' => (bool) $movement->manage_stock
                    ? (int) $movement->after_on_hand - (int) $movement->after_reserved
                    : null,
                'manageStock' => (bool) $movement->manage_stock,
                'lowStockThreshold' => (int) $movement->low_stock_threshold,
                'inventoryRevision' => (int) $movement->after_inventory_revision,
            ])->all();

        return [
            'tenantId' => (string) $tenant->getKey(),
            'operationId' => (string) $operation->id,
            'replayed' => $replayed,
            'items' => $items,
        ];
    }

    /** @return array<string, mixed> */
    private function policyResult(Tenant $tenant, object $operation, bool $replayed): array
    {
        $change = DB::table('inventory_policy_changes')->where('operation_id', $operation->id)->first();
        if ($change === null) {
            throw new InventoryConflict('The inventory policy replay is unavailable.', 'inventory_not_ready');
        }
        $product = DB::table('products')->where('id', $change->product_id)->first();
        if ($product === null) {
            throw new InventoryConflict('The inventory product no longer exists.', 'inventory_product_missing');
        }

        return [
            'tenantId' => (string) $tenant->getKey(),
            'operationId' => (string) $operation->id,
            'replayed' => $replayed,
            'item' => [
                ...$this->balanceResource($product),
                'manageStock' => (bool) $change->after_manage_stock,
                'lowStockThreshold' => (int) $change->after_low_stock_threshold,
                'inventoryRevision' => (int) $change->after_inventory_revision,
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function balanceResource(object $product): array
    {
        $onHand = (int) $product->stock_quantity;
        $reserved = (int) $product->reserved_quantity;
        $managed = (bool) $product->manage_stock;

        return [
            'productId' => (string) $product->id,
            'name' => (string) $product->name,
            'sku' => $product->sku,
            'onHand' => $onHand,
            'reserved' => $reserved,
            'available' => $managed ? $onHand - $reserved : null,
            'manageStock' => $managed,
            'lowStockThreshold' => (int) $product->low_stock_threshold,
            'inventoryRevision' => (int) $product->inventory_revision,
        ];
    }

    private function assertManualDelta(InventoryMovementKind $kind, int $delta): void
    {
        $valid = match ($kind) {
            InventoryMovementKind::Receive, InventoryMovementKind::Return => $delta > 0,
            InventoryMovementKind::Issue => $delta < 0,
            InventoryMovementKind::Correction => $delta !== 0,
            default => false,
        };
        if (! $valid) {
            throw new InventoryConflict('The inventory movement kind does not match its delta.', 'inventory_adjustment_invalid');
        }
    }

    private function assertReady(Tenant $tenant): void
    {
        if (! TenantWorkspaceReadiness::check($tenant)) {
            throw new InventoryConflict('The tenant inventory is not ready.', 'inventory_not_ready');
        }
    }

    /**
     * @template T
     *
     * @param  callable(Tenant): T  $callback
     * @return T
     */
    private function withLockedMembership(Tenant $tenant, User $actor, PermissionKey $permission, callable $callback): mixed
    {
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        return $central->transaction(function () use ($central, $tenant, $actor, $permission, $callback): mixed {
            $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
            $membership = $central->table('tenant_user')
                ->where('tenant_id', $lockedTenant->getKey())
                ->where('user_id', $actor->getKey())
                ->lockForUpdate()->first();
            if ($membership === null || $membership->status !== TenantMembershipStatus::Active->value
                || ! $actor->hasTenantPermission($lockedTenant, $permission)) {
                throw new AuthorizationException('The inventory permission is required.');
            }

            return $callback($lockedTenant);
        });
    }
}
