<?php

namespace Tests\Integration;

use App\Enums\SystemRole;
use App\Enums\UserStatus;
use App\Models\Role;
use App\Models\User;
use App\Services\RoleAssignmentService;
use Database\Seeders\IdentitySeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('database')]
class AuthenticationTest extends TestCase
{
    use DatabaseTransactions;

    public function test_registration_creates_active_identity_and_authenticated_session(): void
    {
        $this->assertSame('database', config('session.driver'));
        $this->assertSame('database', config('cache.default'));

        $this->getJson('/api/auth/csrf')->assertOk();
        $anonymousSessionId = DB::table('sessions')->value('id');

        $response = $this->postJson('/api/auth/register', [
            'name' => 'New Merchant',
            'email' => '  Merchant@Example.COM ',
            'phone' => '+967 777 000 111',
            'password' => 'secure-pass-123',
            'password_confirmation' => 'secure-pass-123',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.email', 'merchant@example.com')
            ->assertJsonPath('data.status', UserStatus::Active->value)
            ->assertJsonPath('data.platform_roles', [])
            ->assertJsonMissingPath('data.password')
            ->assertJsonMissingPath('data.remember_token');

        $user = User::query()->where('email', 'merchant@example.com')->firstOrFail();

        $this->assertAuthenticatedAs($user);
        $this->assertTrue(Hash::check('secure-pass-123', $user->password));
        $this->assertNotNull($user->last_login_at);

        $authenticatedSessionId = DB::table('sessions')
            ->where('user_id', $user->getKey())
            ->value('id');

        $this->assertNotNull($anonymousSessionId);
        $this->assertNotNull($authenticatedSessionId);
        $this->assertNotSame($anonymousSessionId, $authenticatedSessionId);
        $this->assertDatabaseHas('sessions', [
            'id' => $anonymousSessionId,
            'user_id' => null,
        ]);
    }

    public function test_login_restores_authoritative_platform_roles_and_updates_last_login(): void
    {
        $this->seed(IdentitySeeder::class);

        $user = $this->createUser('reviewer@example.com');
        app(RoleAssignmentService::class)->assignPlatformRole(
            $user,
            Role::query()->where('key', SystemRole::PlatformReviewer->value)->firstOrFail(),
            $user,
        );

        $response = $this->postJson('/api/auth/login', [
            'email' => 'REVIEWER@example.com',
            'password' => 'secure-pass-123',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.id', $user->getKey())
            ->assertJsonPath('data.platform_roles.0', SystemRole::PlatformReviewer->value);

        $this->assertAuthenticatedAs($user);
        $this->assertNotNull($user->refresh()->last_login_at);
    }

    public function test_wrong_password_suspended_and_deleted_accounts_use_same_generic_failure(): void
    {
        $active = $this->createUser('active@example.com');
        $suspended = $this->createUser('suspended@example.com', UserStatus::Suspended);
        $deleted = $this->createUser('deleted@example.com');
        $deleted->delete();

        $wrongPassword = $this->postJson('/api/auth/login', [
            'email' => $active->email,
            'password' => 'incorrect-password',
        ]);

        $suspendedLogin = $this->postJson('/api/auth/login', [
            'email' => $suspended->email,
            'password' => 'secure-pass-123',
        ]);

        $deletedLogin = $this->postJson('/api/auth/login', [
            'email' => $deleted->email,
            'password' => 'secure-pass-123',
        ]);

        $wrongPassword->assertUnprocessable()->assertJsonPath('errors.email.0', 'بيانات الدخول غير صحيحة.');
        $suspendedLogin->assertUnprocessable()->assertJsonPath('errors.email.0', 'بيانات الدخول غير صحيحة.');
        $deletedLogin->assertUnprocessable()->assertJsonPath('errors.email.0', 'بيانات الدخول غير صحيحة.');
        $this->assertGuest();
    }

    public function test_every_authenticated_request_rejects_and_invalidates_suspended_identity(): void
    {
        $user = $this->createUser('session@example.com');

        $this->actingAs($user)
            ->getJson('/api/auth/session')
            ->assertOk()
            ->assertJsonPath('data.id', $user->getKey());

        $user->update(['status' => UserStatus::Suspended]);

        $this->postJson('/api/auth/logout')->assertUnauthorized();

        $this->assertGuest();
    }

    public function test_password_hash_change_invalidates_a_session_even_if_its_database_row_survives(): void
    {
        $user = $this->createUser('credential-version@example.com');

        $login = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'secure-pass-123',
        ]);

        $login->assertOk()->assertSessionHas('password_hash_web');

        $originalHash = $user->refresh()->password;

        $user->forceFill(['password' => 'replacement-password-789'])->save();
        $this->assertNotSame($originalHash, $user->refresh()->password);
        Auth::forgetGuards();

        $this->getJson('/api/auth/session')->assertUnauthorized();
        $this->assertGuest();
    }

    public function test_logout_ends_authenticated_session(): void
    {
        $user = $this->createUser('logout@example.com');

        $this->actingAs($user)
            ->postJson('/api/auth/logout')
            ->assertOk();

        $this->assertGuest();
        $this->assertDatabaseMissing('sessions', ['user_id' => $user->getKey()]);
    }

    public function test_forgot_password_does_not_reveal_account_existence(): void
    {
        Notification::fake();
        $user = $this->createUser('reset-link@example.com');

        $existing = $this->postJson('/api/auth/forgot-password', ['email' => $user->email]);
        $missing = $this->postJson('/api/auth/forgot-password', ['email' => 'missing@example.com']);

        $existing->assertAccepted();
        $missing->assertAccepted();
        $this->assertSame($existing->json('message'), $missing->json('message'));
        Notification::assertSentTo($user, ResetPassword::class);
    }

    public function test_password_reset_replaces_password_and_revokes_database_sessions(): void
    {
        Notification::fake();
        $user = $this->createUser('reset@example.com');

        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertAccepted();

        $token = null;
        Notification::assertSentTo(
            $user,
            ResetPassword::class,
            function (ResetPassword $notification) use (&$token): bool {
                $token = $notification->token;

                return true;
            },
        );

        DB::table('sessions')->insert([
            'id' => 'existing-session',
            'user_id' => $user->getKey(),
            'payload' => 'test-payload',
            'last_activity' => now()->timestamp,
        ]);

        $this->postJson('/api/auth/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'new-secure-pass-456',
            'password_confirmation' => 'new-secure-pass-456',
        ])->assertOk();

        $this->assertTrue(Hash::check('new-secure-pass-456', $user->refresh()->password));
        $this->assertDatabaseMissing('sessions', ['user_id' => $user->getKey()]);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
    }

    public function test_login_endpoint_is_rate_limited_per_email_and_ip(): void
    {
        $email = 'rate-limit@example.com';

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson('/api/auth/login', [
                'email' => $email,
                'password' => 'incorrect-password',
            ])->assertUnprocessable();
        }

        $this->postJson('/api/auth/login', [
            'email' => $email,
            'password' => 'incorrect-password',
        ])->assertTooManyRequests();

        $this->assertGreaterThan(0, DB::table('cache')->count());
    }

    public function test_csrf_endpoint_returns_session_bound_token(): void
    {
        $this->getJson('/api/auth/csrf')
            ->assertOk()
            ->assertJsonStructure(['csrf_token']);
    }

    private function createUser(string $email, UserStatus $status = UserStatus::Active): User
    {
        return User::query()->create([
            'name' => 'Authentication Test User',
            'email' => $email,
            'password' => 'secure-pass-123',
            'status' => $status,
        ]);
    }
}
