<?php

use App\Enums\PermissionKey;
use App\Enums\RoleScope;
use App\Enums\SystemRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([PermissionKey::TenantInventoryView, PermissionKey::TenantInventoryManage] as $permission) {
            DB::table('permissions')->updateOrInsert(
                ['key' => $permission->value],
                [
                    'name' => $permission->displayName(),
                    'scope' => RoleScope::Tenant->value,
                    'updated_at' => now(),
                    'created_at' => now(),
                ],
            );
        }

        $permissionIds = DB::table('permissions')
            ->whereIn('key', [PermissionKey::TenantInventoryView->value, PermissionKey::TenantInventoryManage->value])
            ->pluck('id', 'key');
        $roleIds = DB::table('roles')
            ->whereIn('key', [SystemRole::MerchantOwner->value, SystemRole::MerchantStaff->value])
            ->pluck('id');

        foreach ($roleIds as $roleId) {
            foreach ($permissionIds as $permissionId) {
                DB::table('permission_role')->insertOrIgnore([
                    'permission_id' => $permissionId,
                    'role_id' => $roleId,
                    'scope' => RoleScope::Tenant->value,
                ]);
            }
        }
    }

    public function down(): void
    {
        $permissionIds = DB::table('permissions')
            ->whereIn('key', [PermissionKey::TenantInventoryView->value, PermissionKey::TenantInventoryManage->value])
            ->pluck('id');
        $systemRoleIds = DB::table('roles')
            ->whereIn('key', [SystemRole::MerchantOwner->value, SystemRole::MerchantStaff->value])
            ->pluck('id');

        DB::table('permission_role')
            ->whereIn('permission_id', $permissionIds)
            ->whereIn('role_id', $systemRoleIds)
            ->delete();

        if (DB::table('permission_role')->whereIn('permission_id', $permissionIds)->exists()) {
            throw new RuntimeException('WP 4.2 inventory permissions are assigned to non-system roles and cannot be removed safely.');
        }

        DB::table('permissions')->whereIn('id', $permissionIds)->delete();
    }
};
