<?php

namespace App\Http\Resources;

use App\Models\Domain;
use App\Models\Tenant;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Tenant */
class StoreSubmissionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $createdAt = $this->getAttribute('created_at');

        return [
            'id' => $this->getKey(),
            'storeName' => $this->getAttribute('store_name'),
            'businessType' => $this->getAttribute('business_type'),
            'verificationStatus' => $this->getAttribute('verification_status'),
            'provisioningStatus' => $this->getAttribute('provisioning_status'),
            'domain' => $this->whenLoaded('domains', function (): ?string {
                $domain = $this->domains->first();

                return $domain instanceof Domain ? (string) $domain->getAttribute('domain') : null;
            }),
            'createdAt' => $createdAt instanceof CarbonInterface ? $createdAt->toIso8601String() : null,
        ];
    }
}
