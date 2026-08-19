<?php

namespace App\Support;

use App\Enums\DomainReservationStatus;
use App\Enums\ProvisioningState;
use App\Enums\PublicationRequestStatus;
use App\Enums\SubscriptionStatus;
use App\Enums\TenantVerificationStatus;
use App\Models\DomainReservation;
use App\Models\ProvisioningRun;
use App\Models\PublicationRequest;
use App\Models\Tenant;
use App\Models\TenantSubscription;

final class PublicationReadiness
{
    /** @return list<string> */
    public static function blockers(Tenant $tenant): array
    {
        $tenant->loadMissing([
            'latestProvisioningRun',
            'currentPublicationRequest.reservation',
            'currentPublicationRequest.subscription',
        ]);
        $blockers = [];
        $run = $tenant->latestProvisioningRun;
        $publication = $tenant->currentPublicationRequest;
        $reservation = $publication instanceof PublicationRequest ? $publication->reservation : null;
        $subscription = $publication instanceof PublicationRequest ? $publication->subscription : null;
        $tenantId = (string) $tenant->getKey();
        $schema = TenantSchemaName::for($tenantId);

        if ($tenant->getAttribute('verification_status') !== TenantVerificationStatus::Approved->value) {
            $blockers[] = 'review_not_approved';
        }
        if ($tenant->getAttribute('provisioning_status') !== ProvisioningState::Active->value
            || ! $run instanceof ProvisioningRun
            || $run->getAttribute('status') !== ProvisioningState::Active
            || $run->getAttribute('tenant_id') !== $tenantId
            || $run->getAttribute('schema_name') !== $schema
            || $run->getAttribute('schema_origin') === null
            || $run->getAttribute('schema_created_at') === null
            || ! $tenant->database()->manager()->databaseExists($schema)
        ) {
            $blockers[] = 'provisioning_not_ready';
        }
        if (! in_array('provisioning_not_ready', $blockers, true)
            && $tenant->getAttribute('verification_status') === TenantVerificationStatus::Approved->value
            && ! TenantWorkspaceReadiness::isMaterialized($tenant)
        ) {
            $blockers[] = 'workspace_not_ready';
        }
        if (! $publication instanceof PublicationRequest
            || ! in_array($publication->getAttribute('status'), [PublicationRequestStatus::Requested, PublicationRequestStatus::Published], true)
            || $publication->getAttribute('tenant_id') !== $tenantId
            || $tenant->getAttribute('publication_request_id') !== $publication->getKey()
        ) {
            $blockers[] = 'publication_request_not_open';
        }
        if (! $reservation instanceof DomainReservation
            || ! in_array($reservation->getAttribute('status'), [DomainReservationStatus::Reserved, DomainReservationStatus::Active], true)
            || $reservation->getAttribute('tenant_id') !== $tenantId
            || $publication->getAttribute('domain_reservation_id') !== $reservation->getKey()
        ) {
            $blockers[] = 'domain_not_reserved';
        }
        if (! $subscription instanceof TenantSubscription
            || $subscription->getAttribute('status') !== SubscriptionStatus::Active
            || $subscription->getAttribute('tenant_id') !== $tenantId
            || $publication->getAttribute('tenant_subscription_id') !== $subscription->getKey()
            || ! $subscription->isCurrentlyActive()
        ) {
            $blockers[] = 'subscription_not_active';
        }

        return $blockers;
    }
}
