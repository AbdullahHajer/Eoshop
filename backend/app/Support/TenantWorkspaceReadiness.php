<?php

namespace App\Support;

use App\Enums\ProvisioningState;
use App\Enums\TenantVerificationStatus;
use App\Models\ProvisioningRun;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class TenantWorkspaceReadiness
{
    public static function check(Tenant $tenant): bool
    {
        $tenant->loadMissing('latestProvisioningRun');
        $run = $tenant->latestProvisioningRun;
        $tenantId = (string) $tenant->getKey();
        $schema = TenantSchemaName::for($tenantId);
        $alreadyInitialized = tenancy()->initialized && (string) tenant('id') === $tenantId;

        $centralReady = $tenant->getAttribute('verification_status') === TenantVerificationStatus::Approved->value
            && $tenant->getAttribute('provisioning_status') === ProvisioningState::Active->value
            && $run instanceof ProvisioningRun
            && $run->getAttribute('tenant_id') === $tenantId
            && $run->getAttribute('status') === ProvisioningState::Active
            && $run->getAttribute('schema_name') === $schema
            && $run->getAttribute('schema_origin') !== null
            && $run->getAttribute('schema_created_at') !== null
            && ($alreadyInitialized || $tenant->database()->manager()->databaseExists($schema));

        if (! $centralReady) {
            return false;
        }

        $schemaReady = static fn (): bool => Schema::hasColumns('store_configs', [
            'revision', 'products_materialized', 'is_current',
        ]) && Schema::hasColumns('products', ['image_urls', 'position'])
            && DB::table('store_configs')->where('is_current', true)->count() === 1;

        if ($alreadyInitialized) {
            return $schemaReady();
        }

        return $tenant->run($schemaReady);
    }

    public static function isMaterialized(Tenant $tenant): bool
    {
        if (! self::check($tenant)) {
            return false;
        }

        $materialized = static fn (): bool => DB::table('store_configs')
            ->where('is_current', true)
            ->where('products_materialized', true)
            ->exists();

        return tenancy()->initialized && (string) tenant('id') === (string) $tenant->getKey()
            ? $materialized()
            : $tenant->run($materialized);
    }
}
