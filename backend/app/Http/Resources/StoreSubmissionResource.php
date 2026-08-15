<?php

namespace App\Http\Resources;

use App\Enums\DomainKind;
use App\Models\Domain;
use App\Models\PublicationRequest;
use App\Models\Tenant;
use App\Support\PublicationReadiness;
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
            'publicationStatus' => $this->getAttribute('publication_status'),
            'internalDomain' => $this->whenLoaded('domains', function (): ?string {
                $domain = $this->domains->firstWhere('kind', DomainKind::Internal);

                return $domain instanceof Domain ? (string) $domain->getAttribute('domain') : null;
            }),
            'requestedDomain' => $this->whenLoaded('currentPublicationRequest', function (): ?string {
                $publication = $this->currentPublicationRequest;

                return $publication instanceof PublicationRequest
                    ? (string) $publication->reservation?->getAttribute('domain')
                    : null;
            }),
            'plan' => $this->whenLoaded('currentPublicationRequest', function (): ?array {
                $subscription = $this->currentPublicationRequest?->subscription;
                $plan = $subscription?->plan;

                return $plan === null ? null : [
                    'key' => $plan->getKey(),
                    'name' => $plan->getAttribute('name'),
                    'activationMode' => $plan->getAttribute('activation_mode')->value,
                ];
            }),
            'subscriptionStatus' => $this->whenLoaded('currentPublicationRequest', fn (): ?string => $this->currentPublicationRequest?->subscription?->getAttribute('status')?->value),
            'publicationBlockers' => PublicationReadiness::blockers($this->resource),
            'createdAt' => $createdAt instanceof CarbonInterface ? $createdAt->toIso8601String() : null,
        ];
    }
}
