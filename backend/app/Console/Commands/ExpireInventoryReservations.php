<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\InventoryReservationService;
use App\Support\TenantWorkspaceReadiness;
use Illuminate\Console\Command;
use Throwable;

class ExpireInventoryReservations extends Command
{
    protected $signature = 'inventory:expire-reservations {--tenant=* : Limit expiration to tenant IDs} {--limit=100 : Maximum due reservations per tenant}';

    protected $description = 'Release stock held by expired internal inventory reservations.';

    public function handle(InventoryReservationService $service): int
    {
        $ids = array_values(array_filter($this->option('tenant'), 'is_string'));
        $query = Tenant::query()->orderBy('id');
        if ($ids !== []) {
            $query->whereIn('id', $ids);
        }
        $expired = 0;
        $failures = 0;
        $query->each(function (Tenant $tenant) use ($service, &$expired, &$failures): void {
            if (! TenantWorkspaceReadiness::maintenanceCheck($tenant)) {
                return;
            }
            try {
                $expired += $service->expireDueBatch($tenant, (int) $this->option('limit'));
            } catch (Throwable $exception) {
                $failures++;
                report($exception);
                $this->warn("Failed to expire reservations for tenant {$tenant->getKey()}.");
            }
        });
        $this->info("Expired {$expired} inventory reservation(s).");

        return $failures === 0 ? self::SUCCESS : self::FAILURE;
    }
}
