<?php

namespace App\Services;

use App\Enums\ProvisioningState;
use App\Enums\TenantVerificationStatus;
use App\Exceptions\ProvisioningFailure;
use App\Jobs\ProvisionTenant;
use App\Models\ProvisioningRun;
use App\Models\StoreSubmission;
use App\Models\Tenant;
use App\Models\User;
use App\Support\TenantSchemaName;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProvisioningCoordinator
{
    public function __construct(private readonly AdminAuditService $audit) {}

    public function queueAfterApproval(Tenant $tenant, User $actor, Request $request): ?ProvisioningRun
    {
        $submission = StoreSubmission::query()->where('tenant_id', $tenant->getKey())->first();
        if ($submission === null || $tenant->getAttribute('provisioning_status') !== ProvisioningState::NotStarted->value) {
            return null;
        }

        $this->assertAtomicDatabaseQueue();

        return $this->createRunAndDispatch($tenant, ProvisioningState::Queued, $actor, $request);
    }

    public function retry(Tenant $tenant, User $actor, Request $request): ProvisioningRun
    {
        $this->assertAtomicDatabaseQueue();
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        return $central->transaction(function () use ($tenant, $actor, $request): ProvisioningRun {
            $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();

            if ($lockedTenant->getAttribute('verification_status') !== TenantVerificationStatus::Approved->value
                || $lockedTenant->getAttribute('provisioning_status') !== ProvisioningState::Failed->value
            ) {
                throw new DomainException('Only a failed, approved tenant provisioning can be retried.');
            }

            $run = $this->createRunAndDispatch($lockedTenant, ProvisioningState::Retrying, $actor, $request);
            $this->audit->record(
                request: $request,
                actor: $actor,
                action: 'tenant.provisioning.retry_queued',
                subject: $run,
                tenant: $lockedTenant,
                oldValues: ['provisioning_status' => ProvisioningState::Failed->value],
                newValues: ['provisioning_status' => ProvisioningState::Retrying->value, 'run_id' => $run->getKey()],
            );

            return $run;
        });
    }

    private function createRunAndDispatch(
        Tenant $tenant,
        ProvisioningState $state,
        User $actor,
        Request $request,
    ): ProvisioningRun {
        $nextRun = ((int) ProvisioningRun::query()->where('tenant_id', $tenant->getKey())->max('run_number')) + 1;
        $run = ProvisioningRun::query()->create([
            'tenant_id' => $tenant->getKey(),
            'status' => $state,
            'run_number' => $nextRun,
            'requested_by_user_id' => $actor->getKey(),
            'request_id' => $this->audit->requestId($request),
            'schema_name' => TenantSchemaName::for((string) $tenant->getKey()),
            'queued_at' => now(),
        ]);

        $tenant->forceFill([
            'provisioning_status' => $state->value,
            'active_at' => null,
        ])->save();

        ProvisionTenant::dispatch($run->getKey());

        return $run;
    }

    private function assertAtomicDatabaseQueue(): void
    {
        $central = (string) config('tenancy.database.central_connection');
        $queueConnection = (string) config('queue.connections.database.connection');

        if (config('queue.default') !== 'database'
            || $queueConnection !== $central
            || config('queue.connections.database.after_commit') !== false
        ) {
            throw new ProvisioningFailure(
                'unsafe_queue_configuration',
                'Provisioning requires the central transactional database queue.',
            );
        }
    }
}
