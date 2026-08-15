<?php

namespace App\Services;

use App\Enums\TenantVerificationStatus;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class PlatformStoreReviewService
{
    public function __construct(
        private readonly AdminAuditService $audit,
        private readonly ProvisioningCoordinator $provisioning,
        private readonly PublicationService $publications,
    ) {}

    public function changeStatus(
        Tenant $tenant,
        TenantVerificationStatus $status,
        ?string $reason,
        User $actor,
        Request $request,
    ): Tenant {
        return DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($tenant, $status, $reason, $actor, $request): Tenant {
                $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
                $normalizedReason = $status->requiresReason() ? trim((string) $reason) : null;
                $oldPublicationStatus = $lockedTenant->getAttribute('publication_status');
                $oldReviewValues = [
                    'verification_status' => $lockedTenant->getAttribute('verification_status'),
                    'rejection_reason' => $lockedTenant->getAttribute('rejection_reason'),
                ];
                $newReviewValues = [
                    'verification_status' => $status->value,
                    'rejection_reason' => $normalizedReason,
                ];

                if ($oldReviewValues === $newReviewValues) {
                    return $lockedTenant;
                }

                Gate::forUser($actor)->authorize('changeStatus', [$lockedTenant, $status]);

                $previousStatus = TenantVerificationStatus::from((string) $lockedTenant->getAttribute('verification_status'));
                if ($previousStatus === TenantVerificationStatus::Pending && $status === TenantVerificationStatus::Rejected) {
                    $this->publications->reject($lockedTenant, $actor, $normalizedReason);
                } elseif ($previousStatus === TenantVerificationStatus::Rejected && $status === TenantVerificationStatus::Pending) {
                    $this->publications->reopen($lockedTenant, $actor);
                }

                $oldValues = $oldReviewValues + ['publication_status' => $oldPublicationStatus];
                $lockedTenant->forceFill($newReviewValues)->save();
                $newValues = $newReviewValues + ['publication_status' => $lockedTenant->getAttribute('publication_status')];
                $this->audit->record(
                    request: $request,
                    actor: $actor,
                    action: 'platform.store.verification_status.changed',
                    subject: $lockedTenant,
                    tenant: $lockedTenant,
                    oldValues: $oldValues,
                    newValues: $newValues,
                );

                if ($status === TenantVerificationStatus::Approved) {
                    $this->provisioning->queueAfterApproval($lockedTenant, $actor, $request);
                }

                return $lockedTenant->refresh();
            });
    }
}
