<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Concerns\HasDomains;
use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;

class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase, HasDomains;

    protected $guarded = [];

    /**
     * @return HasMany<Domain, $this>
     */
    public function domains(): HasMany
    {
        return $this->hasMany(Domain::class, 'tenant_id');
    }

    /**
     * @return BelongsToMany<User, $this, TenantMembership, 'pivot'>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'tenant_user')
            ->using(TenantMembership::class)
            ->withPivot(['role_id', 'role_scope', 'status', 'invited_by', 'joined_at'])
            ->withTimestamps();
    }

    /** @return HasOne<StoreSubmission, $this> */
    public function submission(): HasOne
    {
        return $this->hasOne(StoreSubmission::class, 'tenant_id');
    }

    /** @return HasMany<ProvisioningRun, $this> */
    public function provisioningRuns(): HasMany
    {
        return $this->hasMany(ProvisioningRun::class, 'tenant_id');
    }

    /** @return HasOne<ProvisioningRun, $this> */
    public function latestProvisioningRun(): HasOne
    {
        // PostgreSQL intentionally has no MAX(uuid), which Laravel's
        // latestOfMany() uses as a tie-breaker. Run numbers are monotonic per
        // tenant, so ordering the has-one relation is deterministic here.
        return $this->hasOne(ProvisioningRun::class, 'tenant_id')->orderByDesc('run_number');
    }

    public static function getCustomColumns(): array
    {
        return [
            'id',
            'store_name',
            'owner_name',
            'owner_email',
            'owner_phone',
            'business_type',
            'verification_status',
            'provisioning_status',
            'active_at',
            'rejection_reason',
            'theme_style',
            'created_at',
            'updated_at',
        ];
    }
}
