<?php

namespace Database\Seeders;

use App\Enums\PermissionKey;
use App\Enums\SystemRole;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class IdentitySeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            foreach (PermissionKey::cases() as $permissionKey) {
                Permission::query()->updateOrCreate(
                    ['key' => $permissionKey->value],
                    [
                        'name' => $permissionKey->displayName(),
                        'scope' => $permissionKey->scope(),
                    ],
                );
            }

            /** @var array<string, int> $permissionIds */
            $permissionIds = Permission::query()->pluck('id', 'key')->all();

            foreach (SystemRole::cases() as $systemRole) {
                $role = Role::query()->updateOrCreate(
                    ['key' => $systemRole->value],
                    [
                        'name' => $systemRole->displayName(),
                        'scope' => $systemRole->scope(),
                        'system' => true,
                    ],
                );

                $role->permissions()->sync(
                    collect($systemRole->permissions())
                        ->mapWithKeys(static fn (PermissionKey $permission): array => [
                            $permissionIds[$permission->value] => ['scope' => $permission->scope()->value],
                        ])
                        ->all(),
                );
            }
        });
    }
}
