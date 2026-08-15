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
        $activeAt = $this->getAttribute('active_at');

        return [
            'id' => $this->getKey(),
            'storeName' => $this->getAttribute('store_name'),
            'ownerName' => $this->getAttribute('owner_name'),
            'ownerEmail' => $this->getAttribute('owner_email'),
            'ownerPhone' => $this->getAttribute('owner_phone'),
            'businessType' => $this->getAttribute('business_type'),
            'verificationStatus' => $this->getAttribute('verification_status'),
            'provisioningStatus' => $this->getAttribute('provisioning_status'),
            'rejectionReason' => $this->getAttribute('rejection_reason'),
            'themeStyle' => $this->getAttribute('theme_style'),
            'domains' => $this->whenLoaded('domains', fn () => $this->domains->pluck('domain')->values()->all()),
            'createdAt' => $createdAt instanceof CarbonInterface ? $createdAt->toIso8601String() : null,
            'activeAt' => $activeAt instanceof CarbonInterface ? $activeAt->toIso8601String() : null,
            'latestProvisioningRun' => $this->whenLoaded('latestProvisioningRun', function (): ?array {
                $run = $this->latestProvisioningRun;

                return $run === null ? null : [
                    'id' => $run->getKey(),
                    'status' => $run->getAttribute('status')?->value,
                    'runNumber' => $run->getAttribute('run_number'),
                    'lastCompletedStep' => $run->getAttribute('last_completed_step'),
                    'lastErrorCode' => $run->getAttribute('last_error_code'),
                    'lastErrorMessage' => $run->getAttribute('last_error_message'),
                ];
            }),
        ];
    }
}
