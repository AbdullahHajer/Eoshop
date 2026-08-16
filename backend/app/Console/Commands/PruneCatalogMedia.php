<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\CatalogMediaService;
use App\Support\TenantWorkspaceReadiness;
use Illuminate\Console\Command;
use Throwable;

class PruneCatalogMedia extends Command
{
    protected $signature = 'catalog:prune-media {--tenant=* : Limit cleanup to tenant IDs}';

    protected $description = 'Delete safely expired, unattached managed catalog media.';

    public function handle(CatalogMediaService $service): int
    {
        $ids = array_values(array_filter($this->option('tenant'), 'is_string'));
        $query = Tenant::query()->orderBy('id');
        if ($ids !== []) {
            $query->whereIn('id', $ids);
        }
        $deleted = 0;
        $failures = 0;
        $query->each(function (Tenant $tenant) use ($service, &$deleted, &$failures): void {
            if (! TenantWorkspaceReadiness::maintenanceCheck($tenant)) {
                $this->line("Skipped tenant {$tenant->getKey()}: catalog is not ready.");

                return;
            }
            try {
                $deleted += $service->pruneOrphans($tenant);
            } catch (Throwable $exception) {
                $failures++;
                report($exception);
                $this->warn("Failed to prune tenant {$tenant->getKey()}.");
            }
        });
        $this->info("Deleted {$deleted} expired catalog media asset(s).");

        return $failures === 0 ? self::SUCCESS : self::FAILURE;
    }
}
