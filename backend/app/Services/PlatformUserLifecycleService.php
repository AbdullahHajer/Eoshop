<?php

namespace App\Services;

use App\Enums\PermissionKey;
use App\Enums\RoleScope;
use App\Enums\UserStatus;
use App\Exceptions\PlatformUserConflict;
use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\Events\PasswordResetLinkSent;
use Illuminate\Auth\Passwords\PasswordBroker;
use Illuminate\Auth\Passwords\TokenRepositoryInterface;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use LogicException;
use SensitiveParameter;
use Throwable;

class PlatformUserLifecycleService
{
    private const LIFECYCLE_LOCK_KEY = 51120260821;

    public function __construct(private readonly AdminAuditService $audit) {}

    /**
     * @param  array{name: string, email: string, roleKeys: list<string>}  $payload
     * @return array{user: User, dispatchStatus: 'accepted'|'throttled'|'failed'}
     */
    public function invite(array $payload, User $actor, Request $request): array
    {
        $central = $this->central();

        try {
            $user = $central->transaction(function () use ($payload, $actor, $request, $central): User {
                $this->acquireLifecycleLock($central);
                $lockedActor = $this->lockActor($actor);
                $this->assertActor($lockedActor);

                if (User::withTrashed()->where('email', $payload['email'])->lockForUpdate()->exists()) {
                    throw $this->emailOccupied();
                }

                $roles = $this->resolveRoles($payload['roleKeys']);
                $user = User::query()->create([
                    'name' => $payload['name'],
                    'email' => $payload['email'],
                    'password' => null,
                    'status' => UserStatus::Pending,
                ]);

                $this->insertRoleAssignments($central, $user, $roles, $lockedActor);
                $this->audit->record(
                    request: $request,
                    actor: $lockedActor,
                    action: 'identity.platform_user.invited',
                    subject: $user,
                    tenant: null,
                    oldValues: null,
                    newValues: [
                        'status' => UserStatus::Pending->value,
                        'role_keys' => $roles->pluck('key')->sort()->values()->all(),
                        'invitation_dispatch' => 'requested',
                    ],
                );

                return $user;
            });
        } catch (QueryException $exception) {
            if ((string) $exception->getCode() === '23505') {
                throw $this->emailOccupied();
            }

            throw $exception;
        }

        return [
            'user' => $user,
            'dispatchStatus' => $this->dispatchInvitation($user, $request),
        ];
    }

    /** @return 'accepted'|'throttled'|'failed' */
    public function resendInvitation(User $target, User $actor, Request $request): string
    {
        $target = $this->central()->transaction(function () use ($target, $actor, $request): User {
            $this->acquireLifecycleLock($this->central());
            [$lockedActor, $lockedTarget] = $this->lockActorAndTarget($actor, $target);
            $this->assertActor($lockedActor);
            $this->assertPlatformOperator($lockedTarget);

            $passwordHash = $lockedTarget->getRawOriginal('password');
            if ($lockedTarget->getAttribute('status') !== UserStatus::Pending
                || $passwordHash !== null) {
                throw new PlatformUserConflict(
                    'Only a pending passwordless platform operator can receive an invitation.',
                    'platform_invitation_state_conflict',
                );
            }

            $this->audit->record(
                request: $request,
                actor: $lockedActor,
                action: 'identity.platform_user.invitation_requested',
                subject: $lockedTarget,
                tenant: null,
                oldValues: null,
                newValues: ['invitation_dispatch' => 'requested'],
            );

            return $lockedTarget;
        });

        return $this->dispatchInvitation($target, $request);
    }

