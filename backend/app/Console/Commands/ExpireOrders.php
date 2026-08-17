<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\OrderService;
use Illuminate\Console\Command;
use Throwable;

class ExpireOrders extends Command
{
    protected $signature = 'orders:expire {--tenant=* : Limit expiration to tenant IDs} {--limit=100 : Maximum due orders per tenant}';

    protected $description = 'Expire submitted orders and release their stock reservations atomically.';

    public function handle(OrderService $orders): int
    {
        $ids = array_values(array_filter($this->option('tenant'), 'is_string'));
        $query = Tenant::query()->orderBy('id');
        if ($ids !== []) {
            $query->whereIn('id', $ids);
        }
        $expired = 0;
        $failures = 0;
        $query->each(function (Tenant $tenant) use ($orders, &$expired, &$failures): void {
            try {
                $expired += $orders->expireDueBatch($tenant, (int) $this->option('limit'));
            } catch (Throwable $exception) {
                $failures++;
                report($exception);
                $this->warn("Failed to expire orders for tenant {$tenant->getKey()}.");
            }
        });
        $this->info("Expired {$expired} order(s).");

        return $failures === 0 ? self::SUCCESS : self::FAILURE;
    }
}
