<?php

namespace App\Services;

use App\Enums\DomainKind;
use App\Enums\DomainReservationOrigin;
use App\Enums\DomainReservationStatus;
use App\Exceptions\StoreSubmissionConflict;
use App\Models\Domain;
use App\Models\DomainReservation;
use App\Models\Tenant;
use App\Models\User;
use App\Support\PublicStoreHandle;
use Illuminate\Support\Facades\DB;
use LogicException;

class DomainReservationService
{
    public function isAvailable(string $handle): bool
    {
        $domain = PublicStoreHandle::domain($handle);

        return ! Domain::query()->where('domain', $domain)->exists()
            && ! DomainReservation::query()
                ->where('domain', $domain)
                ->whereIn('status', [DomainReservationStatus::Reserved, DomainReservationStatus::Active])
                ->exists();
    }

    public function reserve(Tenant $tenant, string $handle, User $actor): DomainReservation
    {
        $domain = PublicStoreHandle::domain($handle);
        $this->lockHostname($domain);

        if (Domain::query()->where('domain', $domain)->exists()
            || DomainReservation::query()
                ->where('domain', $domain)
                ->whereIn('status', [DomainReservationStatus::Reserved, DomainReservationStatus::Active])
                ->exists()
        ) {
            throw StoreSubmissionConflict::domainUnavailable();
        }

        if (DomainReservation::query()
            ->where('tenant_id', $tenant->getKey())
            ->whereIn('status', [DomainReservationStatus::Reserved, DomainReservationStatus::Active])
            ->exists()
        ) {
            throw StoreSubmissionConflict::tenantAlreadyHasDomainReservation();
        }

        return DomainReservation::query()->create([
            'tenant_id' => $tenant->getKey(),
            'domain' => $domain,
            'handle' => PublicStoreHandle::normalize($handle),
            'status' => DomainReservationStatus::Reserved,
            'origin' => DomainReservationOrigin::UserSelected,
            'reserved_by_user_id' => $actor->getKey(),
            'reserved_at' => now(),
        ]);
    }

    public function releaseForRejection(Tenant $tenant): void
    {
        $reservation = DomainReservation::query()
            ->where('tenant_id', $tenant->getKey())
            ->where('origin', DomainReservationOrigin::UserSelected)
            ->where('status', DomainReservationStatus::Reserved)
            ->lockForUpdate()
            ->first();
        if ($reservation === null) {
            return;
        }

        $this->lockHostname((string) $reservation->getAttribute('domain'));
        $reservation->forceFill([
            'status' => DomainReservationStatus::Released,
            'released_at' => now(),
        ])->save();
    }

    public function reacquireForReview(Tenant $tenant, User $actor): DomainReservation
    {
        $previous = DomainReservation::query()
            ->where('tenant_id', $tenant->getKey())
            ->where('origin', DomainReservationOrigin::UserSelected)
            ->latest('created_at')
            ->firstOrFail();

        return $this->reserve($tenant, (string) $previous->getAttribute('handle'), $actor);
    }

    public function activate(Tenant $tenant, DomainReservation $reservation): Domain
    {
        $lockedReservation = DomainReservation::query()->whereKey($reservation->getKey())->lockForUpdate()->firstOrFail();
        if ($lockedReservation->getAttribute('tenant_id') !== $tenant->getKey()
            || ! in_array($lockedReservation->getAttribute('status'), [DomainReservationStatus::Reserved, DomainReservationStatus::Active], true)
        ) {
            throw StoreSubmissionConflict::domainReservationUnavailable();
        }

        $domainName = (string) $lockedReservation->getAttribute('domain');
        $this->lockHostname($domainName);
        $domain = Domain::query()->where('domain', $domainName)->lockForUpdate()->first();
        if ($domain !== null && $domain->getAttribute('tenant_id') !== $tenant->getKey()) {
            throw StoreSubmissionConflict::domainUnavailable();
        }

        if ($domain === null) {
            $domain = Domain::query()->create([
                'tenant_id' => $tenant->getKey(),
                'domain' => $domainName,
                'kind' => DomainKind::PublicSubdomain,
            ]);
        }

        if ($lockedReservation->getAttribute('status') === DomainReservationStatus::Reserved) {
            $lockedReservation->forceFill([
                'status' => DomainReservationStatus::Active,
                'activated_at' => now(),
                'released_at' => null,
            ])->save();
        }

        return $domain;
    }

    private function lockHostname(string $domain): void
    {
        $central = DB::connection((string) config('tenancy.database.central_connection'));
        if ($central->transactionLevel() < 1) {
            throw new LogicException('A hostname reservation requires a central database transaction.');
        }
        $central->selectOne('SELECT pg_advisory_xact_lock(hashtextextended(?, 0)) AS acquired', ['domain-reservation:'.$domain]);
    }
}