    /**
     * @param  list<string>  $expectedRoleKeys
     * @param  list<string>  $roleKeys
     */
    public function replaceRoles(
        User $target,
        array $expectedRoleKeys,
        array $roleKeys,
        User $actor,
        Request $request,
    ): User {
        return $this->central()->transaction(function () use (
            $target,
            $expectedRoleKeys,
            $roleKeys,
            $actor,
            $request,
        ): User {
            $central = $this->central();
            $this->acquireLifecycleLock($central);
            [$lockedActor, $lockedTarget] = $this->lockActorAndTarget($actor, $target);
            $this->assertActor($lockedActor);
            $this->assertMutableTarget($lockedActor, $lockedTarget);

            $currentRoles = $this->currentRoles($lockedTarget);
            $currentKeys = $currentRoles->pluck('key')->sort()->values()->all();
            sort($expectedRoleKeys, SORT_STRING);
            sort($roleKeys, SORT_STRING);

            if ($currentKeys !== $expectedRoleKeys) {
                throw new PlatformUserConflict(
                    'Platform roles changed on the server. Reload before saving.',
                    'platform_user_roles_stale',
                );
            }

            $desiredRoles = $this->resolveRoles($roleKeys);
            $desiredKeys = $desiredRoles->pluck('key')->sort()->values()->all();
            if ($currentKeys === $desiredKeys) {
                return $lockedTarget;
            }

            if ($lockedTarget->getAttribute('status') === UserStatus::Active
                && $this->rolesGrantUsersManage($currentRoles)
                && ! $this->rolesGrantUsersManage($desiredRoles)) {
                $this->assertAnotherEffectiveManagerExists($lockedTarget);
            }

            $this->replaceRoleAssignments($central, $lockedTarget, $desiredRoles, $lockedActor);
            $this->audit->record(
                request: $request,
                actor: $lockedActor,
                action: 'identity.platform_user.roles_changed',
                subject: $lockedTarget,
                tenant: null,
                oldValues: ['role_keys' => $currentKeys],
                newValues: ['role_keys' => $desiredKeys],
            );

            return $lockedTarget;
        });
    }

    public function changeStatus(
        User $target,
        UserStatus $expectedStatus,
        UserStatus $status,
        User $actor,
        Request $request,
    ): User {
        return $this->central()->transaction(function () use (
            $target,
            $expectedStatus,
            $status,
            $actor,
            $request,
        ): User {
            $central = $this->central();
            $this->acquireLifecycleLock($central);
            [$lockedActor, $lockedTarget] = $this->lockActorAndTarget($actor, $target);
            $this->assertActor($lockedActor);
            $this->assertMutableTarget($lockedActor, $lockedTarget);

            $currentStatus = $lockedTarget->getAttribute('status');
            if ($currentStatus !== $expectedStatus) {
                throw new PlatformUserConflict(
                    'Platform user status changed on the server. Reload before saving.',
                    'platform_user_status_stale',
                );
            }
            if ($currentStatus === $status) {
                return $lockedTarget;
            }

            $passwordHash = $lockedTarget->getRawOriginal('password');
            $hasPassword = is_string($passwordHash) && $passwordHash !== '';
            $allowed = match ($currentStatus) {
                UserStatus::Pending => $status === UserStatus::Suspended,
                UserStatus::Active => $status === UserStatus::Suspended,
                UserStatus::Suspended => $hasPassword
                    ? $status === UserStatus::Active
                    : $status === UserStatus::Pending,
            };
            if (! $allowed) {
                throw new PlatformUserConflict(
                    'The requested platform user status transition is not allowed.',
                    'platform_user_status_transition_invalid',
                );
            }

            if ($currentStatus === UserStatus::Active
                && $status === UserStatus::Suspended
                && $this->rolesGrantUsersManage($this->currentRoles($lockedTarget))) {
                $this->assertAnotherEffectiveManagerExists($lockedTarget);
            }

            $oldGeneration = (int) $lockedTarget->getAttribute('session_generation');
            $newValues = ['status' => $status->value];
            if ($status === UserStatus::Suspended) {
                $lockedTarget->forceFill([
                    'status' => $status,
                    'remember_token' => Str::random(60),
                ])->save();
                $updated = $central->table('users')
                    ->where('id', $lockedTarget->getKey())
                    ->where('session_generation', $oldGeneration)
                    ->update(['session_generation' => DB::raw('session_generation + 1')]);
                if ($updated !== 1) {
                    throw new PlatformUserConflict(
                        'Platform user session state changed on the server.',
                        'platform_user_session_generation_stale',
                    );
                }
                $lockedTarget->setAttribute('session_generation', $oldGeneration + 1);
                $central->table('sessions')->where('user_id', $lockedTarget->getKey())->delete();
                $central->table('password_reset_tokens')->where('email', $lockedTarget->email)->delete();
                $newValues += ['sessions_revoked' => true, 'reset_tokens_revoked' => true];
            } else {
                $lockedTarget->forceFill(['status' => $status])->save();
            }

            $this->audit->record(
                request: $request,
                actor: $lockedActor,
                action: 'identity.platform_user.status_changed',
                subject: $lockedTarget,
                tenant: null,
                oldValues: ['status' => $currentStatus->value],
                newValues: $newValues,
            );

            return $lockedTarget;
        });
    }

    private function acquireLifecycleLock(ConnectionInterface $central): void
    {
        $central->select('SELECT pg_advisory_xact_lock(?)', [self::LIFECYCLE_LOCK_KEY]);
    }

