<?php

namespace App\Models;

use App\Enums\SubscriptionActivationSource;
use App\Enums\SubscriptionStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class TenantSubscription extends Model
{
    use CentralConnection, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'status' => SubscriptionStatus::class,
            'activation_source' => SubscriptionActivationSource::class,
            'starts_at' => 'immutable_datetime',
            'ends_at' => 'immutable_datetime',
            'cancelled_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /** @return BelongsTo<Plan, $this> */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_key');
    }

    public function isCurrentlyActive(): bool
    {
        $nowUtc = CarbonImmutable::now('UTC');

        return $this->getAttribute('status') === SubscriptionStatus::Active
            && ($this->getAttribute('starts_at') === null || $this->getAttribute('starts_at')->lessThanOrEqualTo($nowUtc))
            && ($this->getAttribute('ends_at') === null || $this->getAttribute('ends_at')->greaterThan($nowUtc));
    }
}
