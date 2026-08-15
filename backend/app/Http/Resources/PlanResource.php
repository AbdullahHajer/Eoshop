<?php

namespace App\Http\Resources;

use App\Models\Plan;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Plan */
class PlanResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'key' => $this->getKey(),
            'name' => $this->getAttribute('name'),
            'priceMinor' => $this->getAttribute('price_minor'),
            'currency' => $this->getAttribute('currency'),
            'billingInterval' => $this->getAttribute('billing_interval'),
            'activationMode' => $this->getAttribute('activation_mode')->value,
            'maxStores' => $this->getAttribute('max_stores'),
            'maxProducts' => $this->getAttribute('max_products'),
            'features' => $this->getAttribute('features'),
        ];
    }
}
