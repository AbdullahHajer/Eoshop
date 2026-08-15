<?php

namespace App\Services;

use App\Enums\DomainReservationOrigin;
use App\Enums\DomainReservationStatus;
use App\Enums\PublicationRequestOrigin;
use App\Enums\PublicationRequestStatus;
use App\Enums\PublicationStatus;
use App\Enums\SubscriptionStatus;
use App\Models\DomainReservation;
use App\Models\ProvisioningRun;
use App\Models\PublicationRequest;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Support\PublicationReadiness;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class PublicationService
{
    public function __construct(
        private readonly DomainReservationService $domains,
        private readonly AdminAuditService $audit,
    ) {}

    public function createRequest(
        Tenant $tenant,
        DomainReservation $reservation,
        TenantSubscription $subscription,
        User $actor,
    ): PublicationRequest {
        $publication = PublicationRequest::query()->create([
            'tenant_id' => $tenant->getKey(),
            'domain_reservation_id' => $reservation->getKey(),
            'tenant_subscription_id' => $subscription->getKey(),
            'status' => PublicationRequestStatus::Requested,
            'origin' => PublicationRequestOrigin::UserSelected,
            'requested_by_user_id' => $actor->getKey(),
            'requested_at' => now(),
        ]);
        $tenant->forceFill([
            'publication_status' => PublicationStatus::Requested->value,
            'publication_requested_at' => now(),
            'published_at' => null,
            'publication_request_id' => $publication->getKey(),
            'published_domain_id' => null,
            'publication_subscription_id' => null,
        ])->save();

        return $publication;
    }

    public function reject(Tenant $tenant, User $actor, ?string $reason = null): void
    {
        $publication = PublicationRequest::query()
            ->whereKey($tenant->getAttribute('publication_request_id'))
            ->where('status', PublicationRequestStatus::Requested)
            ->lockForUpdate()
            ->first();
        if ($publication === null) {
            return;
        }

        $publication->forceFill([
            'status' => PublicationRequestStatus::Rejected,
            'decided_by_user_id' => $actor->getKey(),
            'decision_reason' => $reason,
            'decided_at' => now(),
        ])->save();
        $tenant->forceFill([
            'publication_status' => PublicationStatus::Rejected->value,
            'published_at' => null,
            'published_domain_id' => null,
            'publication_subscription_id' => null,
        ])->save();
        $this->domains->releaseForRejection($tenant);
    }

    public function reopen(Tenant $tenant, User $actor): void
    {
        $previous = DomainReservation::query()
            ->where('tenant_id', $tenant->getKey())
            ->latest('created_at')
            ->lockForUpdate()
            ->firstOrFail();
        $reservation = $previous->getAttribute('origin') === DomainReservationOrigin::Wp22Internal
            && $previous->getAttribute('status') === DomainReservationStatus::Active
                ? $previous
                : $this->domains->reacquireForReview($tenant, $actor);
        $subscription = TenantSubscription::query()
            ->where('tenant_id', $tenant->getKey())
            ->whereIn('status', [SubscriptionStatus::PendingActivation, SubscriptionStatus::Active])
            ->lockForUpdate()
            ->firstOrFail();
        $this->createRequest($tenant, $reservation, $subscription, $actor);
    }

    public function publish(Tenant $tenant, User $actor, Request $request): Tenant
    {
        return DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($tenant, $actor, $request): Tenant {
                $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
                Gate::forUser($actor)->authorize('publish', $lockedTenant);
                if ($lockedTenant->getAttribute('publication_status') === PublicationStatus::Published->value) {
                    return $lockedTenant;
                }

                $publication = PublicationRequest::query()
                    ->whereKey($lockedTenant->getAttribute('publication_request_id'))
                    ->lockForUpdate()
                    ->firstOrFail();
                $reservation = DomainReservation::query()->whereKey($publication->getAttribute('domain_reservation_id'))->lockForUpdate()->firstOrFail();
                $subscription = TenantSubscription::query()->whereKey($publication->getAttribute('tenant_subscription_id'))->lockForUpdate()->firstOrFail();
                $run = ProvisioningRun::query()
                    ->where('tenant_id', $lockedTenant->getKey())
                    ->orderByDesc('run_number')
                    ->lockForUpdate()
                    ->first();

                $publication->setRelation('reservation', $reservation);
                $publication->setRelation('subscription', $subscription);
                $lockedTenant->setRelation('currentPublicationRequest', $publication);
                $lockedTenant->setRelation('latestProvisioningRun', $run);
                if (PublicationReadiness::blockers($lockedTenant) !== []) {
                    throw new DomainException('The store is not ready for publication.');
                }

                $requestStatus = $publication->getAttribute('status');
                $republishing = $lockedTenant->getAttribute('publication_status') === PublicationStatus::Unpublished->value
                    && $requestStatus === PublicationRequestStatus::Published;
                if ($requestStatus !== PublicationRequestStatus::Requested && ! $republishing) {
                    throw new DomainException('The publication request is not publishable.');
                }
                $domain = $this->domains->activate($lockedTenant, $reservation);
                if (! $republishing) {
                    $publication->forceFill([
                        'status' => PublicationRequestStatus::Published,
                        'decided_by_user_id' => $actor->getKey(),
                        'decided_at' => now(),
                        'published_at' => now(),
                    ])->save();
                }
                $oldStatus = $lockedTenant->getAttribute('publication_status');
                $lockedTenant->forceFill([
                    'publication_status' => PublicationStatus::Published->value,
                    'published_at' => now(),
                    'published_domain_id' => $domain->getKey(),
                    'publication_subscription_id' => $subscription->getKey(),
                ])->save();
                $this->audit->record(
                    request: $request,
                    actor: $actor,
                    action: 'platform.store.published',
                    subject: $lockedTenant,
                    tenant: $lockedTenant,
                    oldValues: ['publication_status' => $oldStatus],
                    newValues: [
                        'publication_status' => PublicationStatus::Published->value,
                        'domain' => $domain->getAttribute('domain'),
                        'subscription_id' => $subscription->getKey(),
                    ],
                );

                return $lockedTenant->refresh();
            });
    }

    public function unpublish(Tenant $tenant, User $actor, Request $request): Tenant
    {
        return DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($tenant, $actor, $request): Tenant {
                $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
                Gate::forUser($actor)->authorize('publish', $lockedTenant);
                if ($lockedTenant->getAttribute('publication_status') === PublicationStatus::Unpublished->value) {
                    return $lockedTenant;
                }
                if ($lockedTenant->getAttribute('publication_status') !== PublicationStatus::Published->value) {
                    throw new DomainException('Only a published store can be unpublished.');
                }

                $lockedTenant->forceFill([
                    'publication_status' => PublicationStatus::Unpublished->value,
                    'published_at' => null,
                ])->save();
                $this->audit->record(
                    request: $request,
                    actor: $actor,
                    action: 'platform.store.unpublished',
                    subject: $lockedTenant,
                    tenant: $lockedTenant,
                    oldValues: ['publication_status' => PublicationStatus::Published->value],
                    newValues: ['publication_status' => PublicationStatus::Unpublished->value],
                );

                return $lockedTenant->refresh();
            });
    }
}
