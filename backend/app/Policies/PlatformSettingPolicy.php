<?php

namespace App\Policies;

use App\Enums\PermissionKey;
use App\Models\PlatformSetting;
use App\Models\User;

class PlatformSettingPolicy
{
    public function view(User $user, PlatformSetting $setting): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformSettingsManage);
    }

    public function update(User $user, PlatformSetting $setting): bool
    {
        return $user->hasPlatformPermission(PermissionKey::PlatformSettingsManage);
    }

    public function delete(User $user, PlatformSetting $setting): bool
    {
        return false;
    }
}
