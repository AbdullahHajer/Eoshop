<?php

namespace App\Services;

use App\Enums\SystemRole;
use App\Enums\TenantMembershipStatus;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class MerchantMembershipService
{
    public function lockActiveOwner(Tenant $tenant, User $actor): void
    {
        $membership = DB::connection((string) config('tenancy.database.central_connection'))
            ->table('tenant_user')
            ->where('tenant_id', $tenant->getKey())
            ->where('user_id', $actor->getKey())
            ->lockForUpdate()
            ->first(['role_id', 'status']);

        if ($membership === null
            || $membership->status !== TenantMembershipStatus::Active->value
            || ! DB::connection((string) config('tenancy.database.central_connection'))
                ->table('roles')
                ->where('id', $membership->role_id)
                ->where('key', SystemRole::MerchantOwner->value)
                ->exists()
        ) {
            throw new AuthorizationException('An active merchant-owner membership is required.');
        }
    }
}
