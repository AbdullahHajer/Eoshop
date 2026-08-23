<?php

namespace App\Services;

use App\Enums\RoleScope;
use App\Enums\UserStatus;
use App\Models\User;
use App\Support\IdentityLifecycleLock;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Auth\Events\PasswordResetLinkSent;
use Illuminate\Auth\Passwords\PasswordBroker;
use Illuminate\Auth\Passwords\TokenRepositoryInterface;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Support\Timebox;
use Illuminate\Validation\ValidationException;
use LogicException;
use SensitiveParameter;
use Throwable;

class IdentityPasswordResetService
{
    public function __construct(private readonly AdminAuditService $audit) {}

    public function requestLink(Request $request, string $email): void
    {
        $central = DB::connection((string) config('tenancy.database.central_connection'));
        $broker = Password::broker();
        if (! $broker instanceof PasswordBroker) {
            throw new LogicException('The configured password broker must expose its token repository.');
        }
        $tokens = $broker->getRepository();

        $broker->getTimebox()->call(function () use ($request, $email, $central, $tokens): void {
            /** @var array{user: User, token: string}|null $dispatch */
            $dispatch = $central->transaction(function () use ($email, $central, $tokens): ?array {
                IdentityLifecycleLock::acquire($central);
                $user = User::withTrashed()->where('email', $email)->lockForUpdate()->first();

                if ($user instanceof User && $this->canIssueResetLink($user, $central)) {
                    if ($tokens->recentlyCreatedToken($user)) {
                        return null;
                    }

                    return ['user' => $user, 'token' => $tokens->create($user)];
                } elseif ($user instanceof User) {
                    $central->table('password_reset_tokens')->where('email', $email)->delete();
                }

                return null;
            });

            if ($dispatch === null) {
                return;
            }

            try {
                $dispatch['user']->sendPasswordResetNotification($dispatch['token']);
                event(new PasswordResetLinkSent($dispatch['user']));
            } catch (Throwable $exception) {
                $this->discardFailedDispatchToken($dispatch['user'], $dispatch['token'], $tokens);
                Log::warning('Password reset link notification failed.', [
                    'user_id' => (string) $dispatch['user']->getKey(),
                    'request_id' => $this->audit->requestId($request),
                    'exception' => $exception::class,
                ]);
            }
        }, 200_000);
    }

    public function reset(
        Request $request,
        string $email,
        #[SensitiveParameter] string $token,
        #[SensitiveParameter] string $password,
    ): User {
        $central = DB::connection((string) config('tenancy.database.central_connection'));
        $broker = Password::broker();
        if (! $broker instanceof PasswordBroker) {
            throw new LogicException('The configured password broker must expose its token repository.');
        }

        return $broker->getTimebox()->call(function (Timebox $timebox) use (
            $request,
            $email,
            $token,
            $password,
            $central,
            $broker,
        ): User {
            $user = $central->transaction(function () use (
                $request,
                $email,
                $token,
                $password,
                $central,
                $broker,
            ): User {
                IdentityLifecycleLock::acquire($central);
                $user = User::withTrashed()->where('email', $email)->lockForUpdate()->first();

                if (! $user instanceof User) {
                    $this->invalidToken();
                }

                $status = $user->getAttribute('status');
                $pendingPlatformOperator = $status === UserStatus::Pending
                    && $central->table('role_user')
                        ->join('roles', 'roles.id', '=', 'role_user.role_id')
                        ->where('role_user.user_id', $user->getKey())
                        ->where('roles.scope', RoleScope::Platform->value)
                        ->exists();

                if ($user->trashed()
                    || ! $status instanceof UserStatus
                    || $status === UserStatus::Suspended
                    || ($status === UserStatus::Pending && ! $pendingPlatformOperator)) {
                    $central->table('password_reset_tokens')->where('email', $email)->delete();

                    return $user->setAttribute('identity_reset_blocked', true);
                }

                if (! $broker->tokenExists($user, $token)) {
                    $this->invalidToken();
                }

                $newStatus = $pendingPlatformOperator ? UserStatus::Active : $status;
                $oldGeneration = (int) $user->getAttribute('session_generation');
                $user->forceFill([
                    'password' => $password,
                    'status' => $newStatus,
                    'email_verified_at' => $pendingPlatformOperator ? now() : $user->email_verified_at,
                    'remember_token' => Str::random(60),
                ])->save();
                $updated = $central->table('users')
                    ->where('id', $user->getKey())
                    ->where('session_generation', $oldGeneration)
                    ->update(['session_generation' => DB::raw('session_generation + 1')]);
                if ($updated !== 1) {
                    $this->invalidToken();
                }
                $user->setAttribute('session_generation', $oldGeneration + 1);

                $central->table('sessions')->where('user_id', $user->getKey())->delete();
                $broker->deleteToken($user);

                $this->audit->record(
                    request: $request,
                    actor: $user,
                    action: $pendingPlatformOperator
                        ? 'identity.platform_user.activated'
                        : 'identity.password.reset',
                    subject: $user,
                    tenant: null,
                    oldValues: ['status' => $status->value],
                    newValues: [
                        'status' => $newStatus->value,
                        'email_verified' => $pendingPlatformOperator,
                        'sessions_revoked' => true,
                    ],
                );

                return $user;
            });

            if ($user->getAttribute('identity_reset_blocked') === true) {
                $this->invalidToken();
            }

            event(new PasswordReset($user));
            $timebox->returnEarly();

            return $user;
        }, 200_000);
    }

    private function invalidToken(): never
    {
        throw ValidationException::withMessages([
            'email' => ['رابط إعادة كلمة المرور غير صالح أو منتهي.'],
        ]);
    }

    private function canIssueResetLink(User $user, ConnectionInterface $central): bool
    {
        if ($user->trashed()) {
            return false;
        }

        $status = $user->getAttribute('status');
        if ($status === UserStatus::Active) {
            $passwordHash = $user->getRawOriginal('password');

            return is_string($passwordHash) && $passwordHash !== '';
        }

        return $status === UserStatus::Pending
            && $user->getRawOriginal('password') === null
            && $central->table('role_user')
                ->join('roles', 'roles.id', '=', 'role_user.role_id')
                ->where('role_user.user_id', $user->getKey())
                ->where('roles.scope', RoleScope::Platform->value)
                ->exists();
    }

    private function discardFailedDispatchToken(
        User $user,
        #[SensitiveParameter] string $token,
        TokenRepositoryInterface $tokens,
    ): void {
        $central = DB::connection((string) config('tenancy.database.central_connection'));
        $central->transaction(function () use ($user, $token, $tokens, $central): void {
            IdentityLifecycleLock::acquire($central);
            $target = User::withTrashed()->whereKey($user->getKey())->lockForUpdate()->first();
            if ($target instanceof User && $tokens->exists($target, $token)) {
                $tokens->delete($target);
            }
        });
    }
}
