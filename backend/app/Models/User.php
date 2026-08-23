<?php

namespace App\Models;

use App\Enums\PermissionKey;
use App\Enums\RoleScope;
use App\Enums\TenantMembershipStatus;
use App\Enums\UserStatus;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class User extends Authenticatable
{
    use CentralConnection, HasFactory, HasUlids, Notifiable, SoftDeletes;

    /** @var array<string, mixed> */
    protected $attributes = [
        'session_generation' => 1,
        'profile_revision' => 1,
    ];

    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'status',
        'email_verified_at',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'session_generation',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => UserStatus::class,
            'email_verified_at' => 'immutable_datetime',
            'last_login_at' => 'immutable_datetime',
            'password' => 'hashed',
            'session_generation' => 'integer',
            'profile_revision' => 'integer',
        ];
    }

    /**
     * @return Attribute<string, string>
     */
    protected function email(): Attribute
    {
        return Attribute::make(
            set: static fn (string $value): string => Str::lower(trim($value)),
        );
    }

    /**
     * @return BelongsToMany<Role, $this>
     */
    public function platformRoles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_user')
            ->withPivot(['role_scope', 'assigned_by'])
            ->withTimestamps();
    }

    /**
     * @return BelongsToMany<Tenant, $this, TenantMembership, 'pivot'>
     */
    public function tenants(): BelongsToMany
    {
        return $this->belongsToMany(Tenant::class, 'tenant_user')
            ->using(TenantMembership::class)
            ->withPivot(['role_id', 'role_scope', 'status', 'invited_by', 'joined_at'])
            ->withTimestamps();
    }

    public function hasPlatformPermission(PermissionKey|string $permission): bool
    {
        $permissionKey = $permission instanceof PermissionKey ? $permission->value : $permission;

        return DB::connection((string) config('tenancy.database.central_connection'))->table('role_user')
            ->join('users', 'users.id', '=', 'role_user.user_id')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->join('permission_role', 'permission_role.role_id', '=', 'roles.id')
            ->join('permissions', 'permissions.id', '=', 'permission_role.permission_id')
            ->where('role_user.user_id', $this->getKey())
            ->where('users.status', UserStatus::Active->value)
            ->whereNull('users.deleted_at')
            ->where('roles.scope', RoleScope::Platform->value)
            ->where('permissions.scope', RoleScope::Platform->value)
            ->where('permissions.key', $permissionKey)
            ->exists();
    }

    /**
     * @return list<string>
     */
    public function platformPermissionKeys(): array
    {
        if ($this->getAttribute('status') !== UserStatus::Active || $this->trashed()) {
            return [];
        }

        return DB::connection((string) config('tenancy.database.central_connection'))->table('role_user')
            ->join('roles', 'roles.id', '=', 'role_user.role_id')
            ->join('permission_role', 'permission_role.role_id', '=', 'roles.id')
            ->join('permissions', 'permissions.id', '=', 'permission_role.permission_id')
            ->where('role_user.user_id', $this->getKey())
            ->where('roles.scope', RoleScope::Platform->value)
            ->where('permissions.scope', RoleScope::Platform->value)
            ->distinct()
            ->orderBy('permissions.key')
            ->pluck('permissions.key')
            ->all();
    }

    public function hasTenantPermission(Tenant|string $tenant, PermissionKey|string $permission): bool
    {
        $tenantId = $tenant instanceof Tenant ? $tenant->getKey() : $tenant;
        $permissionKey = $permission instanceof PermissionKey ? $permission->value : $permission;

        return DB::connection((string) config('tenancy.database.central_connection'))->table('tenant_user')
            ->join('users', 'users.id', '=', 'tenant_user.user_id')
            ->join('roles', 'roles.id', '=', 'tenant_user.role_id')
            ->join('permission_role', 'permission_role.role_id', '=', 'roles.id')
            ->join('permissions', 'permissions.id', '=', 'permission_role.permission_id')
            ->where('tenant_user.tenant_id', $tenantId)
            ->where('tenant_user.user_id', $this->getKey())
            ->where('users.status', UserStatus::Active->value)
            ->whereNull('users.deleted_at')
            ->where('tenant_user.status', TenantMembershipStatus::Active->value)
            ->where('roles.scope', RoleScope::Tenant->value)
            ->where('permissions.scope', RoleScope::Tenant->value)
            ->where('permissions.key', $permissionKey)
            ->exists();
    }
}
