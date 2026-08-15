<?php

namespace App\Models;

use App\Enums\PublicationRequestOrigin;
use App\Enums\PublicationRequestStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class PublicationRequest extends Model
{
    use CentralConnection, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'status' => PublicationRequestStatus::class,
            'origin' => PublicationRequestOrigin::class,
            'requested_at' => 'immutable_datetime',
            'decided_at' => 'immutable_datetime',
            'published_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /** @return BelongsTo<DomainReservation, $this> */
    public function reservation(): BelongsTo
    {
        return $this->belongsTo(DomainReservation::class, 'domain_reservation_id');
    }

    /** @return BelongsTo<TenantSubscription, $this> */
    public function subscription(): BelongsTo
    {
        return $this->belongsTo(TenantSubscription::class, 'tenant_subscription_id');
    }
}
