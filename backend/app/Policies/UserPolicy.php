<?php

namespace App\Policies;

use App\Enums\PermissionKey;
use App\Models\User;

class UserPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->hasPlatformPermission(PermissionKey::PlatformUsersManage);
    }

    public function view(User $actor, User $user): bool
    {
        return $actor->hasPlatformPermission(PermissionKey::PlatformUsersManage);
    }

    public function create(User $actor): bool
    {
        return $actor->hasPlatformPermission(PermissionKey::PlatformUsersManage);
    }

    public function update(User $actor, User $user): bool
    {
        return $actor->hasPlatformPermission(PermissionKey::PlatformUsersManage);
    }

    public function delete(User $actor, User $user): bool
    {
        return false;
    }
}
