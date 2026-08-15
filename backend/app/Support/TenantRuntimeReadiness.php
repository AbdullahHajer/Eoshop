<?php

namespace App\Support;

use App\Enums\DomainReservationStatus;
use App\Enums\ProvisioningState;
use App\Enums\PublicationRequestStatus;
use App\Enums\PublicationStatus;
use App\Enums\TenantVerificationStatus;
use App\Models\Domain;
use App\Models\DomainReservation;
use App\Models\ProvisioningRun;
use App\Models\PublicationRequest;
use App\Models\Tenant;
use App\Models\TenantSubscription;

class TenantRuntimeReadiness
{
    public static function check(Tenant $tenant, string $host): bool
    {
        if (PublicationReadiness::blockers($tenant) !== []) {
            return false;
        }

        $tenant->loadMissing([
            'latestProvisioningRun',
            'currentPublicationRequest.reservation',
            'publishedDomain',
            'publicationSubscription',
        ]);
        $run = $tenant->latestProvisioningRun;
        $publication = $tenant->currentPublicationRequest;
        $reservation = $publication instanceof PublicationRequest ? $publication->reservation : null;
        $subscription = $tenant->publicationSubscription;
        $publishedDomain = $tenant->publishedDomain;
        $schema = TenantSchemaName::for((string) $tenant->getKey());

        return $tenant->getAttribute('verification_status') === TenantVerificationStatus::Approved->value
            && $tenant->getAttribute('provisioning_status') === ProvisioningState::Active->value
            && $tenant->getAttribute('publication_status') === PublicationStatus::Published->value
            && $run instanceof ProvisioningRun
            && $run->getAttribute('status') === ProvisioningState::Active
            && $run->getAttribute('schema_name') === $schema
            && $run->getAttribute('schema_origin') !== null
            && $run->getAttribute('schema_created_at') !== null
            && $publication instanceof PublicationRequest
            && $publication->getAttribute('tenant_id') === $tenant->getKey()
            && $publication->getAttribute('status') === PublicationRequestStatus::Published
            && $reservation instanceof DomainReservation
            && $reservation->getAttribute('tenant_id') === $tenant->getKey()
            && $reservation->getAttribute('status') === DomainReservationStatus::Active
            && $tenant->getAttribute('publication_request_id') === $publication->getKey()
            && $publishedDomain instanceof Domain
            && $tenant->getAttribute('published_domain_id') === $publishedDomain->getKey()
            && $publishedDomain->getAttribute('domain') === $host
            && $publishedDomain->getAttribute('tenant_id') === $tenant->getKey()
            && $reservation->getAttribute('domain') === $host
            && $subscription instanceof TenantSubscription
            && $subscription->getAttribute('tenant_id') === $tenant->getKey()
            && $tenant->getAttribute('publication_subscription_id') === $subscription->getKey()
            && $publication->getAttribute('tenant_subscription_id') === $subscription->getKey()
            && $subscription->isCurrentlyActive()
            && $tenant->database()->manager()->databaseExists($schema);
    }
}
