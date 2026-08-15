<?php

namespace App\Models;

use App\Enums\ProvisioningSchemaOrigin;
use App\Enums\ProvisioningState;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class ProvisioningRun extends Model
{
    use CentralConnection, HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'status' => ProvisioningState::class,
            'schema_origin' => ProvisioningSchemaOrigin::class,
            'schema_created_at' => 'immutable_datetime',
            'queued_at' => 'immutable_datetime',
            'started_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime',
            'failed_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /** @return HasMany<ProvisioningStepRecord, $this> */
    public function steps(): HasMany
    {
        return $this->hasMany(ProvisioningStepRecord::class, 'run_id');
    }
}
