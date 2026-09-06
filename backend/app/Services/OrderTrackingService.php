<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Exceptions\OrderConflict;
use App\Models\Tenant;
use App\Support\OrderReadiness;
use App\Support\OrderTrackingToken;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class OrderTrackingService
{
    /** @return array<string, mixed> */
    public function read(Tenant $tenant, string $token): array
    {
        $digest = OrderTrackingToken::digest($token);
        if ($digest === null) {
            $this->notFound();
        }
        if (! OrderReadiness::trackingCheck($tenant)) {
            throw new OrderConflict('Order tracking is temporarily unavailable.', 'order_tracking_unavailable', 503);
        }

        return DB::connection('tenant')->transaction(function () use ($digest): array {
            DB::connection('tenant')->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
            $row = DB::table('order_guest_access as access')
                ->join('orders', 'orders.id', '=', 'access.order_id')
                ->join('order_fulfillments as fulfillment', 'fulfillment.order_id', '=', 'orders.id')
                ->where('access.token_digest', $digest)
                ->first([
                    'orders.id', 'orders.order_number', 'orders.status as order_status',
                    'orders.created_at as order_created_at', 'orders.updated_at as order_updated_at',
                    'orders.cancelled_at', 'orders.expired_at',
                    'fulfillment.status as fulfillment_status', 'fulfillment.delivered_at',
                    'fulfillment.updated_at as fulfillment_updated_at',
                ]);
            if ($row === null || $this->expired($row)) {
                $this->notFound();
            }

            $timeline = collect();
            DB::table('order_status_history')->where('order_id', $row->id)->orderBy('sequence')->get()
                ->each(function (object $event) use ($timeline): void {
                    $stage = match ((string) $event->to_status) {
                        OrderStatus::Submitted->value => 'submitted',
                        OrderStatus::Accepted->value => 'accepted',
                        OrderStatus::Cancelled->value => 'cancelled',
                        OrderStatus::Expired->value => 'expired',
                        default => null,
                    };
                    if ($stage !== null) {
                        $timeline->push(['stage' => $stage, 'occurredAt' => $this->timestamp($event->created_at)]);
                    }
                });
            DB::table('order_fulfillment_events')->where('order_id', $row->id)->orderBy('sequence')->get()
                ->each(function (object $event) use ($timeline): void {
                    $stage = match ((string) $event->to_status) {
                        'preparing' => 'preparing',
                        'dispatched' => 'dispatched',
                        'delivered' => 'delivered',
                        'legacy_completed' => 'legacy_completed',
                        default => null,
                    };
                    if ($stage !== null) {
                        $timeline->push(['stage' => $stage, 'occurredAt' => $this->timestamp($event->created_at)]);
                    }
                });

            return [
                'number' => (string) $row->order_number,
                'orderStatus' => (string) $row->order_status,
                'fulfillmentStatus' => (string) $row->fulfillment_status,
                'createdAt' => $this->timestamp($row->order_created_at),
                'updatedAt' => max(
                    $this->timestamp($row->order_updated_at),
                    $this->timestamp($row->fulfillment_updated_at),
                ),
                'timeline' => $timeline->sortBy('occurredAt')->values()->all(),
            ];
        });
    }

    private function expired(object $row): bool
    {
        $terminalAt = match ((string) $row->order_status) {
            OrderStatus::Cancelled->value => $row->cancelled_at,
            OrderStatus::Expired->value => $row->expired_at,
            OrderStatus::Completed->value => (string) $row->fulfillment_status === 'delivered'
                ? $row->delivered_at
                : null,
            default => null,
        };
        if ($terminalAt === null) {
            return false;
        }

        $clock = CarbonImmutable::parse((string) DB::selectOne('SELECT clock_timestamp() AS current_time')->current_time);

        return $clock->greaterThan(
            CarbonImmutable::parse((string) $terminalAt)
                ->addDays((int) config('orders.tracking_terminal_ttl_days')),
        );
    }

    private function timestamp(mixed $value): string
    {
        return CarbonImmutable::parse((string) $value)->utc()->toIso8601String();
    }

    private function notFound(): never
    {
        throw new OrderConflict('The order tracking link is invalid or unavailable.', 'order_tracking_not_found', 404);
    }
}
