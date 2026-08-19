<?php

namespace App\Http\Resources;

use App\Models\StoreDraft;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin StoreDraft */
class StoreDraftResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $savedAt = $this->getAttribute('saved_at');
        $submittedAt = $this->getAttribute('submitted_at');

        return [
            'id' => $this->getKey(),
            'tenantId' => $this->getAttribute('tenant_id'),
            'status' => $this->getAttribute('status')->value,
            'revision' => (int) $this->getAttribute('revision'),
            'storeName' => $this->getAttribute('store_name'),
            'businessType' => $this->getAttribute('business_type'),
            'themeStyle' => $this->getAttribute('theme_style'),
            'handle' => $this->getAttribute('handle'),
            'planKey' => $this->getAttribute('plan_key'),
            'config' => $this->getAttribute('config'),
            'savedAt' => $savedAt instanceof CarbonInterface ? $savedAt->toIso8601String() : null,
            'submittedAt' => $submittedAt instanceof CarbonInterface ? $submittedAt->toIso8601String() : null,
        ];
    }
}
