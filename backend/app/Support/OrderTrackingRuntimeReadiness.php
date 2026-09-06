<?php

namespace App\Support;

use App\Enums\ProvisioningState;
use App\Models\Domain;
use App\Models\ProvisioningRun;
use App\Models\Tenant;

final class OrderTrackingRuntimeReadiness
{
    public static function domainCheck(Tenant $tenant, string $host): bool
    {
        $tenant->loadMissing(['latestProvisioningRun', 'publishedDomain']);
        $publishedDomain = $tenant->publishedDomain;
        $run = $tenant->latestProvisioningRun;
        $tenantId = (string) $tenant->getKey();
        $schema = TenantSchemaName::for($tenantId);

        return $publishedDomain instanceof Domain
            && $tenant->getAttribute('published_domain_id') === $publishedDomain->getKey()
            && $publishedDomain->getAttribute('tenant_id') === $tenantId
            && $publishedDomain->getAttribute('domain') === $host
            && $tenant->getAttribute('provisioning_status') === ProvisioningState::Active->value
            && $run instanceof ProvisioningRun
            && $run->getAttribute('tenant_id') === $tenantId
            && $run->getAttribute('status') === ProvisioningState::Active
            && $run->getAttribute('schema_name') === $schema
            && $run->getAttribute('schema_origin') !== null
            && $run->getAttribute('schema_created_at') !== null
            && $tenant->database()->manager()->databaseExists($schema);
    }
}
