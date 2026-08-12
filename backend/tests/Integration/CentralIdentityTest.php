<?php

namespace Tests\Integration;

use App\Enums\PermissionKey;
use App\Enums\RoleScope;
use App\Enums\SystemRole;
use App\Enums\UserStatus;
use App\Models\AdminAuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Services\RoleAssignmentService;
use Database\Seeders\IdentitySeeder;
use DomainException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('database')]
class CentralIdentityTest extends TestCase
{
    use DatabaseTransactions;

    public function test_identity_seeder_is_idempotent_and_maps_system_permissions(): void
    {
        $this->seed(IdentitySeeder::class);
        $this->seed(IdentitySeeder::class);

        $this->assertSame(count(SystemRole::cases()), Role::query()->count());
        $this->assertSame(count(PermissionKey::cases()), Permission::query()->count());

        foreach (SystemRole::cases() as $systemRole) {
            $actual = Role::query()
                ->where('key', $systemRole->value)
                ->firstOrFail()
                ->permissions()
                ->pluck('key')
                ->sort()
                ->values()
                ->all();

            $expected = collect($systemRole->permissions())
                ->map(static fn (PermissionKey $permission): string => $permission->value)
                ->sort()
                ->values()
                ->all();

            $this->assertSame($expected, $actual, "Permission map differs for {$systemRole->value}.");
        }
    }

    public function test_user_normalizes_email_hashes_password_and_hides_credentials(): void
    {
        $user = User::query()->create([
            'name' => 'Merchant Owner',
            'email' => '  Owner@Example.COM ',
            'password' => 'temporary-test-password',
            'status' => UserStatus::Active,
        ]);
        $user->setRememberToken('not-for-serialization');

        $this->assertSame('owner@example.com', $user->email);
        $this->assertTrue(Hash::check('temporary-test-password', $user->password));
        $this->assertArrayNotHasKey('password', $user->toArray());
        $this->assertArrayNotHasKey('remember_token', $user->toArray());
    }

    public function test_normalized_email_must_be_unique(): void
    {
        User::query()->create([
            'name' => 'First User',
            'email' => 'person@example.com',
        ]);

        $this->expectException(QueryException::class);

        User::query()->create([
            'name' => 'Duplicate User',
            'email' => 'PERSON@EXAMPLE.COM',
        ]);
    }

    public function test_permissions_are_scoped_per_platform_and_tenant_and_assignments_are_audited(): void
    {
        $this->seed(IdentitySeeder::class);

        $actor = $this->createUser('admin@example.com');
        $merchant = $this->createUser('merchant@example.com');
        $firstTenant = $this->createTenant('store-first');
        $secondTenant = $this->createTenant('store-second');
        $service = app(RoleAssignmentService::class);

        $service->assignPlatformRole(
            $actor,
            Role::query()->where('key', SystemRole::PlatformSuperAdmin->value)->firstOrFail(),
            $actor,
        );
        $service->assignTenantRole(
            $firstTenant,
            $merchant,
            Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail(),
            $actor,
        );
        $service->assignTenantRole(
            $secondTenant,
            $merchant,
            Role::query()->where('key', SystemRole::MerchantStaff->value)->firstOrFail(),
            $actor,
        );

        $this->assertTrue($actor->hasPlatformPermission(PermissionKey::PlatformUsersManage));
        $this->assertFalse($merchant->hasPlatformPermission(PermissionKey::PlatformUsersManage));
        $this->assertTrue($merchant->hasTenantPermission($firstTenant, PermissionKey::TenantMembersManage));
        $this->assertFalse($merchant->hasTenantPermission($secondTenant, PermissionKey::TenantMembersManage));
        $this->assertTrue($merchant->hasTenantPermission($secondTenant, PermissionKey::TenantProductsManage));
        $this->assertSame(3, AdminAuditLog::query()->count());

        $merchant->update(['status' => UserStatus::Suspended]);

        $this->assertFalse($merchant->hasTenantPermission($firstTenant, PermissionKey::TenantProductsManage));

        $merchant->update(['status' => UserStatus::Active]);

        $service->assignTenantRole(
            $secondTenant,
            $merchant,
            Role::query()->where('key', SystemRole::MerchantStaff->value)->firstOrFail(),
            $actor,
        );

        $this->assertSame(1, DB::table('tenant_user')->where('tenant_id', $secondTenant->getKey())->count());
        $this->assertSame(3, AdminAuditLog::query()->count(), 'Idempotent assignment must not create duplicate audit records.');

        $replacementActor = $this->createUser('replacement-admin@example.com');
        $service->assignTenantRole(
            $secondTenant,
            $merchant,
            Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail(),
            $replacementActor,
        );

        $membership = DB::table('tenant_user')
            ->where('tenant_id', $secondTenant->getKey())
            ->where('user_id', $merchant->getKey())
            ->first();

        $this->assertNotNull($membership);
        $this->assertSame($actor->getKey(), $membership->invited_by, 'Role changes must preserve the original inviter.');
        $this->assertTrue($merchant->hasTenantPermission($secondTenant, PermissionKey::TenantMembersManage));
        $this->assertSame(4, AdminAuditLog::query()->count());
    }

