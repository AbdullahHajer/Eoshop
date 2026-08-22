<?php

namespace App\Http\Resources;

use Carbon\CarbonInterface;
use Illuminate\Http\Request;

class AdminPlatformSettingsResource extends PlatformSettingsResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $updatedAt = $this->resource->getAttribute('updated_at');

        return [
            ...parent::toArray($request),
            'updatedAt' => $updatedAt instanceof CarbonInterface ? $updatedAt->toIso8601String() : null,
            'updatedByUserId' => $this->resource->getAttribute('updated_by_user_id'),
        ];
    }
}
