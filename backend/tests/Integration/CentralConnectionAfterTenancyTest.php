<?php

namespace Tests\Integration;

use App\Enums\PermissionKey;
use App\Enums\SystemRole;
use App\Enums\UserStatus;
use App\Models\AdminAuditLog;
use App\Models\DomainReservation;
use App\Models\Plan;
use App\Models\PlatformNavigationItem;
use App\Models\PlatformSetting;
use App\Models\PublicationRequest;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Services\RoleAssignmentService;
use Database\Seeders\IdentitySeeder;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('database')]
class CentralConnectionAfterTenancyTest extends TestCase
{
    public function test_permission_queries_stay_on_central_connection_after_tenancy_initializes(): void
    {
        $this->seed(IdentitySeeder::class);
        $central = DB::connection((string) config('tenancy.database.central_connection'));
        $tenantId = 'authz_context';
        $tenant = Tenant::query()->create([
            'id' => $tenantId,
            'store_name' => 'Authorization Context Store',
            'owner_name' => 'Context Owner',
            'owner_email' => 'context-owner@example.com',
            'business_type' => 'retail',
        ]);
        $schema = (string) $tenant->database()->getName();
        $central->statement("CREATE SCHEMA IF NOT EXISTS {$schema}");
        $owner = User::query()->create([
            'name' => 'Context Owner',
            'email' => 'context-user@example.com',
            'status' => UserStatus::Active,
        ]);
        app(RoleAssignmentService::class)->assignTenantRole(
            $tenant,
            $owner,
            Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail(),
            $owner,
        );

        try {
            tenancy()->initialize($tenant);

            $this->assertSame('tenant', DB::getDefaultConnection());
            $this->assertTrue($owner->hasTenantPermission($tenant, PermissionKey::TenantStoreManage));
            $this->assertSame((string) config('tenancy.database.central_connection'), $owner->getConnectionName());
            $this->assertSame(3, Plan::query()->count());
            $this->assertSame(0, DomainReservation::query()->where('tenant_id', $tenantId)->count());
            $this->assertSame(0, PublicationRequest::query()->where('tenant_id', $tenantId)->count());
            $this->assertSame(0, TenantSubscription::query()->where('tenant_id', $tenantId)->count());
            $this->assertSame(1, PlatformSetting::query()->whereKey(PlatformSetting::SINGLETON_ID)->count());
            $this->assertSame(3, PlatformNavigationItem::query()->where('platform_setting_id', PlatformSetting::SINGLETON_ID)->count());
            $this->assertSame((string) config('tenancy.database.central_connection'), (new Plan)->getConnectionName());
            $this->assertSame((string) config('tenancy.database.central_connection'), (new DomainReservation)->getConnectionName());
            $this->assertSame((string) config('tenancy.database.central_connection'), (new PublicationRequest)->getConnectionName());
            $this->assertSame((string) config('tenancy.database.central_connection'), (new TenantSubscription)->getConnectionName());
            $this->assertSame((string) config('tenancy.database.central_connection'), (new PlatformSetting)->getConnectionName());
            $this->assertSame((string) config('tenancy.database.central_connection'), (new PlatformNavigationItem)->getConnectionName());
        } finally {
            tenancy()->end();
            $central->table('tenant_user')->where('tenant_id', $tenantId)->delete();
            $central->table('admin_audit_logs')->where('tenant_id', $tenantId)->delete();
            $central->table('users')->where('id', $owner->getKey())->delete();
            $central->table('tenants')->where('id', $tenantId)->delete();
            $central->statement("DROP SCHEMA IF EXISTS {$schema} CASCADE");
        }

        $this->assertSame(0, AdminAuditLog::query()->where('tenant_id', $tenantId)->count());
    }
}
