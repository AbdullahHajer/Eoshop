<?php

namespace App\Http\Resources;

use App\Enums\UserStatus;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class AuthenticatedUserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $status = $this->resource->getAttribute('status');
        $emailVerifiedAt = $this->resource->getAttribute('email_verified_at');

        return [
            'id' => $this->getKey(),
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'status' => $status instanceof UserStatus ? $status->value : (string) $status,
            'email_verified_at' => $emailVerifiedAt instanceof CarbonInterface ? $emailVerifiedAt->toIso8601String() : null,
            'platform_roles' => $this->platformRoles->pluck('key')->values()->all(),
            'platform_permissions' => $this->platformPermissionKeys(),
        ];
    }
}