    private function lockActor(User $actor): User
    {
        return User::withTrashed()->whereKey($actor->getKey())->lockForUpdate()->firstOrFail();
    }

    /** @return array{User, User} */
    private function lockActorAndTarget(User $actor, User $target): array
    {
        $users = User::withTrashed()
            ->whereIn('id', array_values(array_unique([(string) $actor->getKey(), (string) $target->getKey()])))
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy(fn (User $user): string => (string) $user->getKey());

        return [
            $users->get((string) $actor->getKey()) ?? throw new AuthorizationException,
            $users->get((string) $target->getKey()) ?? throw new PlatformUserConflict(
                'Platform user was not found.',
                'platform_user_not_found',
                404,
            ),
        ];
    }

    private function assertActor(User $actor): void
    {
        if ($actor->trashed()
            || $actor->getAttribute('status') !== UserStatus::Active
            || ! $actor->hasPlatformPermission(PermissionKey::PlatformUsersManage)) {
            throw new AuthorizationException;
        }
    }

    private function assertMutableTarget(User $actor, User $target): void
    {
        $this->assertPlatformOperator($target);
        if ((string) $actor->getKey() === (string) $target->getKey()) {
            throw new PlatformUserConflict(
                'You cannot change your own platform roles or status.',
                'platform_user_self_mutation_forbidden',
            );
        }
    }

    private function assertPlatformOperator(User $target): void
    {
        if ($target->trashed() || ! $this->central()->table('role_user')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->where('role_user.user_id', $target->getKey())
            ->where('roles.scope', RoleScope::Platform->value)
            ->exists()) {
            throw new PlatformUserConflict(
                'Platform user was not found.',
                'platform_user_not_found',
                404,
            );
        }
    }

    /** @param  list<string>  $roleKeys
     * @return Collection<int, Role>
     */
    private function resolveRoles(array $roleKeys): Collection
    {
        $roles = Role::query()
            ->where('scope', RoleScope::Platform->value)
            ->where('system', true)
            ->whereIn('key', $roleKeys)
            ->with(['permissions' => fn ($query) => $query
                ->where('permissions.scope', RoleScope::Platform->value)])
            ->orderBy('key')
            ->get();

        if ($roles->count() !== count(array_unique($roleKeys))) {
            throw new PlatformUserConflict(
                'The platform role catalog changed. Reload before saving.',
                'platform_role_catalog_changed',
            );
        }

        return $roles;
    }

    /** @return Collection<int, Role> */
    private function currentRoles(User $target): Collection
    {
        return Role::query()
            ->where('scope', RoleScope::Platform->value)
            ->whereHas('platformUsers', fn ($query) => $query->where('users.id', $target->getKey()))
            ->with(['permissions' => fn ($query) => $query
                ->where('permissions.scope', RoleScope::Platform->value)])
            ->orderBy('key')
            ->get();
    }

    /** @param  Collection<int, Role>  $roles */
    private function rolesGrantUsersManage(Collection $roles): bool
    {
        return $roles->contains(fn (Role $role): bool => $role->permissions
            ->contains('key', PermissionKey::PlatformUsersManage->value));
    }

    private function assertAnotherEffectiveManagerExists(User $target): void
    {
        $count = $this->central()->table('role_user')
            ->join('users', 'users.id', '=', 'role_user.user_id')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->join('permission_role', 'permission_role.role_id', '=', 'roles.id')
            ->join('permissions', 'permissions.id', '=', 'permission_role.permission_id')
            ->where('users.status', UserStatus::Active->value)
            ->whereNull('users.deleted_at')
            ->where('roles.scope', RoleScope::Platform->value)
            ->where('permissions.scope', RoleScope::Platform->value)
            ->where('permissions.key', PermissionKey::PlatformUsersManage->value)
            ->where('users.id', '!=', $target->getKey())
            ->distinct('users.id')
            ->count('users.id');

        if ($count < 1) {
            throw new PlatformUserConflict(
                'The last active platform user manager cannot be removed or suspended.',
                'platform_last_user_manager_required',
            );
        }
    }

    /** @param  Collection<int, Role>  $roles */
    private function insertRoleAssignments(
        ConnectionInterface $central,
        User $target,
        Collection $roles,
        User $actor,
    ): void {
        $timestamp = now();
        $central->table('role_user')->insert($roles->map(fn (Role $role): array => [
            'user_id' => $target->getKey(),
            'role_id' => $role->getKey(),
            'role_scope' => RoleScope::Platform->value,
            'assigned_by' => $actor->getKey(),
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ])->all());
    }

