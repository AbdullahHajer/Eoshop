<?php

namespace App\Services\Marketing;

use App\Enums\PermissionKey;
use App\Enums\TenantMembershipStatus;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

final class MarketingTenantAccess
{
    /**
     * Lock order: central tenant, active membership, then tenant-schema rows.
     *
     * @template T
     *
     * @param  callable(Tenant): T  $operation
     * @return T
     */
    public function forManager(Tenant $tenant, User $actor, callable $operation): mixed
    {
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        return $central->transaction(function () use ($central, $tenant, $actor, $operation): mixed {
            $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
            $membership = $central->table('tenant_user')
                ->where('tenant_id', $lockedTenant->getKey())
                ->where('user_id', $actor->getKey())
                ->lockForUpdate()
                ->first();
            if ($membership === null || $membership->status !== TenantMembershipStatus::Active->value) {
                throw new AuthorizationException('An active tenant membership is required.');
            }
            if (! $actor->hasTenantPermission($lockedTenant, PermissionKey::TenantStoreManage)) {
                throw new AuthorizationException('Store management permission is required.');
            }

            return $operation($lockedTenant);
        });
    }
}