    public function test_platform_role_cannot_be_assigned_to_a_tenant_membership(): void
    {
        $this->seed(IdentitySeeder::class);

        $this->expectException(DomainException::class);

        $actor = $this->createUser('scope-actor@example.com');

        app(RoleAssignmentService::class)->assignTenantRole(
            $this->createTenant('scope-tenant'),
            $this->createUser('scope@example.com'),
            Role::query()->where('key', SystemRole::PlatformReviewer->value)->firstOrFail(),
            $actor,
        );
    }

    public function test_tenant_role_cannot_be_assigned_as_a_platform_role(): void
    {
        $this->seed(IdentitySeeder::class);

        $this->expectException(DomainException::class);

        $actor = $this->createUser('other-scope-actor@example.com');

        app(RoleAssignmentService::class)->assignPlatformRole(
            $this->createUser('other-scope@example.com'),
            Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail(),
            $actor,
        );
    }

    public function test_database_rejects_cross_scope_permission_mapping(): void
    {
        $this->seed(IdentitySeeder::class);

        $tenantRole = Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail();
        $platformPermission = Permission::query()->where('key', PermissionKey::PlatformUsersManage->value)->firstOrFail();

        $this->expectException(QueryException::class);

        DB::table('permission_role')->insert([
            'permission_id' => $platformPermission->getKey(),
            'role_id' => $tenantRole->getKey(),
            'scope' => RoleScope::Tenant->value,
        ]);
    }

    public function test_database_rejects_platform_role_in_tenant_membership(): void
    {
        $this->seed(IdentitySeeder::class);

        $tenant = $this->createTenant('database-scope-tenant');
        $user = $this->createUser('database-scope@example.com');
        $platformRole = Role::query()->where('key', SystemRole::PlatformReviewer->value)->firstOrFail();

        $this->expectException(QueryException::class);

        DB::table('tenant_user')->insert([
            'tenant_id' => $tenant->getKey(),
            'user_id' => $user->getKey(),
            'role_id' => $platformRole->getKey(),
            'role_scope' => RoleScope::Tenant->value,
            'status' => 'active',
            'joined_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_audit_identifiers_survive_hard_deletion_of_actor_and_tenant(): void
    {
        $this->seed(IdentitySeeder::class);

        $actor = $this->createUser('audit-actor@example.com');
        $merchant = $this->createUser('audit-merchant@example.com');
        $tenant = $this->createTenant('audit-store');

        app(RoleAssignmentService::class)->assignTenantRole(
            $tenant,
            $merchant,
            Role::query()->where('key', SystemRole::MerchantStaff->value)->firstOrFail(),
            $actor,
        );

        $auditId = AdminAuditLog::query()->value('id');
        $actorId = (string) $actor->getKey();
        $tenantId = (string) $tenant->getKey();

        DB::table('users')->where('id', $actorId)->delete();
        DB::table('tenants')->where('id', $tenantId)->delete();

        $audit = AdminAuditLog::query()->findOrFail($auditId);

        $this->assertSame($actorId, $audit->actor_user_id);
        $this->assertSame($tenantId, $audit->tenant_id);
    }

    private function createUser(string $email): User
    {
        return User::query()->create([
            'name' => 'Identity Test User',
            'email' => $email,
            'status' => UserStatus::Active,
        ]);
    }

    private function createTenant(string $id): Tenant
    {
        DB::table('tenants')->insert([
            'id' => $id,
            'store_name' => "Store {$id}",
            'owner_name' => 'Identity Test Owner',
            'owner_email' => "{$id}@example.com",
            'business_type' => 'retail',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return Tenant::query()->findOrFail($id);
    }
}
