<?php

namespace App\Policies;

use App\Enums\PermissionKey;
use App\Enums\TenantVerificationStatus;
use App\Models\Tenant;
use App\Models\User;

class TenantPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformStoresView);
    }

    public function view(User $user, Tenant $tenant): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformStoresView);
    }

    public function changeAnyStatus(User $user, Tenant $tenant): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformStoresReview)
            || $user->hasPlatformPermission(PermissionKey::PlatformStoresManage);
    }

    public function changeStatus(User $user, Tenant $tenant, TenantVerificationStatus $status): bool
    {
        $currentStatus = TenantVerificationStatus::from((string) $tenant->getAttribute('verification_status'));

        if ($currentStatus === $status) {
            return $user->hasPlatformPermission(PermissionKey::PlatformStoresManage);
        }

        return match ([$currentStatus, $status]) {
            [TenantVerificationStatus::Pending, TenantVerificationStatus::Approved],
            [TenantVerificationStatus::Pending, TenantVerificationStatus::Rejected] => $user->hasPlatformPermission(PermissionKey::PlatformStoresReview),
            [TenantVerificationStatus::Approved, TenantVerificationStatus::Suspended],
            [TenantVerificationStatus::Suspended, TenantVerificationStatus::Approved],
            [TenantVerificationStatus::Rejected, TenantVerificationStatus::Pending] => $user->hasPlatformPermission(PermissionKey::PlatformStoresManage),
            default => false,
        };
    }

    public function update(User $user, Tenant $tenant): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformStoresManage);
    }

    public function delete(User $user, Tenant $tenant): bool
    {
        return false;
    }

    public function updateStoreConfig(User $user, Tenant $tenant): bool
    {
        return $user->hasTenantPermission($tenant, PermissionKey::TenantStoreManage);
    }
}
