<?php

namespace App\Enums;

enum ProvisioningState: string
{
    case NotStarted = 'not_started';
    case Queued = 'queued';
    case Provisioning = 'provisioning';
    case Retrying = 'retrying';
    case Active = 'active';
    case Failed = 'failed';

    public function isRuntimeReady(): bool
    {
        return $this === self::Active;
    }
}
