<?php

namespace App\Services;

use App\Enums\InventoryActorType;
use App\Enums\InventoryMovementKind;
use App\Enums\InventoryOperationKind;
use App\Enums\InventoryReservationStatus;
use App\Exceptions\InventoryConflict;
use App\Models\Tenant;
use App\Support\InventoryIdentity;
use App\Support\TenantWorkspaceReadiness;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InventoryReservationService
{
    public function __construct(
        private readonly InventoryOperationService $operations,
        private readonly InventoryLedgerService $ledger,
    ) {}

    /**
     * Internal-only contract for the future order service. No shopper route is exposed in WP 4.2.
     *
     * @param  list<array{productId: string, quantity: int}>  $lines
     * @return array<string, mixed>
     */
    public function reserve(
        Tenant $tenant,
        string $referenceType,
        string $referenceId,
        array $lines,
        int $ttlSeconds,
        string $idempotencyKey,
        InventoryActorType $actorType,
        ?string $actorUserId,
        string $source,
        ?string $requestId = null,
    ): array {
        if ($ttlSeconds < 60 || $ttlSeconds > 1800) {
            throw new InventoryConflict('Reservation lifetime must be between one and thirty minutes.', 'inventory_reservation_ttl_invalid');
        }
        $lines = collect($lines)->sortBy('productId')->values()->all();
        if ($lines === [] || count(array_unique(array_column($lines, 'productId'))) !== count($lines)) {
            throw new InventoryConflict('Reservation products must be non-empty and unique.', 'inventory_reservation_lines_invalid');
        }
        foreach ($lines as $line) {
            if ((int) $line['quantity'] <= 0) {
                throw new InventoryConflict('Reservation quantities must be positive.', 'inventory_reservation_lines_invalid');
            }
        }
        $payload = compact('referenceType', 'referenceId', 'lines', 'ttlSeconds');

        return $this->withLockedTenant($tenant, true, fn (Tenant $lockedTenant): array => $lockedTenant->run(fn (): array => DB::transaction(function () use ($lockedTenant, $referenceType, $referenceId, $lines, $ttlSeconds, $idempotencyKey, $actorType, $actorUserId, $source, $requestId, $payload): array {
            $claim = $this->operations->claim(
                InventoryOperationKind::ReservationCreate,
                $source,
                $idempotencyKey,
                $payload,
                $actorType,
                $actorUserId,
                $source,
                'inventory_reservation_create',
                requestId: $requestId,
            );
            $operation = $claim['operation'];
            if ($claim['replayed']) {
                return $this->operations->replayResult((string) $operation->id);
            }

            $products = DB::table('products')->whereIn('id', array_column($lines, 'productId'))
                ->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            if ($products->count() !== count($lines)) {
                throw new InventoryConflict('A reservation product no longer exists.', 'inventory_product_missing');
            }
            $clock = CarbonImmutable::parse((string) DB::selectOne('SELECT clock_timestamp() AS current_time')->current_time);
            $reservationId = (string) Str::uuid();
            DB::table('inventory_reservations')->insert([
                'id' => $reservationId,
                'status' => InventoryReservationStatus::Active->value,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'expires_at' => $clock->addSeconds($ttlSeconds),
                'created_by_operation_id' => $operation->id,
                'created_at' => $clock,
                'updated_at' => $clock,
            ]);
            $this->ledger->bindOperation((string) $operation->id);

            foreach ($lines as $line) {
                $product = $products->get($line['productId']);
                $quantity = (int) $line['quantity'];
                if (! (bool) $product->manage_stock) {
                    throw new InventoryConflict('Untracked products cannot be reserved.', 'inventory_tracking_disabled');
                }
                $available = (int) $product->stock_quantity - (int) $product->reserved_quantity;
                if ($quantity > $available) {
                    throw new InventoryConflict('There is not enough available stock.', 'inventory_insufficient_available');
                }
                DB::table('inventory_reservation_items')->insert([
                    'reservation_id' => $reservationId,
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                ]);
                $this->ledger->insertMovement(
                    (string) $operation->id,
                    (string) $product->id,
                    $reservationId,
                    InventoryMovementKind::Reserve,
                    (int) $product->stock_quantity,
                    (int) $product->reserved_quantity,
                    0,
                    $quantity,
                    (int) $product->stock_quantity,
                    (int) $product->reserved_quantity + $quantity,
                    (int) $product->inventory_revision,
                    (int) $product->inventory_revision + 1,
                );
            }

            foreach ($lines as $line) {
                $product = $products->get($line['productId']);
                DB::table('products')->where('id', $product->id)->update([
                    'reserved_quantity' => (int) $product->reserved_quantity + (int) $line['quantity'],
                    'inventory_revision' => (int) $product->inventory_revision + 1,
                    'updated_at' => $clock,
                ]);
            }

            return $this->operations->storeResult(
                (string) $operation->id,
                $this->reservationResult($lockedTenant, $operation, false),
            );
        })));
    }

    /** @return array<string, mixed> */
    public function release(Tenant $tenant, string $reservationId, string $idempotencyKey, InventoryActorType $actorType, ?string $actorUserId, string $source, ?string $requestId = null): array
    {
        return $this->terminal($tenant, $reservationId, InventoryReservationStatus::Released, InventoryOperationKind::ReservationRelease, InventoryMovementKind::Release, $idempotencyKey, $actorType, $actorUserId, $source, $requestId);
    }

    /** @return array<string, mixed> */
    public function commit(Tenant $tenant, string $reservationId, string $idempotencyKey, InventoryActorType $actorType, ?string $actorUserId, string $source, ?string $requestId = null): array
    {
        return $this->terminal($tenant, $reservationId, InventoryReservationStatus::Committed, InventoryOperationKind::ReservationCommit, InventoryMovementKind::Commit, $idempotencyKey, $actorType, $actorUserId, $source, $requestId);
    }

    /** @return array<string, mixed> */
    public function expire(Tenant $tenant, string $reservationId): array
    {
        return $this->terminal(
            $tenant,
            $reservationId,
            InventoryReservationStatus::Expired,
            InventoryOperationKind::ReservationExpire,
            InventoryMovementKind::Expire,
            InventoryIdentity::expiration($reservationId),
            InventoryActorType::System,
            null,
            'inventory_expiry',
            null,
        );
    }

    public function expireDueBatch(Tenant $tenant, int $limit = 100): int
    {
        $ids = $this->withLockedTenant($tenant, false, function (Tenant $lockedTenant) use ($limit): array {
            return $lockedTenant->run(function () use ($limit): array {
                return DB::transaction(fn () => DB::table('inventory_reservations')
                    ->where('status', InventoryReservationStatus::Active->value)
                    ->where('expires_at', '<=', DB::raw('clock_timestamp()'))
                    ->orderBy('expires_at')->orderBy('id')->lock('FOR UPDATE SKIP LOCKED')
                    ->limit(max(1, min($limit, 500)))->pluck('id')->map('strval')->all());
            });
        });
        foreach ($ids as $id) {
            $this->expire($tenant, $id);
        }

        return count($ids);
    }

    /** @return array<string, mixed> */
    private function terminal(
        Tenant $tenant,
        string $reservationId,
        InventoryReservationStatus $target,
        InventoryOperationKind $operationKind,
        InventoryMovementKind $movementKind,
        string $idempotencyKey,
        InventoryActorType $actorType,
        ?string $actorUserId,
        string $source,
        ?string $requestId,
    ): array {
        $payload = ['reservationId' => $reservationId, 'target' => $target->value];

        $fullReadiness = $target === InventoryReservationStatus::Committed;

        return $this->withLockedTenant($tenant, $fullReadiness, fn (Tenant $lockedTenant): array => $lockedTenant->run(fn (): array => DB::transaction(function () use ($lockedTenant, $reservationId, $target, $operationKind, $movementKind, $idempotencyKey, $actorType, $actorUserId, $source, $requestId, $payload): array {
            $reservation = DB::table('inventory_reservations')->where('id', $reservationId)->lockForUpdate()->first();
            if ($reservation === null) {
                throw new InventoryConflict('The inventory reservation does not exist.', 'inventory_reservation_missing');
            }
            $claim = $this->operations->claim(
                $operationKind,
                $source,
                $idempotencyKey,
                $payload,
                $actorType,
                $actorUserId,
                $source,
                'inventory_reservation_'.$target->value,
                requestId: $requestId,
            );
            $operation = $claim['operation'];
            if ($claim['replayed']) {
                return $this->operations->replayResult((string) $operation->id);
            }
            if ($reservation->status !== InventoryReservationStatus::Active->value) {
                throw new InventoryConflict('The reservation is already terminal.', 'inventory_reservation_terminal');
            }
            $clock = CarbonImmutable::parse((string) DB::selectOne('SELECT clock_timestamp() AS current_time')->current_time);
            if ($target === InventoryReservationStatus::Expired && $clock->lt(CarbonImmutable::parse((string) $reservation->expires_at))) {
                throw new InventoryConflict('The reservation is not due for expiration.', 'inventory_reservation_not_due');
            }
            $items = DB::table('inventory_reservation_items')->where('reservation_id', $reservationId)
                ->orderBy('product_id')->get();
            $products = DB::table('products')->whereIn('id', $items->pluck('product_id'))
                ->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            foreach ($items as $item) {
                $product = $products->get($item->product_id);
                if ($product === null || (int) $product->reserved_quantity < (int) $item->quantity) {
                    throw new InventoryConflict('Reservation balances are inconsistent.', 'inventory_reservation_inconsistent');
                }
                $quantity = (int) $item->quantity;
                $onHandDelta = $target === InventoryReservationStatus::Committed ? -$quantity : 0;
                $this->ledger->insertMovement(
                    (string) $operation->id,
                    (string) $product->id,
                    $reservationId,
                    $movementKind,
                    (int) $product->stock_quantity,
                    (int) $product->reserved_quantity,
                    $onHandDelta,
                    -$quantity,
                    (int) $product->stock_quantity + $onHandDelta,
                    (int) $product->reserved_quantity - $quantity,
                    (int) $product->inventory_revision,
                    (int) $product->inventory_revision + 1,
                );
            }
            $this->ledger->bindOperation((string) $operation->id);
            foreach ($items as $item) {
                $product = $products->get($item->product_id);
                DB::table('products')->where('id', $product->id)->update([
                    'stock_quantity' => (int) $product->stock_quantity + ($target === InventoryReservationStatus::Committed ? -(int) $item->quantity : 0),
                    'reserved_quantity' => (int) $product->reserved_quantity - (int) $item->quantity,
                    'inventory_revision' => (int) $product->inventory_revision + 1,
                    'updated_at' => $clock,
                ]);
            }
            DB::table('inventory_reservations')->where('id', $reservationId)->update([
                'status' => $target->value,
                'terminal_operation_id' => $operation->id,
                'terminal_at' => $clock,
                'updated_at' => $clock,
            ]);

            return $this->operations->storeResult(
                (string) $operation->id,
                $this->reservationResult($lockedTenant, $operation, false),
            );
        })));
    }

    /** @return array<string, mixed> */
    private function reservationResult(Tenant $tenant, object $operation, bool $replayed): array
    {
        $reservation = DB::table('inventory_reservations')
            ->where('created_by_operation_id', $operation->id)
            ->orWhere('terminal_operation_id', $operation->id)->first();
        if ($reservation === null) {
            throw new InventoryConflict('The reservation replay is unavailable.', 'inventory_not_ready');
        }
        $items = DB::table('inventory_reservation_items')->where('reservation_id', $reservation->id)
            ->orderBy('product_id')->get()->map(fn (object $item): array => [
                'productId' => (string) $item->product_id,
                'quantity' => (int) $item->quantity,
            ])->all();

        return [
            'tenantId' => (string) $tenant->getKey(),
            'operationId' => (string) $operation->id,
            'replayed' => $replayed,
            'reservation' => [
                'id' => (string) $reservation->id,
                'status' => (string) $reservation->status,
                'referenceType' => (string) $reservation->reference_type,
                'referenceId' => (string) $reservation->reference_id,
                'expiresAt' => (string) $reservation->expires_at,
                'terminalAt' => $reservation->terminal_at,
                'items' => $items,
            ],
        ];
    }

    /**
     * @template T
     *
     * @param  callable(Tenant): T  $operation
     * @return T
     */
    private function withLockedTenant(Tenant $tenant, bool $fullReadiness, callable $operation): mixed
    {
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        return $central->transaction(function () use ($tenant, $fullReadiness, $operation): mixed {
            $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->first();
            if (! $lockedTenant instanceof Tenant) {
                throw new InventoryConflict('The inventory tenant no longer exists.', 'inventory_not_ready');
            }
            $ready = $fullReadiness
                ? TenantWorkspaceReadiness::check($lockedTenant)
                : TenantWorkspaceReadiness::maintenanceCheck($lockedTenant);
            if (! $ready) {
                throw new InventoryConflict('The tenant inventory is not ready.', 'inventory_not_ready');
            }

            return $operation($lockedTenant);
        });
    }
}
