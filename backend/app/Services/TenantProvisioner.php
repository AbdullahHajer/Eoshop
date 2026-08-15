<?php

namespace App\Services;

use App\Enums\ProvisioningSchemaOrigin;
use App\Enums\ProvisioningState;
use App\Enums\ProvisioningStep;
use App\Enums\ProvisioningStepStatus;
use App\Enums\TenantVerificationStatus;
use App\Exceptions\ProvisioningFailure;
use App\Models\ProvisioningRun;
use App\Models\ProvisioningStepRecord;
use App\Models\StoreSubmission;
use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class TenantProvisioner
{
    public function __construct(private readonly TenantProvisioningExecutor $executor) {}

    public function provision(string $runId, int $deliveryAttempt, int $maxDeliveries): void
    {
        $centralName = (string) config('tenancy.database.central_connection');
        $central = DB::connection($centralName);
        $runSnapshot = ProvisioningRun::query()->findOrFail($runId);
        $lockKey = 'tenant-provisioning:'.$runSnapshot->getAttribute('tenant_id');
        $locked = (bool) ($central->selectOne(
            'SELECT pg_try_advisory_lock(hashtextextended(?, 0)) AS acquired',
            [$lockKey],
        )->acquired ?? false);

        if (! $locked) {
            throw new ProvisioningFailure('provisioning_lock_busy', 'Tenant provisioning is already running.');
        }

        try {
            $claimed = $this->claim($runId);
            if ($claimed === null) {
                return;
            }
            [$run, $tenant, $submission] = $claimed;

            $this->runStep($run, $deliveryAttempt, ProvisioningStep::Schema, fn (): null => $this->ensureOwnedSchema($run, $tenant));
            $this->runStep($run, $deliveryAttempt, ProvisioningStep::Migrations, function () use ($tenant): void {
                $this->executor->migrate($tenant);
            });
            $this->runStep($run, $deliveryAttempt, ProvisioningStep::InitialConfig, function () use ($tenant, $submission): void {
                $this->executor->initializeConfig($tenant, $submission);
            });
            $this->runStep($run, $deliveryAttempt, ProvisioningStep::Activation, function () use ($run, $tenant, $submission): null {
                $this->executor->assertReady($tenant, $submission);
                $this->activate($run, $tenant);

                return null;
            });
        } catch (Throwable $exception) {
            $this->recordFailure($runId, $deliveryAttempt, $maxDeliveries, $exception);
            throw $exception;
        } finally {
            try {
                try {
                    if (tenancy()->initialized) {
                        tenancy()->end();
                    }
                } finally {
                    DB::setDefaultConnection($centralName);
                    DB::purge('tenant');
                }
            } finally {
                $central->selectOne('SELECT pg_advisory_unlock(hashtextextended(?, 0)) AS released', [$lockKey]);
            }
        }
    }

    public function markPermanentlyFailed(string $runId, ?Throwable $exception): void
    {
        $failure = $exception ?? new ProvisioningFailure('queue_failed', 'Provisioning exhausted its retries.');
        if ($failure instanceof ProvisioningFailure && $failure->errorCode === 'provisioning_lock_busy') {
            return;
        }

        $this->recordFailure($runId, 0, 0, $failure);
    }

    /** @return array{ProvisioningRun, Tenant, StoreSubmission}|null */
    private function claim(string $runId): ?array
    {
        return DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($runId): ?array {
                $run = ProvisioningRun::query()->whereKey($runId)->lockForUpdate()->firstOrFail();
                $tenant = Tenant::query()->whereKey($run->getAttribute('tenant_id'))->lockForUpdate()->firstOrFail();

                if (in_array($run->getAttribute('status'), [ProvisioningState::Active, ProvisioningState::Failed], true)) {
                    return null;
                }
                $latestRunId = ProvisioningRun::query()
                    ->where('tenant_id', $tenant->getKey())
                    ->orderByDesc('run_number')
                    ->value('id');
                if ($latestRunId !== $run->getKey()) {
                    return null;
                }
                if (! in_array($run->getAttribute('status'), [
                    ProvisioningState::Queued,
                    ProvisioningState::Retrying,
                    ProvisioningState::Provisioning,
                ], true)) {
                    throw new ProvisioningFailure('invalid_run_state', 'The provisioning run is not executable.');
                }
                if ($tenant->getAttribute('verification_status') !== TenantVerificationStatus::Approved->value) {
                    throw new ProvisioningFailure('tenant_not_approved', 'The tenant is not approved for provisioning.');
                }

                $submission = StoreSubmission::query()->where('tenant_id', $tenant->getKey())->firstOrFail();
                $run->forceFill([
                    'status' => ProvisioningState::Provisioning,
                    'started_at' => $run->getAttribute('started_at') ?? now(),
                    'failed_at' => null,
                    'last_error_code' => null,
                    'last_error_message' => null,
                ])->save();
                $tenant->forceFill(['provisioning_status' => ProvisioningState::Provisioning->value])->save();

                return [$run, $tenant, $submission];
            });
    }

    private function ensureOwnedSchema(ProvisioningRun $run, Tenant $tenant): null
    {
        DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($run, $tenant): void {
                $lockedRun = ProvisioningRun::query()->whereKey($run->getKey())->lockForUpdate()->firstOrFail();
                $schema = (string) $lockedRun->getAttribute('schema_name');
                $exists = $tenant->database()->manager()->databaseExists($schema);
                $provenance = ProvisioningRun::query()
                    ->where('tenant_id', $tenant->getKey())
                    ->where('schema_name', $schema)
                    ->whereNotNull('schema_origin')
                    ->whereNotNull('schema_created_at')
                    ->orderBy('run_number')
                    ->first(['schema_origin', 'schema_created_at']);

                if ($exists && $provenance === null) {
                    throw new ProvisioningFailure('schema_not_owned', 'The target tenant schema already exists without platform provenance.');
                }

                if (! $exists) {
                    $tenant->database()->manager()->createDatabase($tenant);
                    $lockedRun->forceFill([
                        'schema_origin' => ProvisioningSchemaOrigin::PlatformCreated,
                        'schema_created_at' => now(),
                    ])->save();
                } elseif ($lockedRun->getAttribute('schema_created_at') === null) {
                    $lockedRun->forceFill([
                        'schema_origin' => $provenance->getAttribute('schema_origin'),
                        'schema_created_at' => $provenance->getAttribute('schema_created_at'),
                    ])->save();
                }
            });

        return null;
    }

    private function activate(ProvisioningRun $run, Tenant $tenant): void
    {
        DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($run, $tenant): void {
                $lockedRun = ProvisioningRun::query()->whereKey($run->getKey())->lockForUpdate()->firstOrFail();
                $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();

                if ($lockedTenant->getAttribute('verification_status') !== TenantVerificationStatus::Approved->value) {
                    throw new ProvisioningFailure('tenant_not_approved', 'The tenant is no longer approved for activation.');
                }

                $lockedRun->forceFill([
                    'status' => ProvisioningState::Active,
                    'current_step' => null,
                    'last_completed_step' => ProvisioningStep::Activation->value,
                    'completed_at' => now(),
                ])->save();
                $lockedTenant->forceFill([
                    'provisioning_status' => ProvisioningState::Active->value,
                    'active_at' => now(),
                ])->save();
            });
    }

    private function runStep(ProvisioningRun $run, int $deliveryAttempt, ProvisioningStep $step, callable $operation): void
    {
        $record = ProvisioningStepRecord::query()->updateOrCreate(
            ['run_id' => $run->getKey(), 'delivery_attempt' => $deliveryAttempt, 'step' => $step],
            ['status' => ProvisioningStepStatus::Running, 'started_at' => now(), 'finished_at' => null, 'error_code' => null, 'error_message' => null],
        );
        $run->forceFill(['current_step' => $step->value])->save();

        try {
            $operation();
        } catch (Throwable $exception) {
            $failure = $this->safeFailure($step, $exception);
            $record->forceFill([
                'status' => ProvisioningStepStatus::Failed,
                'error_code' => $failure->errorCode,
                'error_message' => $failure->safeMessage,
                'finished_at' => now(),
            ])->save();
            throw $failure;
        }

        $record->forceFill(['status' => ProvisioningStepStatus::Succeeded, 'finished_at' => now()])->save();
        $run->forceFill(['last_completed_step' => $step->value])->save();
    }

    private function recordFailure(string $runId, int $deliveryAttempt, int $maxDeliveries, Throwable $exception): void
    {
        $failure = $exception instanceof ProvisioningFailure
            ? $exception
            : new ProvisioningFailure('provisioning_failed', 'Tenant provisioning failed and is safe to retry.', $exception);

        DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($runId, $deliveryAttempt, $maxDeliveries, $failure, $exception): void {
                $run = ProvisioningRun::query()->whereKey($runId)->lockForUpdate()->first();
                if ($run === null || in_array($run->getAttribute('status'), [ProvisioningState::Active, ProvisioningState::Failed], true)) {
                    return;
                }
                $latestRunId = ProvisioningRun::query()
                    ->where('tenant_id', $run->getAttribute('tenant_id'))
                    ->orderByDesc('run_number')
                    ->value('id');
                if ($latestRunId !== $run->getKey()) {
                    return;
                }

                Log::error('Tenant provisioning failed.', [
                    'run_id' => $runId,
                    'error_code' => $failure->errorCode,
                    'exception' => $exception,
                ]);

                $state = $deliveryAttempt > 0 && $deliveryAttempt < $maxDeliveries
                    ? ProvisioningState::Retrying
                    : ProvisioningState::Failed;
                $run->forceFill([
                    'status' => $state,
                    'last_error_code' => $failure->errorCode,
                    'last_error_message' => $failure->safeMessage,
                    'failed_at' => now(),
                ])->save();
                Tenant::query()->whereKey($run->getAttribute('tenant_id'))->update([
                    'provisioning_status' => $state->value,
                    'active_at' => null,
                ]);

                $tenant = Tenant::query()->find($run->getAttribute('tenant_id'));
                $schemaExists = $tenant?->database()->manager()
                    ->databaseExists((string) $run->getAttribute('schema_name')) ?? false;
                $platformOwned = $schemaExists && ProvisioningRun::query()
                    ->where('tenant_id', $run->getAttribute('tenant_id'))
                    ->where('schema_name', $run->getAttribute('schema_name'))
                    ->whereNotNull('schema_origin')
                    ->whereNotNull('schema_created_at')
                    ->exists();
                ProvisioningStepRecord::query()->updateOrCreate(
                    [
                        'run_id' => $run->getKey(),
                        'delivery_attempt' => max(1, $deliveryAttempt),
                        'step' => ProvisioningStep::FailurePolicy,
                    ],
                    [
                        'status' => $platformOwned ? ProvisioningStepStatus::Retained : ProvisioningStepStatus::Succeeded,
                        'error_code' => $platformOwned ? 'schema_retained_for_retry' : null,
                        'error_message' => $platformOwned ? 'The platform-owned schema was retained for a safe retry.' : null,
                        'started_at' => now(),
                        'finished_at' => now(),
                    ],
                );
            });
    }

    private function safeFailure(ProvisioningStep $step, Throwable $exception): ProvisioningFailure
    {
        return $exception instanceof ProvisioningFailure
            ? $exception
            : new ProvisioningFailure($step->value.'_failed', "Provisioning step [{$step->value}] failed.", $exception);
    }
}
