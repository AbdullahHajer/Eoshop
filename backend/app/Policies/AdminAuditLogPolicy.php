<?php

namespace App\Policies;

use App\Enums\PermissionKey;
use App\Models\AdminAuditLog;
use App\Models\User;

class AdminAuditLogPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformAuditView);
    }

    public function view(User $user, AdminAuditLog $auditLog): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformAuditView);
    }

    public function create(User $user): bool
    {
        return false;
    }

    public function update(User $user, AdminAuditLog $auditLog): bool
    {
        return false;
    }

    public function delete(User $user, AdminAuditLog $auditLog): bool
    {
        return false;
    }
}
