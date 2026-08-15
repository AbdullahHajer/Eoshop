<?php

namespace App\Jobs;

use App\Services\TenantProvisioner;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class ProvisionTenant implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 120;

    public bool $failOnTimeout = true;

    public function __construct(public readonly string $runId)
    {
        $this->onConnection('database');
        $this->onQueue('provisioning');
    }

    /** @return list<int> */
    public function backoff(): array
    {
        return [5, 30];
    }

    public function handle(TenantProvisioner $provisioner): void
    {
        $provisioner->provision(
            runId: $this->runId,
            deliveryAttempt: max(1, $this->attempts()),
            maxDeliveries: $this->tries,
        );
    }

    public function failed(?Throwable $exception): void
    {
        app(TenantProvisioner::class)->markPermanentlyFailed($this->runId, $exception);
    }
}
