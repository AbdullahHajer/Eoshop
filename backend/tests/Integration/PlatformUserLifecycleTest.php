<?php

namespace Tests\Integration;

use App\Enums\PermissionKey;
use App\Enums\RoleScope;
use App\Enums\SystemRole;
use App\Enums\TenantMembershipStatus;
use App\Enums\UserStatus;
use App\Models\AdminAuditLog;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AdminAuditService;
use App\Services\IdentityPasswordResetService;
use App\Services\PlatformUserLifecycleService;
use App\Services\RoleAssignmentService;
use Database\Seeders\IdentitySeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Contracts\Notifications\Dispatcher;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Session\DatabaseSessionHandler;
use Illuminate\Session\EncryptedStore;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Mockery;
use PHPUnit\Framework\Attributes\Group;
use RuntimeException;
use Tests\TestCase;

#[Group('database')]
class PlatformUserLifecycleTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
    }

    public function test_user_and_role_reads_are_permission_owned_strict_and_redacted(): void
    {
        $manager = $this->operator('users-manager@example.test', SystemRole::PlatformSuperAdmin);
        $reviewer = $this->operator('users-reviewer@example.test', SystemRole::PlatformReviewer);
        $unverifiedEstablished = $this->operator('users-unverified-established@example.test', SystemRole::PlatformReviewer);
        $unverifiedEstablished->forceFill([
            'status' => UserStatus::Suspended,
            'email_verified_at' => null,
        ])->save();
        $merchant = $this->user('users-merchant@example.test');
        $this->tenantMembership($reviewer);

        $this->assertTrue($manager->hasPlatformPermission(PermissionKey::PlatformUsersManage));
        $this->assertFalse($reviewer->hasPlatformPermission(PermissionKey::PlatformUsersManage));

        $this->getJson('/api/admin/users')->assertUnauthorized();
        $this->actingAs($merchant)->getJson('/api/admin/users')->assertForbidden();
        Auth::forgetGuards();
        $this->flushSession();
        $this->actingAs($reviewer)->getJson('/api/admin/users')->assertForbidden();
        Auth::forgetGuards();
        $this->flushSession();

        $this->actingAs($manager)->getJson('/api/admin/platform-roles')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonMissingPath('data.0.id');

        $this->actingAs($manager)->getJson('/api/admin/users?search=users-reviewer&status=active&role=platform_reviewer')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $reviewer->id)
            ->assertJsonPath('data.0.activeTenantMembershipCount', 1)
            ->assertJsonMissingPath('data.0.password')
            ->assertJsonMissingPath('data.0.rememberToken')
            ->assertJsonMissingPath('data.0.phone');

        $this->actingAs($manager)->getJson('/api/admin/users?search=users-unverified-established')
            ->assertOk()
            ->assertJsonPath('data.0.status', 'suspended')
            ->assertJsonPath('data.0.emailVerifiedAt', null)
            ->assertJsonPath('data.0.resumeStatus', 'active');

        $this->actingAs($manager)->getJson('/api/admin/users?search=%25%25')
            ->assertOk()->assertJsonPath('meta.total', 0);
        $this->actingAs($manager)->getJson('/api/admin/users?statuz=active')->assertUnprocessable();
        $this->actingAs($manager)->getJson('/api/admin/users?perPage=9')->assertUnprocessable();
        $this->actingAs($manager)->getJson('/api/admin/users?role=merchant_owner')->assertUnprocessable();
    }

    public function test_invitation_is_pending_passwordless_token_free_and_activates_by_valid_link(): void
    {
        Notification::fake();
        $manager = $this->operator('invite-manager@example.test', SystemRole::PlatformSuperAdmin);

        $response = $this->actingAs($manager)->postJson('/api/admin/users', [
            'name' => 'Invited Reviewer',
            'email' => ' INVITED.Reviewer@Example.TEST ',
            'roleKeys' => [SystemRole::PlatformReviewer->value],
        ])->assertCreated()
            ->assertJsonPath('data.email', 'invited.reviewer@example.test')
            ->assertJsonPath('data.status', UserStatus::Pending->value)
            ->assertJsonPath('data.roles.0.key', SystemRole::PlatformReviewer->value)
            ->assertJsonPath('invitationDispatch.status', 'accepted')
            ->assertJsonMissingPath('data.password')
            ->assertJsonMissingPath('token');

        $invited = User::query()->findOrFail($response->json('data.id'));
        $this->assertNull($invited->getAuthPassword());
        $this->assertNull($invited->email_verified_at);
        $this->assertDatabaseHas('admin_audit_logs', [
            'action' => 'identity.platform_user.invited',
            'subject_id' => $invited->id,
        ]);

        $token = $this->resetTokenFor($invited);
        Auth::forgetGuards();
        $this->flushSession();
        $this->postJson('/api/auth/login', [
            'email' => $invited->email,
            'password' => 'new-operator-password-123',
        ])->assertUnprocessable();

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => $invited->email,
            'password' => 'new-operator-password-123',
            'password_confirmation' => 'new-operator-password-123',
        ])->assertOk();

        $invited->refresh();
        $this->assertSame(UserStatus::Active, $invited->status);
        $this->assertNotNull($invited->email_verified_at);
        $this->assertTrue(Hash::check('new-operator-password-123', $invited->password));
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $invited->email]);
        $this->assertDatabaseHas('admin_audit_logs', [
            'action' => 'identity.platform_user.activated',
            'actor_user_id' => $invited->id,
            'subject_id' => $invited->id,
        ]);
    }

    public function test_invitation_refuses_existing_deleted_and_unsupported_identity_fields(): void
    {
        Notification::fake();
        $manager = $this->operator('occupied-manager@example.test', SystemRole::PlatformSuperAdmin);
        $deleted = $this->user('occupied@example.test');
        $deleted->delete();

        $this->actingAs($manager)->postJson('/api/admin/users', [
            'name' => 'Implicit Restore',
            'email' => $deleted->email,
            'roleKeys' => [SystemRole::PlatformReviewer->value],
        ])->assertConflict()->assertJsonPath('code', 'platform_user_email_occupied');

        $this->actingAs($manager)->postJson('/api/admin/users', [
            'name' => 'Unsafe Invite',
            'email' => 'unsafe-invite@example.test',
            'roleKeys' => [SystemRole::PlatformReviewer->value],
            'password' => 'must-not-be-accepted',
            'status' => 'active',
        ])->assertUnprocessable();

        $this->assertDatabaseMissing('users', ['email' => 'unsafe-invite@example.test']);
    }

    public function test_suspension_revokes_tokens_sessions_and_generation_and_old_invite_stays_invalid(): void
    {
        Notification::fake();
        $manager = $this->operator('suspend-manager@example.test', SystemRole::PlatformSuperAdmin);
        $pending = $this->pendingOperator('pending-suspend@example.test');
        $oldToken = Password::broker()->createToken($pending);

        $this->actingAs($manager)->patchJson("/api/admin/users/{$pending->id}/status", [
            'expectedStatus' => 'pending',
            'status' => 'suspended',
        ])->assertOk()->assertJsonPath('data.status', 'suspended');
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $pending->email]);

        $this->actingAs($manager)->patchJson("/api/admin/users/{$pending->id}/status", [
            'expectedStatus' => 'suspended',
            'status' => 'pending',
        ])->assertOk()->assertJsonPath('data.status', 'pending');

        $this->postJson('/api/auth/reset-password', [
            'token' => $oldToken,
            'email' => $pending->email,
            'password' => 'old-link-must-fail-123',
            'password_confirmation' => 'old-link-must-fail-123',
        ])->assertUnprocessable();

        $active = $this->operator('active-suspend@example.test', SystemRole::PlatformReviewer);
        $oldGeneration = (int) $active->session_generation;
        $oldRemember = 'remember-before-suspension';
        $active->forceFill(['remember_token' => $oldRemember])->save();
        DB::table('sessions')->insert([
            'id' => 'platform-user-session',
            'user_id' => $active->id,
            'payload' => 'test-payload',
            'last_activity' => now()->timestamp,
        ]);
        Password::broker()->createToken($active);

        $this->actingAs($manager)->patchJson("/api/admin/users/{$active->id}/status", [
            'expectedStatus' => 'active',
            'status' => 'suspended',
        ])->assertOk();

        $active->refresh();
        $this->assertSame($oldGeneration + 1, $active->session_generation);
        $this->assertNotSame($oldRemember, $active->remember_token);
        $this->assertDatabaseMissing('sessions', ['user_id' => $active->id]);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $active->email]);

        $this->actingAs($manager)->patchJson("/api/admin/users/{$active->id}/status", [
            'expectedStatus' => 'suspended',
            'status' => 'active',
        ])->assertOk();

        Auth::forgetGuards();
        $this->flushSession();
        $guard = Auth::guard('web');
        $session = app('session')->driver();
        $lateSessionId = str_repeat('a', 40);
        $lateSessionHandler = new DatabaseSessionHandler(
            DB::connection((string) config('session.connection')),
            (string) config('session.table'),
            (int) config('session.lifetime'),
            app(),
        );
        $lateSession = new EncryptedStore(
            $session->getName(),
            $lateSessionHandler,
            app('encrypter'),
            $lateSessionId,
        );
        $lateSession->start();
        $lateSession->put($guard->getName(), $active->id);
        $lateSession->put('password_hash_web', $guard->hashPasswordForCookie($active->getAuthPassword()));
        $lateSession->put('identity_session_generation', $oldGeneration);
        $lateSession->save();
        $this->assertDatabaseHas('sessions', ['id' => $lateSessionId]);

        Auth::forgetGuards();
        $this->withCredentials()->withCookie((string) config('session.cookie'), $lateSessionId)
            ->getJson('/api/auth/session')
            ->assertUnauthorized();
        $this->assertDatabaseMissing('sessions', ['id' => $lateSessionId]);
    }

    public function test_role_and_status_mutations_reject_self_and_stale_snapshots(): void
    {
        $manager = $this->operator('mutation-manager@example.test', SystemRole::PlatformSuperAdmin);
        $target = $this->operator('mutation-target@example.test', SystemRole::PlatformSuperAdmin);

        $this->actingAs($manager)->putJson("/api/admin/users/{$manager->id}/roles", [
            'expectedRoleKeys' => [SystemRole::PlatformSuperAdmin->value],
            'roleKeys' => [SystemRole::PlatformReviewer->value],
        ])->assertConflict()->assertJsonPath('code', 'platform_user_self_mutation_forbidden');

        $this->actingAs($manager)->patchJson("/api/admin/users/{$manager->id}/status", [
            'expectedStatus' => 'active',
            'status' => 'suspended',
        ])->assertConflict()->assertJsonPath('code', 'platform_user_self_mutation_forbidden');

        $this->actingAs($manager)->putJson("/api/admin/users/{$target->id}/roles", [
            'expectedRoleKeys' => [SystemRole::PlatformSuperAdmin->value],
            'roleKeys' => [SystemRole::PlatformReviewer->value],
        ])->assertOk()->assertJsonPath('data.roles.0.key', SystemRole::PlatformReviewer->value);

        $auditCount = AdminAuditLog::query()->count();
        $this->actingAs($manager)->putJson("/api/admin/users/{$target->id}/roles", [
            'expectedRoleKeys' => [SystemRole::PlatformSuperAdmin->value],
            'roleKeys' => [SystemRole::PlatformReviewer->value],
        ])->assertConflict()->assertJsonPath('code', 'platform_user_roles_stale');
        $this->assertSame($auditCount, AdminAuditLog::query()->count());

        $this->actingAs($manager)->patchJson("/api/admin/users/{$target->id}/status", [
            'expectedStatus' => 'pending',
            'status' => 'suspended',
        ])->assertConflict()->assertJsonPath('code', 'platform_user_status_stale');
    }

    public function test_resend_reports_broker_throttle_without_claiming_delivery(): void
    {
        Notification::fake();
        $manager = $this->operator('resend-manager@example.test', SystemRole::PlatformSuperAdmin);
        $pending = $this->pendingOperator('resend-pending@example.test');
        Password::broker()->createToken($pending);

        $this->actingAs($manager)->postJson("/api/admin/users/{$pending->id}/invitation", [])
            ->assertTooManyRequests()
            ->assertJsonPath('code', 'platform_invitation_throttled')
            ->assertJsonPath('invitationDispatch.status', 'throttled')
            ->assertJsonMissingPath('token');

        $this->assertDatabaseHas('password_reset_tokens', ['email' => $pending->email]);
    }

    public function test_stale_invitation_dispatch_does_not_remove_a_newer_token_after_an_aba_transition(): void
    {
        $manager = $this->operator('dispatch-race-manager@example.test', SystemRole::PlatformSuperAdmin);
        $pending = $this->pendingOperator('dispatch-race-pending@example.test');
        $lifecycle = app(PlatformUserLifecycleService::class);
        $newerToken = null;
        $dispatcher = Mockery::mock(Dispatcher::class);
        $dispatcher->shouldReceive('send')->once()->andReturnUsing(function () use (
            $lifecycle,
            $pending,
            $manager,
            &$newerToken,
        ): void {
            $lifecycle->changeStatus($pending, UserStatus::Pending, UserStatus::Suspended, $manager, request());
            $lifecycle->changeStatus($pending, UserStatus::Suspended, UserStatus::Pending, $manager, request());
            $newerToken = Password::broker()->createToken($pending->fresh());
        });
        $this->app->instance(Dispatcher::class, $dispatcher);

        $status = $lifecycle->resendInvitation($pending, $manager, request());

        $this->assertSame('failed', $status);
        $this->assertDatabaseHas('users', ['id' => $pending->id, 'status' => UserStatus::Pending->value]);
        $this->assertSame(2, (int) $pending->fresh()->session_generation);
        $this->assertIsString($newerToken);
        $this->assertTrue(Password::broker()->tokenExists($pending->fresh(), $newerToken));
    }

    public function test_suspended_forgot_password_is_generic_tokenless_and_cannot_survive_reactivation(): void
    {
        $manager = $this->operator('forgot-lock-manager@example.test', SystemRole::PlatformSuperAdmin);
        $target = $this->operator('forgot-lock-target@example.test', SystemRole::PlatformReviewer);
        $oldToken = Password::broker()->createToken($target);

        $this->actingAs($manager)->patchJson("/api/admin/users/{$target->id}/status", [
            'expectedStatus' => 'active',
            'status' => 'suspended',
        ])->assertOk();
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $target->email]);

        $this->postJson('/api/auth/forgot-password', ['email' => $target->email])->assertAccepted();
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $target->email]);

        $this->actingAs($manager)->patchJson("/api/admin/users/{$target->id}/status", [
            'expectedStatus' => 'suspended',
            'status' => 'active',
        ])->assertOk();
        $this->postJson('/api/auth/reset-password', [
            'token' => $oldToken,
            'email' => $target->email,
            'password' => 'old-forgot-link-must-fail-123',
            'password_confirmation' => 'old-forgot-link-must-fail-123',
        ])->assertUnprocessable();
    }

    public function test_forgot_password_notification_failure_returns_generic_response_and_discards_its_token(): void
    {
        $target = $this->user('forgot-notification-failure@example.test');
        $dispatcher = Mockery::mock(Dispatcher::class);
        $dispatcher->shouldReceive('send')->once()->andThrow(new RuntimeException('mail transport unavailable'));
        $this->app->instance(Dispatcher::class, $dispatcher);

        $this->postJson('/api/auth/forgot-password', ['email' => $target->email])->assertAccepted();

        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $target->email]);
    }

    public function test_active_reset_stays_active_and_pending_or_suspended_non_eligible_users_fail_closed(): void
    {
        $active = $this->user('active-reset@example.test');
        $activeToken = Password::broker()->createToken($active);
        $activeGeneration = (int) $active->session_generation;
        $activeRemember = 'active-reset-remember';
        $active->forceFill(['remember_token' => $activeRemember])->save();
        DB::table('sessions')->insert([
            'id' => 'active-reset-session',
            'user_id' => $active->id,
            'payload' => 'test-payload',
            'last_activity' => now()->timestamp,
        ]);

        $this->postJson('/api/auth/reset-password', [
            'token' => $activeToken,
            'email' => $active->email,
            'password' => 'active-reset-new-password-123',
            'password_confirmation' => 'active-reset-new-password-123',
        ])->assertOk();

        $active->refresh();
        $this->assertSame(UserStatus::Active, $active->status);
        $this->assertSame($activeGeneration + 1, $active->session_generation);
        $this->assertNotSame($activeRemember, $active->remember_token);
        $this->assertTrue(Hash::check('active-reset-new-password-123', $active->password));
        $this->assertDatabaseMissing('sessions', ['user_id' => $active->id]);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $active->email]);
        $this->assertDatabaseHas('admin_audit_logs', [
            'action' => 'identity.password.reset',
            'actor_user_id' => $active->id,
            'subject_id' => $active->id,
        ]);

        $pendingMerchant = $this->user('pending-merchant-reset@example.test', UserStatus::Pending);
        $pendingToken = Password::broker()->createToken($pendingMerchant);
        $this->postJson('/api/auth/reset-password', [
            'token' => $pendingToken,
            'email' => $pendingMerchant->email,
            'password' => 'merchant-must-not-activate-123',
            'password_confirmation' => 'merchant-must-not-activate-123',
        ])->assertUnprocessable();
        $pendingMerchant->refresh();
        $this->assertSame(UserStatus::Pending, $pendingMerchant->status);
        $this->assertNull($pendingMerchant->getRawOriginal('password'));
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $pendingMerchant->email]);

        $suspended = $this->operator('suspended-reset@example.test', SystemRole::PlatformReviewer);
        $suspended->forceFill(['status' => UserStatus::Suspended])->save();
        $suspendedPassword = $suspended->getRawOriginal('password');
        $suspendedToken = Password::broker()->createToken($suspended);
        $this->postJson('/api/auth/reset-password', [
            'token' => $suspendedToken,
            'email' => $suspended->email,
            'password' => 'suspended-must-not-reset-123',
            'password_confirmation' => 'suspended-must-not-reset-123',
        ])->assertUnprocessable();
        $suspended->refresh();
        $this->assertSame(UserStatus::Suspended, $suspended->status);
        $this->assertSame($suspendedPassword, $suspended->getRawOriginal('password'));
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $suspended->email]);
    }

    public function test_missing_and_non_integer_session_generations_fail_closed(): void
    {
        $missing = $this->user('missing-generation@example.test');
        $this->postJson('/api/auth/login', [
            'email' => $missing->email,
            'password' => 'secure-platform-pass-123',
        ])->assertOk();
        Auth::forgetGuards();
        $this->withSession(['identity_session_generation' => null])
            ->getJson('/api/auth/session')
            ->assertUnauthorized();

        Auth::forgetGuards();
        $this->flushSession();
        $nonInteger = $this->user('non-integer-generation@example.test');
        $this->postJson('/api/auth/login', [
            'email' => $nonInteger->email,
            'password' => 'secure-platform-pass-123',
        ])->assertOk();
        Auth::forgetGuards();
        $this->withSession(['identity_session_generation' => '1'])
            ->getJson('/api/auth/session')
            ->assertUnauthorized();
    }

    public function test_fresh_remember_cookie_binds_generation_once_and_rotated_cookie_cannot_return(): void
    {
        $remembered = $this->operator('remembered-manager@example.test', SystemRole::PlatformSuperAdmin);
        $actor = $this->operator('remembered-actor@example.test', SystemRole::PlatformSuperAdmin);
        $login = $this->postJson('/api/auth/login', [
            'email' => $remembered->email,
            'password' => 'secure-platform-pass-123',
            'remember' => true,
        ])->assertOk();
        $recallerName = Auth::guard('web')->getRecallerName();
        $recaller = $login->getCookie($recallerName);
        $this->assertNotNull($recaller);

        Auth::forgetGuards();
        $this->flushSession();
        $this->withCredentials()->withCookie($recallerName, (string) $recaller->getValue())
            ->getJson('/api/auth/session')
            ->assertOk()
            ->assertJsonPath('data.id', $remembered->id)
            ->assertSessionHas('identity_session_generation', 1);

        Auth::forgetGuards();
        $this->flushSession();
        $this->actingAs($actor)->patchJson("/api/admin/users/{$remembered->id}/status", [
            'expectedStatus' => 'active',
            'status' => 'suspended',
        ])->assertOk();
        $this->actingAs($actor)->patchJson("/api/admin/users/{$remembered->id}/status", [
            'expectedStatus' => 'suspended',
            'status' => 'active',
        ])->assertOk();

        Auth::forgetGuards();
        $this->flushSession();
        $this->withCredentials()->withCookie($recallerName, (string) $recaller->getValue())
            ->getJson('/api/admin/users')
            ->assertUnauthorized();
    }

    public function test_reset_audit_failure_rolls_back_password_token_and_session_generation(): void
    {
        $user = $this->operator('reset-audit-rollback@example.test', SystemRole::PlatformReviewer);
        $token = Password::broker()->createToken($user);
        $password = $user->getRawOriginal('password');
        $generation = (int) $user->session_generation;
        $audit = Mockery::mock(AdminAuditService::class);
        $audit->shouldReceive('record')->once()->andThrow(new RuntimeException('audit unavailable'));
        $service = new IdentityPasswordResetService($audit);

        try {
            $service->reset(request(), $user->email, $token, 'must-roll-back-password-123');
            $this->fail('Audit failure must abort the complete reset transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit unavailable', $exception->getMessage());
        }

        $user->refresh();
        $this->assertSame($password, $user->getRawOriginal('password'));
        $this->assertSame($generation, $user->session_generation);
        $this->assertDatabaseHas('password_reset_tokens', ['email' => $user->email]);
    }

    public function test_audit_failure_rolls_back_invitation_before_dispatch(): void
    {
        Notification::fake();
        $manager = $this->operator('audit-rollback-manager@example.test', SystemRole::PlatformSuperAdmin);
        $audit = Mockery::mock(AdminAuditService::class);
        $audit->shouldReceive('record')->once()->andThrow(new RuntimeException('audit unavailable'));
        $service = new PlatformUserLifecycleService($audit);

        try {
            $service->invite([
                'name' => 'Rolled Back Invite',
                'email' => 'rolled-back-invite@example.test',
                'roleKeys' => [SystemRole::PlatformReviewer->value],
            ], $manager, request());
            $this->fail('Audit failure must abort the invitation transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit unavailable', $exception->getMessage());
        }

        $this->assertDatabaseMissing('users', ['email' => 'rolled-back-invite@example.test']);
        Notification::assertNothingSent();
    }

    public function test_database_rejects_non_positive_session_generation(): void
    {
        $user = $this->user('generation-constraint@example.test');

        $this->expectException(QueryException::class);
        DB::table('users')->where('id', $user->id)->update(['session_generation' => 0]);
    }

    private function user(string $email, UserStatus $status = UserStatus::Active): User
    {
        return User::query()->create([
            'name' => 'Platform User Test',
            'email' => $email,
            'password' => $status === UserStatus::Pending ? null : 'secure-platform-pass-123',
            'status' => $status,
        ]);
    }

    private function operator(string $email, SystemRole $role): User
    {
        $user = $this->user($email);
        app(RoleAssignmentService::class)->assignPlatformRole(
            $user,
            Role::query()->where('key', $role->value)->firstOrFail(),
            $user,
        );

        return $user;
    }

    private function pendingOperator(string $email): User
    {
        $user = $this->user($email, UserStatus::Pending);
        $actorEmail = 'pending-actor-'.substr(hash('sha256', $email), 0, 12).'@example.test';
        app(RoleAssignmentService::class)->assignPlatformRole(
            $user,
            Role::query()->where('key', SystemRole::PlatformReviewer->value)->firstOrFail(),
            $this->operator($actorEmail, SystemRole::PlatformSuperAdmin),
        );

        return $user;
    }

    private function tenantMembership(User $user): void
    {
        $tenant = Tenant::query()->create([
            'id' => 'platform-user-membership',
            'store_name' => 'Membership Store',
            'owner_name' => 'Membership Owner',
            'owner_email' => 'membership-owner@example.test',
            'business_type' => 'retail',
        ]);
        $role = Role::query()->where('key', SystemRole::MerchantStaff->value)->firstOrFail();
        DB::table('tenant_user')->insert([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'role_id' => $role->id,
            'role_scope' => RoleScope::Tenant->value,
            'status' => TenantMembershipStatus::Active->value,
            'joined_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function resetTokenFor(User $user): string
    {
        $token = null;
        Notification::assertSentTo(
            $user,
            ResetPassword::class,
            function (ResetPassword $notification) use (&$token): bool {
                $token = $notification->token;

                return true;
            },
        );

        $this->assertIsString($token);

        return $token;
    }
}
