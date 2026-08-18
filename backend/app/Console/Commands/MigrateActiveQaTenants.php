<?php

namespace App\Console\Commands;

use App\Enums\PlanActivationMode;
use App\Enums\ProvisioningState;
use App\Models\Plan;
use App\Models\Tenant;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

class MigrateActiveQaTenants extends Command
{
    protected $signature = 'qa:migrate-active-tenants';

    protected $description = 'Apply current tenant migrations to existing active Pilot tenants only.';

    public function handle(): int
    {
        if (app()->environment('production') || config('app.env') === 'production') {
            $this->components->error('This command is disabled in production.');

            return self::FAILURE;
        }

        $starter = Plan::query()->whereKey('starter')->first();
        if (! $starter instanceof Plan
            || ! $starter->getAttribute('is_active')
            || $starter->getAttribute('activation_mode') !== PlanActivationMode::Automatic) {
            $this->components->error('The starter plan must exist, be active, and use automatic activation before preparing the Pilot.');

            return self::FAILURE;
        }

        $tenants = Tenant::query()
            ->where('provisioning_status', ProvisioningState::Active->value)
            ->orderBy('id')
            ->get();

        foreach ($tenants as $tenant) {
            /** @var Tenant $tenant */
            $schema = (string) $tenant->database()->getName();
            if (! $tenant->database()->manager()->databaseExists($schema)) {
                $this->components->error("Active tenant {$tenant->getKey()} is missing its owned schema; refusing to continue.");

                return self::FAILURE;
            }

            try {
                $exitCode = Artisan::call('tenants:migrate', [
                    '--tenants' => (string) $tenant->getKey(),
                    '--force' => true,
                    '--no-interaction' => true,
                ]);
                if ($exitCode !== self::SUCCESS) {
                    $this->components->error("Tenant migration failed for {$tenant->getKey()}.");

                    return self::FAILURE;
                }
            } finally {
                if (tenancy()->initialized) {
                    tenancy()->end();
                }
                DB::setDefaultConnection((string) config('tenancy.database.central_connection'));
                DB::purge('tenant');
            }
        }

        $this->components->info("Active Pilot tenant migrations complete: {$tenants->count()} tenant(s).");

        return self::SUCCESS;
    }
}