    /** @param  Collection<int, Role>  $roles */
    private function replaceRoleAssignments(
        ConnectionInterface $central,
        User $target,
        Collection $roles,
        User $actor,
    ): void {
        $central->table('role_user')->where('user_id', $target->getKey())->delete();
        $this->insertRoleAssignments($central, $target, $roles, $actor);
    }

    /** @return 'accepted'|'throttled'|'failed' */
    private function dispatchInvitation(User $user, Request $request): string
    {
        $dispatchGeneration = (int) $user->getAttribute('session_generation');
        $broker = Password::broker();
        if (! $broker instanceof PasswordBroker) {
            throw new LogicException('The configured password broker must expose its token repository.');
        }
        $tokens = $broker->getRepository();
        $dispatch = $this->createInvitationToken($user, $dispatchGeneration, $tokens);
        if (is_string($dispatch)) {
            return $dispatch;
        }

        try {
            $dispatch['user']->sendPasswordResetNotification($dispatch['token']);
            event(new PasswordResetLinkSent($dispatch['user']));
        } catch (Throwable $exception) {
            $this->discardInvitationToken($dispatch['user'], $dispatch['token'], $tokens);
            Log::warning('Platform invitation dispatch failed.', [
                'user_id' => (string) $user->getKey(),
                'request_id' => $this->audit->requestId($request),
                'exception' => $exception::class,
            ]);

            return 'failed';
        }

        return $this->reconcileInvitationDispatch(
            $dispatch['user'],
            $dispatchGeneration,
            $dispatch['token'],
            $tokens,
        ) ? 'accepted' : 'failed';
    }

    /** @return array{user: User, token: string}|'throttled'|'failed' */
    private function createInvitationToken(
        User $user,
        int $dispatchGeneration,
        TokenRepositoryInterface $tokens,
    ): array|string {
        $central = $this->central();

        return $central->transaction(function () use ($user, $dispatchGeneration, $tokens, $central): array|string {
            $this->acquireLifecycleLock($central);
            $target = User::withTrashed()->whereKey($user->getKey())->lockForUpdate()->first();
            if (! $this->isInvitationDispatchEligible($target, $dispatchGeneration, $central)) {
                return 'failed';
            }
            if ($tokens->recentlyCreatedToken($target)) {
                return 'throttled';
            }

            return ['user' => $target, 'token' => $tokens->create($target)];
        });
    }

    private function reconcileInvitationDispatch(
        User $user,
        int $dispatchGeneration,
        #[SensitiveParameter] string $token,
        TokenRepositoryInterface $tokens,
    ): bool {
        $central = $this->central();

        return $central->transaction(function () use ($user, $dispatchGeneration, $token, $tokens, $central): bool {
            $this->acquireLifecycleLock($central);
            $target = User::withTrashed()->whereKey($user->getKey())->lockForUpdate()->first();
            $eligible = $this->isInvitationDispatchEligible($target, $dispatchGeneration, $central);

            if (! $eligible && $target instanceof User && $tokens->exists($target, $token)) {
                $tokens->delete($target);
            }

            return $eligible;
        });
    }

    private function discardInvitationToken(
        User $user,
        #[SensitiveParameter] string $token,
        TokenRepositoryInterface $tokens,
    ): void {
        $central = $this->central();
        $central->transaction(function () use ($user, $token, $tokens, $central): void {
            $this->acquireLifecycleLock($central);
            $target = User::withTrashed()->whereKey($user->getKey())->lockForUpdate()->first();
            if ($target instanceof User && $tokens->exists($target, $token)) {
                $tokens->delete($target);
            }
        });
    }

    private function isInvitationDispatchEligible(
        ?User $target,
        int $dispatchGeneration,
        ConnectionInterface $central,
    ): bool {
        return $target instanceof User
            && ! $target->trashed()
            && $target->getAttribute('status') === UserStatus::Pending
            && $target->getRawOriginal('password') === null
            && $dispatchGeneration >= 1
            && $target->getAttribute('session_generation') === $dispatchGeneration
            && $central->table('role_user')
                ->join('roles', 'roles.id', '=', 'role_user.role_id')
                ->where('role_user.user_id', $target->getKey())
                ->where('roles.scope', RoleScope::Platform->value)
                ->exists();
    }

    private function emailOccupied(): PlatformUserConflict
    {
        return new PlatformUserConflict(
            'An identity already owns this email address.',
            'platform_user_email_occupied',
        );
    }

    private function central(): ConnectionInterface
    {
        return DB::connection((string) config('tenancy.database.central_connection'));
    }
}
