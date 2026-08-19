<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class StoreSubmission extends Model
{
    use CentralConnection;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'payload_snapshot' => 'array',
            'revision' => 'integer',
            'submitted_at' => 'immutable_datetime',
            'revised_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<StoreDraft, $this> */
    public function draft(): BelongsTo
    {
        return $this->belongsTo(StoreDraft::class, 'store_draft_id');
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /** @return BelongsTo<User, $this> */
    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by_user_id');
    }
}
