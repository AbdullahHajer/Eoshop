<?php

namespace App\Services;

use App\Exceptions\ProvisioningFailure;
use App\Models\StoreSubmission;
use App\Models\Tenant;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TenantProvisioningExecutor
{
    public function migrate(Tenant $tenant): void
    {
        $exitCode = Artisan::call('tenants:migrate', [
            '--tenants' => [$tenant->getKey()],
            '--force' => true,
            '--no-interaction' => true,
        ]);

        if ($exitCode !== 0) {
            throw new ProvisioningFailure('tenant_migrations_failed', 'Tenant database migrations did not complete.');
        }
    }

    public function initializeConfig(Tenant $tenant, StoreSubmission $submission): void
    {
        $payload = $submission->getAttribute('payload_snapshot');
        $config = is_array($payload) ? ($payload['config'] ?? null) : null;

        if (! is_array($config)) {
            throw new ProvisioningFailure('initial_config_missing', 'The initial store configuration is unavailable.');
        }

        $tenant->run(static function () use ($submission, $config): void {
            DB::table('store_configs')->updateOrInsert(
                ['id' => $submission->getAttribute('initial_config_id')],
                [
                    'config_json' => json_encode($config, JSON_THROW_ON_ERROR),
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        });
    }

    public function assertReady(Tenant $tenant, StoreSubmission $submission): void
    {
        $ready = $tenant->run(static fn (): bool => Schema::hasTable('store_configs')
            && DB::table('store_configs')->where('id', $submission->getAttribute('initial_config_id'))->exists());

        if (! $ready) {
            throw new ProvisioningFailure('tenant_readiness_failed', 'The tenant database did not pass its readiness check.');
        }
    }
}
