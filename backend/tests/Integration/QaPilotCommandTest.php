<?php

namespace Tests\Integration;

use App\Enums\PlanActivationMode;
use App\Enums\ProvisioningState;
use App\Enums\SystemRole;
use App\Enums\TenantVerificationStatus;
use App\Enums\UserStatus;
use App\Models\AdminAuditLog;
use App\Models\Plan;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Services\RoleAssignmentService;
use Database\Seeders\IdentitySeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('database')]
class QaPilotCommandTest extends TestCase
{
    private const EMAIL = 'qa-pilot-admin@example.test';

    /** @var list<string> */
    private array $tenantIds = [];

    /** @var list<string> */
    private array $schemas = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
        putenv('QA_ADMIN_PASSWORD=PilotPassword123');
    }

    protected function tearDown(): void
    {
        if (tenancy()->initialized) {
            tenancy()->end();
        }
        DB::setDefaultConnection((string) config('tenancy.database.central_connection'));
        DB::purge('tenant');
        $central = DB::connection((string) config('tenancy.database.central_connection'));
        foreach ($this->schemas as $schema) {
            $central->statement('DROP SCHEMA IF EXISTS "'.$schema.'" CASCADE');
        }
        foreach ($this->tenantIds as $tenantId) {
            $central->table('tenants')->where('id', $tenantId)->delete();
        }
        $users = User::withTrashed()->where('email', 'like', 'qa-pilot-%@example.test')->get();
        foreach ($users as $user) {
            $central->table('sessions')->where('user_id', $user->id)->delete();
            $central->table('role_user')->where('user_id', $user->id)->delete();
            $central->table('admin_audit_logs')->where('actor_user_id', $user->id)->delete();
            $central->table('users')->where('id', $user->id)->delete();
        }

        putenv('QA_ADMIN_PASSWORD');
        config()->set('app.env', 'testing');
        parent::tearDown();
    }

    public function test_command_creates_and_rotates_an_explicit_super_administrator_without_duplicate_role_history(): void
    {
        $this->artisan('qa:provision-admin', [
            '--email' => '  QA-PILOT-ADMIN@EXAMPLE.TEST ',
            '--name' => 'Pilot Admin',
        ])->assertSuccessful()->expectsOutputToContain('created: '.self::EMAIL);

        $user = User::query()->where('email', self::EMAIL)->firstOrFail();
        $this->assertSame(UserStatus::Active, $user->status);
        $this->assertTrue(Hash::check('PilotPassword123', (string) $user->password));
        $this->assertTrue($user->platformRoles()->where('roles.key', SystemRole::PlatformSuperAdmin->value)->exists());
        $this->assertSame(1, AdminAuditLog::query()
            ->where('actor_user_id', $user->id)
            ->where('action', 'identity.platform_role.assigned')
            ->count());

        $oldRememberToken = (string) $user->remember_token;
        DB::table('sessions')->insert([
            'id' => 'qa-pilot-session',
            'user_id' => $user->id,
            'payload' => 'test-payload',
            'last_activity' => now()->getTimestamp(),
        ]);
        putenv('QA_ADMIN_PASSWORD=RotatedPassword456');
        $this->artisan('qa:provision-admin', [
            '--email' => self::EMAIL,
            '--name' => 'Rotated Pilot Admin',
        ])->assertSuccessful()->expectsOutputToContain('rotated: '.self::EMAIL);

        $user->refresh();
        $this->assertSame('Rotated Pilot Admin', $user->name);
        $this->assertTrue(Hash::check('RotatedPassword456', (string) $user->password));
        $this->assertNotSame($oldRememberToken, (string) $user->remember_token);
        $this->assertDatabaseMissing('sessions', ['id' => 'qa-pilot-session']);
        $this->assertSame(1, $user->platformRoles()->where('roles.key', SystemRole::PlatformSuperAdmin->value)->count());
        $this->assertSame(1, AdminAuditLog::query()
            ->where('actor_user_id', $user->id)
            ->where('action', 'identity.platform_role.assigned')
            ->count());
        $this->assertSame(1, AdminAuditLog::query()
            ->where('actor_user_id', $user->id)
            ->where('action', 'identity.qa_admin.credential_rotated')
            ->count());
    }

    public function test_command_rejects_missing_or_weak_passwords_and_refuses_production(): void
    {
        putenv('QA_ADMIN_PASSWORD');
        $this->artisan('qa:provision-admin', ['--email' => self::EMAIL])->assertExitCode(2);
        $this->assertDatabaseMissing('users', ['email' => self::EMAIL]);

        putenv('QA_ADMIN_PASSWORD=short');
        $this->artisan('qa:provision-admin', ['--email' => self::EMAIL])->assertExitCode(2);
        $this->assertDatabaseMissing('users', ['email' => self::EMAIL]);

        config()->set('app.env', 'production');
        putenv('QA_ADMIN_PASSWORD=ProductionPassword123');
        $this->artisan('qa:provision-admin', ['--email' => self::EMAIL])
            ->assertFailed()
            ->expectsOutputToContain('disabled in production');
        $this->assertDatabaseMissing('users', ['email' => self::EMAIL]);
    }

    public function test_command_refuses_to_adopt_merchants_reviewers_or_suspended_identities(): void
    {
        $assignments = app(RoleAssignmentService::class);
        $reviewerRole = Role::query()->where('key', SystemRole::PlatformReviewer->value)->firstOrFail();

        $merchant = User::query()->create([
            'name' => 'Existing Merchant',
            'email' => 'qa-pilot-merchant@example.test',
            'password' => 'OriginalMerchant123',
            'status' => UserStatus::Active,
        ]);
        $reviewer = User::query()->create([
            'name' => 'Existing Reviewer',
            'email' => 'qa-pilot-reviewer@example.test',
            'password' => 'OriginalReviewer123',
            'status' => UserStatus::Active,
        ]);
        $assignments->assignPlatformRole($reviewer, $reviewerRole, $reviewer);
        $suspended = User::query()->create([
            'name' => 'Suspended Identity',
            'email' => 'qa-pilot-suspended@example.test',
            'password' => 'OriginalSuspended123',
            'status' => UserStatus::Suspended,
        ]);

        foreach ([$merchant, $reviewer, $suspended] as $identity) {
            $originalPassword = (string) $identity->password;
            $this->artisan('qa:provision-admin', ['--email' => $identity->email])
                ->assertFailed()
                ->expectsOutputToContain('Refusing to adopt or reactivate');
            $identity->refresh();
            $this->assertSame($originalPassword, (string) $identity->password);
        }

        $this->assertSame(UserStatus::Suspended, $suspended->refresh()->status);
        $this->assertFalse($merchant->platformRoles()->where('roles.key', SystemRole::PlatformSuperAdmin->value)->exists());
        $this->assertFalse($reviewer->platformRoles()->where('roles.key', SystemRole::PlatformSuperAdmin->value)->exists());
    }

    public function test_active_tenant_migration_applies_the_schema_skips_non_active_tenants_and_restores_central_context(): void
    {
        $active = $this->tenant('qa-pilot-active', ProvisioningState::Active, TenantVerificationStatus::Approved);
        $pending = $this->tenant('qa-pilot-pending', ProvisioningState::NotStarted, TenantVerificationStatus::Pending);
        $active->database()->manager()->createDatabase($active);
        $this->schemas[] = (string) $active->database()->getName();

        $this->artisan('qa:migrate-active-tenants')
            ->assertSuccessful()
            ->expectsOutputToContain('1 tenant(s)');

        $active->run(function (): void {
            $this->assertTrue(Schema::connection('tenant')->hasTable('store_configs'));
            $this->assertTrue(Schema::connection('tenant')->hasTable('inventory_operations'));
            $this->assertTrue(Schema::connection('tenant')->hasTable('orders'));
        });
        $this->assertFalse($pending->database()->manager()->databaseExists((string) $pending->database()->getName()));
        $this->assertFalse(tenancy()->initialized);
        $this->assertSame((string) config('tenancy.database.central_connection'), DB::getDefaultConnection());
    }

    public function test_active_tenant_migration_refuses_a_missing_schema_and_production(): void
    {
        $this->tenant('qa-pilot-missing', ProvisioningState::Active, TenantVerificationStatus::Approved);

        $this->artisan('qa:migrate-active-tenants')
            ->assertFailed()
            ->expectsOutputToContain('missing its owned schema');
        $this->assertFalse(tenancy()->initialized);
        $this->assertSame((string) config('tenancy.database.central_connection'), DB::getDefaultConnection());

        config()->set('app.env', 'production');
        $this->artisan('qa:migrate-active-tenants')
            ->assertFailed()
            ->expectsOutputToContain('disabled in production');
    }

    public function test_active_tenant_migration_requires_the_automatic_active_starter_plan(): void
    {
        $starter = Plan::query()->whereKey('starter')->firstOrFail();
        $originalAttributes = $starter->getAttributes();

        try {
            $starter->delete();
            $this->artisan('qa:migrate-active-tenants')
                ->assertFailed()
                ->expectsOutputToContain('starter plan must exist, be active, and use automatic activation');

            $starter = Plan::query()->forceCreate($originalAttributes);
            $starter->forceFill(['is_active' => false])->save();
            $this->artisan('qa:migrate-active-tenants')
                ->assertFailed()
                ->expectsOutputToContain('starter plan must exist, be active, and use automatic activation');

            $starter->forceFill([
                'is_active' => true,
                'activation_mode' => PlanActivationMode::Manual,
            ])->save();
            $this->artisan('qa:migrate-active-tenants')
                ->assertFailed()
                ->expectsOutputToContain('starter plan must exist, be active, and use automatic activation');
        } finally {
            Plan::query()->whereKey('starter')->delete();
            Plan::query()->forceCreate($originalAttributes);
        }
    }

    private function tenant(
        string $id,
        ProvisioningState $provisioningState,
        TenantVerificationStatus $verificationStatus,
    ): Tenant {
        $tenant = Tenant::query()->create([
            'id' => $id,
            'store_name' => $id,
            'owner_name' => 'Pilot Owner',
            'owner_email' => "{$id}@example.test",
            'business_type' => 'retail',
            'verification_status' => $verificationStatus->value,
            'provisioning_status' => $provisioningState->value,
            'theme_style' => 'elegant',
        ]);
        $this->tenantIds[] = $id;

        return $tenant;
    }
}
