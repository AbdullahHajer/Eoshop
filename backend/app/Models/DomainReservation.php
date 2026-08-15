<?php

namespace App\Models;

use App\Enums\DomainReservationOrigin;
use App\Enums\DomainReservationStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class DomainReservation extends Model
{
    use CentralConnection, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'status' => DomainReservationStatus::class,
            'origin' => DomainReservationOrigin::class,
            'reserved_at' => 'immutable_datetime',
            'activated_at' => 'immutable_datetime',
            'released_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }
}
