<?php

namespace App\Models;

use App\Enums\PlanActivationMode;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class Plan extends Model
{
    use CentralConnection;

    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'activation_mode' => PlanActivationMode::class,
            'features' => 'array',
            'is_active' => 'boolean',
            'price_minor' => 'integer',
            'max_stores' => 'integer',
            'max_products' => 'integer',
        ];
    }

    /** @return HasMany<TenantSubscription, $this> */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(TenantSubscription::class, 'plan_key');
    }
}
