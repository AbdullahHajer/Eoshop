<?php

namespace App\Services;

use App\Enums\RoleScope;
use App\Enums\TenantMembershipStatus;
use App\Models\AdminAuditLog;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use DomainException;
use Illuminate\Support\Facades\DB;

class RoleAssignmentService
{
    public function assignPlatformRole(User $user, Role $role, User $actor): void
    {
        $this->assertScope($role, RoleScope::Platform);

        DB::transaction(function () use ($user, $role, $actor): void {
            User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();

            $alreadyAssigned = DB::table('role_user')
                ->where('user_id', $user->getKey())
                ->where('role_id', $role->getKey())
                ->exists();

            if ($alreadyAssigned) {
                return;
            }

            $user->platformRoles()->attach($role->getKey(), [
                'role_scope' => RoleScope::Platform->value,
                'assigned_by' => $actor->getKey(),
            ]);

            $this->recordAssignment(
                action: 'identity.platform_role.assigned',
                user: $user,
                actor: $actor,
                tenant: null,
                oldValues: null,
                newValues: [
                    'role_id' => $role->getKey(),
                    'role' => $role->key,
                ],
            );
        });
    }

    public function assignTenantRole(
        Tenant $tenant,
        User $user,
        Role $role,
        User $actor,
        TenantMembershipStatus $status = TenantMembershipStatus::Active,
    ): void {
        $this->assertScope($role, RoleScope::Tenant);

        DB::transaction(function () use ($tenant, $user, $role, $actor, $status): void {
            User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();

            $existing = DB::table('tenant_user')
                ->where('tenant_id', $tenant->getKey())
                ->where('user_id', $user->getKey())
                ->first();

            if ($existing !== null && (int) $existing->role_id === (int) $role->getKey() && $existing->status === $status->value) {
                return;
            }

            $joinedAt = $existing?->joined_at;
            if ($status === TenantMembershipStatus::Active && $joinedAt === null) {
                $joinedAt = now();
            }

            $invitedBy = $existing === null ? $actor->getKey() : $existing->invited_by;

            $user->tenants()->syncWithoutDetaching([
                $tenant->getKey() => [
                    'role_id' => $role->getKey(),
                    'role_scope' => RoleScope::Tenant->value,
                    'status' => $status->value,
                    'invited_by' => $invitedBy,
                    'joined_at' => $joinedAt,
                ],
            ]);

            $this->recordAssignment(
                action: 'identity.tenant_role.assigned',
                user: $user,
                actor: $actor,
                tenant: $tenant,
                oldValues: $existing === null ? null : [
                    'role_id' => (int) $existing->role_id,
                    'status' => $existing->status,
                ],
                newValues: [
                    'role_id' => $role->getKey(),
                    'role' => $role->key,
                    'status' => $status->value,
                ],
            );
        });
    }

    private function assertScope(Role $role, RoleScope $expectedScope): void
    {
        $actualScope = $role->getAttribute('scope');

        if (! $actualScope instanceof RoleScope || $actualScope !== $expectedScope) {
            throw new DomainException("Role [{$role->key}] cannot be assigned in the [{$expectedScope->value}] scope.");
        }
    }

    /**
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>  $newValues
     */
    private function recordAssignment(
        string $action,
        User $user,
        User $actor,
        ?Tenant $tenant,
        ?array $oldValues,
        array $newValues,
    ): void {
        AdminAuditLog::query()->create([
            'actor_user_id' => $actor->getKey(),
            'tenant_id' => $tenant?->getKey(),
            'action' => $action,
            'subject_type' => User::class,
            'subject_id' => (string) $user->getKey(),
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'occurred_at' => now(),
        ]);
    }
}
