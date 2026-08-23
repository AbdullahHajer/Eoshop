<?php

namespace Tests\Integration;

use App\Enums\SystemRole;
use App\Enums\UserStatus;
use App\Exceptions\AccountProfileConflict;
use App\Exceptions\PlatformUserConflict;
use App\Models\Role;
use App\Models\User;
use App\Services\AccountPasswordService;
use App\Services\AccountProfileService;
use App\Services\IdentityPasswordResetService;
use App\Services\PlatformUserLifecycleService;
use App\Services\RoleAssignmentService;
use Database\Seeders\IdentitySeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;
use Throwable;

#[Group('database')]
class PlatformUserLifecycleConcurrencyTest extends TestCase
{
    /** @var list<string> */
    private array $userIds = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
    }

    protected function tearDown(): void
    {
        $centralName = (string) config('tenancy.database.central_connection');
        DB::purge($centralName);
        $central = DB::connection($centralName);
        if ($this->userIds !== []) {
            $central->table('admin_audit_logs')->where(function ($query): void {
                $query->whereIn('actor_user_id', $this->userIds)
                    ->orWhereIn('subject_id', $this->userIds);
            })->delete();
            $central->table('sessions')->whereIn('user_id', $this->userIds)->delete();
            $emails = $central->table('users')->whereIn('id', $this->userIds)->pluck('email')->all();
            $central->table('password_reset_tokens')->whereIn('email', $emails)->delete();
            $central->table('role_user')->whereIn('user_id', $this->userIds)->delete();
            $central->table('users')->whereIn('id', $this->userIds)->delete();
        }

        parent::tearDown();
    }

    public function test_forgot_link_issuance_and_suspension_are_serialized_without_a_surviving_token(): void
    {
        Notification::fake();
        $manager = $this->operator('concurrent-forgot-manager@example.test', SystemRole::PlatformSuperAdmin);
        $target = $this->operator('concurrent-forgot-target@example.test', SystemRole::PlatformReviewer);

        $outcomes = $this->runConcurrent([
            function () use ($target): void {
                app(IdentityPasswordResetService::class)->requestLink(
                    Request::create('/api/auth/forgot-password', 'POST'),
                    $target->email,
                );
            },
            fn (): User => app(PlatformUserLifecycleService::class)->changeStatus(
                $target,
                UserStatus::Active,
                UserStatus::Suspended,
                $manager,
                Request::create('/api/admin/users/status', 'PATCH'),
            ),
        ]);

        $this->assertSame(['ok', 'ok'], collect($outcomes)->pluck('status')->sort()->values()->all());
        $this->assertSame(UserStatus::Suspended, $target->fresh()->status);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $target->email]);
    }

    public function test_password_reset_and_suspension_race_always_ends_suspended_and_tokenless(): void
    {
        $manager = $this->operator('concurrent-reset-manager@example.test', SystemRole::PlatformSuperAdmin);
        $target = $this->operator('concurrent-reset-target@example.test', SystemRole::PlatformReviewer);
        $token = Password::broker()->createToken($target);

        $outcomes = $this->runConcurrent([
            fn (): User => app(IdentityPasswordResetService::class)->reset(
                Request::create('/api/auth/reset-password', 'POST'),
                $target->email,
                $token,
                'concurrent-reset-password-123',
            ),
            fn (): User => app(PlatformUserLifecycleService::class)->changeStatus(
                $target,
                UserStatus::Active,
                UserStatus::Suspended,
                $manager,
                Request::create('/api/admin/users/status', 'PATCH'),
            ),
        ]);

        $this->assertContains($outcomes[0]['status'], ['ok', 'invalid']);
        $this->assertContains($outcomes[1]['status'], ['ok', 'invalid']);
        $this->assertContains('ok', array_column($outcomes, 'status'));
        $this->assertSame(UserStatus::Suspended, $target->fresh()->status);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $target->email]);
    }

    public function test_two_managers_cannot_concurrently_suspend_each_other_and_remove_the_last_manager(): void
    {
        $first = $this->operator('concurrent-manager-a@example.test', SystemRole::PlatformSuperAdmin);
        $second = $this->operator('concurrent-manager-b@example.test', SystemRole::PlatformSuperAdmin);

        $outcomes = $this->runConcurrent([
            fn (): User => app(PlatformUserLifecycleService::class)->changeStatus(
                $second,
                UserStatus::Active,
                UserStatus::Suspended,
                $first,
                Request::create('/api/admin/users/status', 'PATCH'),
            ),
            fn (): User => app(PlatformUserLifecycleService::class)->changeStatus(
                $first,
                UserStatus::Active,
                UserStatus::Suspended,
                $second,
                Request::create('/api/admin/users/status', 'PATCH'),
            ),
        ]);

        $this->assertSame(['forbidden', 'ok'], collect($outcomes)->pluck('status')->sort()->values()->all());
        $this->assertSame(1, User::query()->whereIn('id', [$first->id, $second->id])->where('status', UserStatus::Active)->count());
    }

    public function test_concurrent_role_replacements_from_one_snapshot_have_one_winner_and_one_stale_writer(): void
    {
        $manager = $this->operator('concurrent-role-manager@example.test', SystemRole::PlatformSuperAdmin);
        $target = $this->operator('concurrent-role-target@example.test', SystemRole::PlatformReviewer);
        $expected = [SystemRole::PlatformReviewer->value];

        $outcomes = $this->runConcurrent([
            fn (): User => app(PlatformUserLifecycleService::class)->replaceRoles(
                $target,
                $expected,
                [SystemRole::PlatformSuperAdmin->value],
                $manager,
                Request::create('/api/admin/users/roles', 'PUT'),
            ),
            fn (): User => app(PlatformUserLifecycleService::class)->replaceRoles(
                $target,
                $expected,
                [SystemRole::PlatformReviewer->value, SystemRole::PlatformSuperAdmin->value],
                $manager,
                Request::create('/api/admin/users/roles', 'PUT'),
            ),
        ]);

        $this->assertSame(['invalid', 'ok'], collect($outcomes)->pluck('status')->sort()->values()->all());
        $roleKeys = $target->fresh()->platformRoles()->orderBy('key')->pluck('key')->all();
        $this->assertContains($roleKeys, [
            [SystemRole::PlatformSuperAdmin->value],
            [SystemRole::PlatformReviewer->value, SystemRole::PlatformSuperAdmin->value],
        ]);
    }

    public function test_two_profile_writers_from_one_revision_have_one_exact_winner(): void
    {
        $target = $this->operator('concurrent-profile@example.test', SystemRole::PlatformReviewer);

        $outcomes = $this->runConcurrent([
            fn (): User => app(AccountProfileService::class)->update(
                $target,
                ['expectedRevision' => 1, 'name' => 'Profile writer A', 'phone' => null],
                Request::create('/api/account/profile', 'PUT'),
            ),
            fn (): User => app(AccountProfileService::class)->update(
                $target,
                ['expectedRevision' => 1, 'name' => 'Profile writer B', 'phone' => null],
                Request::create('/api/account/profile', 'PUT'),
            ),
        ]);

        $this->assertSame(['invalid', 'ok'], collect($outcomes)->pluck('status')->sort()->values()->all());
        $this->assertSame(2, $target->fresh()->profile_revision);
        $this->assertContains($target->fresh()->name, ['Profile writer A', 'Profile writer B']);
    }

    public function test_password_change_and_reset_redemption_are_serialized_with_one_credential_winner(): void
    {
        $target = $this->operator('concurrent-account-password@example.test', SystemRole::PlatformReviewer);
        $token = Password::broker()->createToken($target);

        $outcomes = $this->runConcurrent([
            fn (): User => app(AccountPasswordService::class)->change(
                $target,
                'secure-platform-pass-123',
                'account-change-winner-456',
                'current-session',
                Request::create('/api/account/password', 'PUT'),
            ),
            fn (): User => app(IdentityPasswordResetService::class)->reset(
                Request::create('/api/auth/reset-password', 'POST'),
                $target->email,
                $token,
                'reset-winner-password-789',
            ),
        ]);

        $this->assertSame(['invalid', 'ok'], collect($outcomes)->pluck('status')->sort()->values()->all());
        $hash = (string) $target->fresh()->password;
        $this->assertTrue(
            Hash::check('account-change-winner-456', $hash) || Hash::check('reset-winner-password-789', $hash)
        );
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $target->email]);
    }

    public function test_password_change_and_reset_link_issuance_share_the_identity_lock(): void
    {
        Notification::fake();
        $target = $this->operator('concurrent-account-link@example.test', SystemRole::PlatformReviewer);

        $outcomes = $this->runConcurrent([
            fn (): User => app(AccountPasswordService::class)->change(
                $target,
                'secure-platform-pass-123',
                'account-after-link-race-456',
                'current-session',
                Request::create('/api/account/password', 'PUT'),
            ),
            function () use ($target): void {
                app(IdentityPasswordResetService::class)->requestLink(
                    Request::create('/api/auth/forgot-password', 'POST'),
                    $target->email,
                );
            },
        ]);

        $this->assertSame(['ok', 'ok'], collect($outcomes)->pluck('status')->sort()->values()->all());
        $this->assertTrue(Hash::check('account-after-link-race-456', (string) $target->fresh()->password));
        $this->assertGreaterThanOrEqual(2, (int) $target->fresh()->session_generation);
    }

    /**
     * @param  list<callable(): mixed>  $operations
     * @return list<array{status: string, detail?: string}>
     */
    private function runConcurrent(array $operations): array
    {
        if (! function_exists('pcntl_fork') || ! function_exists('stream_socket_pair')) {
            $this->fail('The database gate requires pcntl and socket pairs for real identity concurrency tests.');
        }

        $workers = [];
        foreach ($operations as $operation) {
            $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
            if ($sockets === false) {
                $this->fail('Unable to create the identity concurrency barrier.');
            }
            [$parentSocket, $childSocket] = $sockets;
            $pid = pcntl_fork();
            if ($pid === -1) {
                $this->fail('Unable to fork an identity concurrency worker.');
            }
            if ($pid === 0) {
                fclose($parentSocket);
                fread($childSocket, 1);
                try {
                    $central = (string) config('tenancy.database.central_connection');
                    DB::purge('tenant');
                    DB::purge($central);
                    DB::setDefaultConnection($central);
                    $operation();
                    $result = ['status' => 'ok'];
                } catch (ValidationException|PlatformUserConflict|AccountProfileConflict $exception) {
                    $result = ['status' => 'invalid', 'detail' => $exception::class];
                } catch (AuthorizationException $exception) {
                    $result = ['status' => 'forbidden', 'detail' => $exception::class];
                } catch (Throwable $exception) {
                    $result = ['status' => 'error', 'detail' => $exception::class.':'.$exception->getMessage()];
                }
                @fwrite($childSocket, json_encode($result, JSON_THROW_ON_ERROR));
                fclose($childSocket);
                exit(0);
            }
            fclose($childSocket);
            $workers[] = ['pid' => $pid, 'socket' => $parentSocket];
        }

        foreach ($workers as $worker) {
            fwrite($worker['socket'], '1');
        }

        $results = [];
        $exitStatuses = [];
        foreach ($workers as $worker) {
            $payload = stream_get_contents($worker['socket']);
            fclose($worker['socket']);
            pcntl_waitpid($worker['pid'], $status);
            $exitStatuses[] = $status;
            $results[] = json_decode((string) $payload, true, 512, JSON_THROW_ON_ERROR);
        }

        DB::purge((string) config('tenancy.database.central_connection'));

        foreach ($exitStatuses as $status) {
            $this->assertTrue(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0);
        }
        foreach ($results as $decoded) {
            $this->assertNotSame('error', $decoded['status'] ?? null, (string) ($decoded['detail'] ?? 'unknown child error'));
        }

        return $results;
    }

    private function operator(string $email, SystemRole $role): User
    {
        $user = User::query()->create([
            'name' => 'Concurrency Operator',
            'email' => $email,
            'password' => 'secure-platform-pass-123',
            'status' => UserStatus::Active,
        ]);
        $this->userIds[] = (string) $user->getKey();
        app(RoleAssignmentService::class)->assignPlatformRole(
            $user,
            Role::query()->where('key', $role->value)->firstOrFail(),
            $user,
        );

        return $user;
    }
}
