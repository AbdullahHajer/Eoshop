<?php

namespace App\Services;

use App\Enums\RoleScope;
use App\Enums\TenantMembershipStatus;
use App\Models\Role;
use App\Models\User;
use App\Support\SqlLikePattern;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class PlatformUserReadService
{
    /** @return Collection<int, Role> */
    public function roles(): Collection
    {
        return Role::query()
            ->where('scope', RoleScope::Platform->value)
            ->where('system', true)
            ->with(['permissions' => fn ($query) => $query->where('permissions.scope', RoleScope::Platform->value)])
            ->orderBy('key')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, User>
     */
    public function users(array $filters): LengthAwarePaginator
    {
        $query = $this->baseQuery();

        if (isset($filters['search'])) {
            $search = SqlLikePattern::containsLiteral((string) $filters['search']);
            $query->where(function (Builder $nested) use ($search): void {
                $nested->whereLike('name', $search, caseSensitive: false)
                    ->orWhereLike('email', $search, caseSensitive: false);
            });
        }

        if (isset($filters['status'])) {
            $query->where('status', (string) $filters['status']);
        }

        if (isset($filters['role'])) {
            $role = (string) $filters['role'];
            $query->whereHas('platformRoles', fn (Builder $roles) => $roles
                ->where('roles.scope', RoleScope::Platform->value)
                ->where('roles.system', true)
                ->where('roles.key', $role));
        }

        return $query
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate((int) ($filters['perPage'] ?? 25));
    }

    public function user(User|string $user): User
    {
        $id = $user instanceof User ? $user->getKey() : $user;

        return $this->baseQuery()->whereKey($id)->firstOrFail();
    }

    /** @return Builder<User> */
    private function baseQuery(): Builder
    {
        return User::query()
            ->whereHas('platformRoles', fn (Builder $roles) => $roles
                ->where('roles.scope', RoleScope::Platform->value))
            ->with(['platformRoles' => fn ($roles) => $roles
                ->where('roles.scope', RoleScope::Platform->value)
                ->with(['permissions' => fn ($permissions) => $permissions
                    ->where('permissions.scope', RoleScope::Platform->value)])])
            ->withCount(['tenants as active_tenant_membership_count' => fn (Builder $memberships) => $memberships
                ->where('tenant_user.status', TenantMembershipStatus::Active->value)]);
    }
}
