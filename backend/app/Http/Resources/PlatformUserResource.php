<?php

namespace App\Http\Resources;

use App\Enums\RoleScope;
use App\Enums\UserStatus;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class PlatformUserResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $status = $this->resource->getAttribute('status');
        $active = $status === UserStatus::Active && ! $this->resource->trashed();
        $passwordHash = $this->resource->getRawOriginal('password');
        $resumeStatus = $status === UserStatus::Suspended
            ? (is_string($passwordHash) && $passwordHash !== '' ? UserStatus::Active->value : UserStatus::Pending->value)
            : null;
        $permissions = $active
            ? $this->platformRoles
                ->flatMap->permissions
                ->where('scope', RoleScope::Platform)
                ->pluck('key')
                ->unique()
                ->sort()
                ->values()
                ->all()
            : [];

        return [
            'id' => (string) $this->getKey(),
            'name' => $this->name,
            'email' => $this->email,
            'status' => $status instanceof UserStatus ? $status->value : (string) $status,
            'resumeStatus' => $resumeStatus,
            'roles' => $this->platformRoles
                ->sortBy('key')
                ->values()
                ->map(fn ($role): array => ['key' => $role->key, 'name' => $role->name])
                ->all(),
            'platformPermissions' => $permissions,
            'activeTenantMembershipCount' => (int) $this->resource->getAttribute('active_tenant_membership_count'),
            'emailVerifiedAt' => $this->timestamp($this->resource->getAttribute('email_verified_at')),
            'lastLoginAt' => $this->timestamp($this->resource->getAttribute('last_login_at')),
            'createdAt' => $this->timestamp($this->resource->getAttribute('created_at')),
        ];
    }

    private function timestamp(mixed $value): ?string
    {
        return $value instanceof CarbonInterface ? $value->toIso8601String() : null;
    }
}
