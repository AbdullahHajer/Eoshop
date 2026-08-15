<?php

namespace App\Enums;

enum ProvisioningStepStatus: string
{
    case Running = 'running';
    case Succeeded = 'succeeded';
    case Failed = 'failed';
    case Retained = 'retained';
}
