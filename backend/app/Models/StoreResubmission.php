<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class StoreResubmission extends Model
{
    use CentralConnection, HasUuids;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'source_draft_revision' => 'integer',
            'result_draft_revision' => 'integer',
            'submitted_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class, 'tenant_id');
    }

    /** @return BelongsTo<StoreDraft, $this> */
    public function draft(): BelongsTo
    {
        return $this->belongsTo(StoreDraft::class, 'store_draft_id');
    }
}
