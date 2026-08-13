<?php

namespace Tests\Integration;

use App\Enums\PermissionKey;
use App\Enums\RoleScope;
use App\Enums\SystemRole;
use App\Enums\TenantMembershipStatus;
use App\Enums\TenantVerificationStatus;
use App\Enums\UserStatus;
use App\Http\Middleware\EnsureTenantPermission;
use App\Models\AdminAuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Policies\TenantPolicy;
use App\Services\AdminAuditService;
use App\Services\PlatformStoreReviewService;
use App\Services\RoleAssignmentService;
use Database\Seeders\IdentitySeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Mockery;
use PHPUnit\Framework\Attributes\Group;
use RuntimeException;
use Tests\TestCase;

#[Group('database')]
class AuthorizationTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
    }

    public function test_admin_routes_return_401_to_guests_and_403_to_users_without_permission(): void
    {
        $tenant = $this->createTenant('authz-boundary');

        $this->getJson('/api/admin/stores')->assertUnauthorized();
        $this->patchJson("/api/admin/stores/{$tenant->getKey()}/status", ['status' => 'approved'])
            ->assertUnauthorized();

        $merchant = $this->createUser('plain-merchant@example.com');
        $this->actingAs($merchant)->getJson('/api/admin/stores')->assertForbidden();
        $this->actingAs($merchant)->patchJson(
            "/api/admin/stores/{$tenant->getKey()}/status",
            [],
        )->assertForbidden();

        $this->assertSame(TenantVerificationStatus::Pending->value, $tenant->refresh()->verification_status);
        $this->assertSame(0, AdminAuditLog::query()->count());
    }

    public function test_reviewer_can_list_and_decide_pending_store_but_cannot_suspend_it(): void
    {
        $reviewer = $this->userWithSystemRole('reviewer@example.com', SystemRole::PlatformReviewer);
        $tenant = $this->createTenant('review-boundary');
        AdminAuditLog::query()->delete();
        $requestId = '11111111-1111-4111-8111-111111111111';

        $this->actingAs($reviewer)->getJson('/api/admin/stores')
            ->assertOk()
            ->assertJsonPath('data.0.id', $tenant->getKey())
            ->assertJsonMissingPath('data.0.data');

        $this->actingAs($reviewer)
            ->withHeaders(['X-Request-ID' => $requestId, 'User-Agent' => str_repeat('a', 1100)])
            ->patchJson("/api/admin/stores/{$tenant->getKey()}/status", ['status' => 'approved'])
            ->assertOk()
            ->assertJsonPath('data.verificationStatus', 'approved')
            ->assertJsonPath('meta.requestId', $requestId);

        $audit = AdminAuditLog::query()->sole();
        $this->assertSame($reviewer->getKey(), $audit->actor_user_id);
        $this->assertSame($tenant->getKey(), $audit->tenant_id);
        $this->assertSame($tenant->getKey(), $audit->subject_id);
        $this->assertSame(['verification_status' => 'pending', 'rejection_reason' => null], $audit->old_values);
        $this->assertSame(['verification_status' => 'approved', 'rejection_reason' => null], $audit->new_values);
        $this->assertSame($requestId, $audit->request_id);
        $this->assertSame('127.0.0.1', $audit->ip_address);
        $this->assertSame(1024, strlen((string) $audit->user_agent));
        $this->assertNotNull($audit->occurred_at);

        $this->actingAs($reviewer)->patchJson(
            "/api/admin/stores/{$tenant->getKey()}/status",
            ['status' => 'suspended', 'reason' => 'Operational suspension'],
        )->assertForbidden();

        $this->assertSame('approved', $tenant->refresh()->verification_status);
        $this->assertSame(1, AdminAuditLog::query()->count());
    }

    public function test_manage_permission_works_without_a_super_admin_role_name_and_only_for_allowed_transitions(): void
    {
        $manager = $this->createUser('custom-manager@example.com');
        $manageRole = Role::query()->create([
            'key' => 'platform_store_operator',
            'name' => 'Platform Store Operator',
            'scope' => RoleScope::Platform,
            'system' => false,
        ]);
        $permission = Permission::query()->where('key', PermissionKey::PlatformStoresManage->value)->firstOrFail();
        $manageRole->permissions()->attach($permission, ['scope' => RoleScope::Platform->value]);
        app(RoleAssignmentService::class)->assignPlatformRole($manager, $manageRole, $manager);
        $tenant = $this->createTenant('manage-transition', TenantVerificationStatus::Approved);
        AdminAuditLog::query()->delete();

        $this->actingAs($manager)->patchJson(
            "/api/admin/stores/{$tenant->getKey()}/status",
            ['status' => 'suspended', 'reason' => 'Risk review'],
        )->assertOk()->assertJsonPath('data.verificationStatus', 'suspended');

        $this->actingAs($manager)->patchJson(
            "/api/admin/stores/{$tenant->getKey()}/status",
            ['status' => 'rejected', 'reason' => 'Invalid transition'],
        )->assertForbidden();

        $this->actingAs($manager)->patchJson(
            "/api/admin/stores/{$tenant->getKey()}",
            ['storeName' => 'Managed Store Name', 'ownerEmail' => ' MANAGED@EXAMPLE.COM '],
        )->assertOk()
            ->assertJsonPath('data.storeName', 'Managed Store Name')
            ->assertJsonPath('data.ownerEmail', 'managed@example.com');

        $this->assertSame('suspended', $tenant->refresh()->verification_status);
        $this->assertSame('Managed Store Name', $tenant->store_name);
        $this->assertSame(2, AdminAuditLog::query()->count());

        $metadataAudit = AdminAuditLog::query()->where('action', 'platform.store.metadata.changed')->sole();
        $this->assertSame(
            ['store_name' => 'Store manage-transition', 'owner_email' => 'manage-transition@example.com'],
            $metadataAudit->old_values,
        );
        $this->assertSame(
            ['store_name' => 'Managed Store Name', 'owner_email' => 'managed@example.com'],
            $metadataAudit->new_values,
        );
    }

    public function test_validation_unknown_tenant_and_no_op_do_not_create_success_audits(): void
    {
        $reviewer = $this->userWithSystemRole('negative-reviewer@example.com', SystemRole::PlatformReviewer);
        $tenant = $this->createTenant('negative-review');
        AdminAuditLog::query()->delete();

        $this->actingAs($reviewer)->patchJson(
            "/api/admin/stores/{$tenant->getKey()}/status",
            ['status' => 'rejected'],
        )->assertUnprocessable();

        $this->actingAs($reviewer)->patchJson(
            "/api/admin/stores/{$tenant->getKey()}/status",
            ['status' => 'pending'],
        )->assertOk();

        $this->actingAs($reviewer)->patchJson(
            '/api/admin/stores/does-not-exist/status',
            ['status' => 'approved'],
        )->assertNotFound();

        $this->assertSame(0, AdminAuditLog::query()->count());
        $this->assertSame('pending', $tenant->refresh()->verification_status);
    }

    public function test_reviewer_cannot_revise_the_reason_of_an_already_decided_store(): void
    {
        $reviewer = $this->userWithSystemRole('reason-reviewer@example.com', SystemRole::PlatformReviewer);
        $tenant = $this->createTenant('reason-revision', TenantVerificationStatus::Rejected);
        $tenant->update(['rejection_reason' => 'Original reason']);
        AdminAuditLog::query()->delete();

        $this->actingAs($reviewer)->patchJson(
            "/api/admin/stores/{$tenant->getKey()}/status",
            ['status' => 'rejected', 'reason' => 'Revised without management authority'],
        )->assertForbidden();

        $this->assertSame('Original reason', $tenant->refresh()->rejection_reason);
        $this->assertSame(0, AdminAuditLog::query()->count());
    }

    public function test_reviewer_cannot_change_platform_managed_metadata_or_delete_a_tenant(): void
    {
        $reviewer = $this->userWithSystemRole('metadata-reviewer@example.com', SystemRole::PlatformReviewer);
        $tenant = $this->createTenant('metadata-denied');
        AdminAuditLog::query()->delete();

        $this->actingAs($reviewer)->patchJson(
            "/api/admin/stores/{$tenant->getKey()}",
            ['storeName' => 'Unauthorized change'],
        )->assertForbidden();
        $this->actingAs($reviewer)->deleteJson("/api/admin/stores/{$tenant->getKey()}")->assertStatus(405);

        $this->assertSame('Store metadata-denied', $tenant->refresh()->store_name);
        $this->assertSame(0, AdminAuditLog::query()->count());
    }

    public function test_database_rejects_unknown_verification_status(): void
    {
        $tenant = $this->createTenant('invalid-verification-status');

        $this->expectException(QueryException::class);
        DB::table('tenants')->where('id', $tenant->getKey())->update([
            'verification_status' => 'invented-in-browser',
        ]);
    }

    public function test_stale_model_is_reauthorized_after_the_database_lock(): void
    {
        $reviewer = $this->userWithSystemRole('stale-reviewer@example.com', SystemRole::PlatformReviewer);
        $staleTenant = $this->createTenant('stale-transition');
        AdminAuditLog::query()->delete();
        DB::connection((string) config('tenancy.database.central_connection'))
            ->table('tenants')
            ->where('id', $staleTenant->getKey())
            ->update(['verification_status' => 'rejected']);

        try {
            app(PlatformStoreReviewService::class)->changeStatus(
                tenant: $staleTenant,
                status: TenantVerificationStatus::Approved,
                reason: null,
                actor: $reviewer,
                request: Request::create('/api/admin/stores/stale-transition/status', 'PATCH'),
            );
            $this->fail('The stale transition was not rejected.');
        } catch (AuthorizationException) {
            $this->assertSame('rejected', $staleTenant->refresh()->verification_status);
            $this->assertSame(0, AdminAuditLog::query()->count());
        }
    }

    public function test_audit_failure_rolls_back_the_store_mutation(): void
    {
        $reviewer = $this->userWithSystemRole('rollback-reviewer@example.com', SystemRole::PlatformReviewer);
        $tenant = $this->createTenant('rollback-review');
        AdminAuditLog::query()->delete();
        $audit = Mockery::mock(AdminAuditService::class);
        $audit->shouldReceive('record')->once()->andThrow(new RuntimeException('audit unavailable'));
        $this->app->instance(AdminAuditService::class, $audit);

        $this->actingAs($reviewer)->patchJson(
            "/api/admin/stores/{$tenant->getKey()}/status",
            ['status' => 'approved'],
        )->assertServerError();

        $this->assertSame('pending', $tenant->refresh()->verification_status);
        $this->assertSame(0, AdminAuditLog::query()->count());
    }

    public function test_audit_endpoint_and_active_identity_boundary_are_enforced(): void
    {
        $reviewer = $this->userWithSystemRole('audit-reviewer@example.com', SystemRole::PlatformReviewer);
        $merchant = $this->createUser('audit-denied@example.com');

        $this->actingAs($reviewer)->getJson('/api/admin/audit-logs')->assertOk();
        $this->actingAs($merchant)->getJson('/api/admin/audit-logs')->assertForbidden();

        $reviewer->update(['status' => UserStatus::Suspended]);
        $this->actingAs($reviewer->refresh())->getJson('/api/admin/stores')->assertUnauthorized();
    }

    public function test_tenant_policy_requires_exact_active_membership_and_permission(): void
    {
        $actor = $this->createUser('tenant-actor@example.com');
        $owner = $this->createUser('tenant-owner@example.com');
        $staff = $this->createUser('tenant-staff@example.com');
        $invitedOwner = $this->createUser('tenant-invited@example.com');
        $firstTenant = $this->createTenant('tenant-first');
        $secondTenant = $this->createTenant('tenant-second');
        $assignments = app(RoleAssignmentService::class);
        $ownerRole = Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail();
        $staffRole = Role::query()->where('key', SystemRole::MerchantStaff->value)->firstOrFail();
        $assignments->assignTenantRole($firstTenant, $owner, $ownerRole, $actor);
        $assignments->assignTenantRole($firstTenant, $staff, $staffRole, $actor);
        $assignments->assignTenantRole(
            $firstTenant,
            $invitedOwner,
            $ownerRole,
            $actor,
            TenantMembershipStatus::Invited,
        );
        $policy = app(TenantPolicy::class);

        $this->assertTrue($policy->updateStoreConfig($owner, $firstTenant));
        $this->assertFalse($policy->updateStoreConfig($owner, $secondTenant));
        $this->assertFalse($policy->updateStoreConfig($staff, $firstTenant));
        $this->assertFalse($policy->updateStoreConfig($invitedOwner, $firstTenant));

        DB::table('tenant_user')
            ->where('tenant_id', $firstTenant->getKey())
            ->where('user_id', $owner->getKey())
            ->update(['status' => TenantMembershipStatus::Suspended->value]);

        $this->assertFalse($policy->updateStoreConfig($owner, $firstTenant));
    }

    public function test_tenant_permission_middleware_fails_closed_without_tenant_context(): void
    {
        $request = Request::create('/api/store/config', 'POST');
        $request->setUserResolver(fn (): User => $this->createUser('missing-context@example.com'));

        $this->expectException(AuthorizationException::class);
        app(EnsureTenantPermission::class)->handle(
            $request,
            fn () => response()->noContent(),
            PermissionKey::TenantStoreManage->value,
        );
    }

    private function userWithSystemRole(string $email, SystemRole $systemRole): User
    {
        $user = $this->createUser($email);
        app(RoleAssignmentService::class)->assignPlatformRole(
            $user,
            Role::query()->where('key', $systemRole->value)->firstOrFail(),
            $user,
        );

        return $user;
    }

    private function createUser(string $email): User
    {
        return User::query()->create([
            'name' => 'WP 1.3 Test User',
            'email' => $email,
            'status' => UserStatus::Active,
        ]);
    }

    private function createTenant(
        string $id,
        TenantVerificationStatus $status = TenantVerificationStatus::Pending,
    ): Tenant {
        return Tenant::query()->create([
            'id' => $id,
            'store_name' => "Store {$id}",
            'owner_name' => 'WP 1.3 Owner',
            'owner_email' => "{$id}@example.com",
            'business_type' => 'retail',
            'verification_status' => $status->value,
            'theme_style' => 'elegant',
        ]);
    }
}
