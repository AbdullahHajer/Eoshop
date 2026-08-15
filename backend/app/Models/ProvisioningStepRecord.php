<?php

namespace App\Models;

use App\Enums\ProvisioningStep;
use App\Enums\ProvisioningStepStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class ProvisioningStepRecord extends Model
{
    use CentralConnection;

    protected $table = 'provisioning_steps';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'step' => ProvisioningStep::class,
            'status' => ProvisioningStepStatus::class,
            'started_at' => 'immutable_datetime',
            'finished_at' => 'immutable_datetime',
        ];
    }

    /** @return BelongsTo<ProvisioningRun, $this> */
    public function run(): BelongsTo
    {
        return $this->belongsTo(ProvisioningRun::class, 'run_id');
    }
}
