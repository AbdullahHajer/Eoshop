<?php

namespace App\Support;

use App\Enums\ProvisioningState;
use App\Enums\TenantVerificationStatus;
use App\Models\ProvisioningRun;
use App\Models\Tenant;

class TenantRuntimeReadiness
{
    public static function check(Tenant $tenant): bool
    {
        $tenant->loadMissing('latestProvisioningRun');
        $run = $tenant->latestProvisioningRun;
        $schema = TenantSchemaName::for((string) $tenant->getKey());

        return $tenant->getAttribute('verification_status') === TenantVerificationStatus::Approved->value
            && $tenant->getAttribute('provisioning_status') === ProvisioningState::Active->value
            && $run instanceof ProvisioningRun
            && $run->getAttribute('status') === ProvisioningState::Active
            && $run->getAttribute('schema_name') === $schema
            && $run->getAttribute('schema_origin') !== null
            && $run->getAttribute('schema_created_at') !== null
            && $tenant->database()->manager()->databaseExists($schema);
    }
}
