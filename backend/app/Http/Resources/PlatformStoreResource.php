<?php

namespace App\Http\Resources;

use App\Models\Tenant;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Tenant
 */
class PlatformStoreResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $createdAt = $this->getAttribute('created_at');

        return [
            'id' => $this->getKey(),
            'storeName' => $this->getAttribute('store_name'),
            'ownerName' => $this->getAttribute('owner_name'),
            'ownerEmail' => $this->getAttribute('owner_email'),
            'ownerPhone' => $this->getAttribute('owner_phone'),
            'businessType' => $this->getAttribute('business_type'),
            'verificationStatus' => $this->getAttribute('verification_status'),
            'rejectionReason' => $this->getAttribute('rejection_reason'),
            'themeStyle' => $this->getAttribute('theme_style'),
            'domains' => $this->whenLoaded('domains', fn () => $this->domains->pluck('domain')->values()->all()),
            'createdAt' => $createdAt instanceof CarbonInterface ? $createdAt->toIso8601String() : null,
        ];
    }
}
