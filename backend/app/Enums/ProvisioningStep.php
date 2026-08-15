<?php

namespace App\Enums;

enum ProvisioningStep: string
{
    case Schema = 'schema';
    case Migrations = 'migrations';
    case InitialConfig = 'initial_config';
    case Activation = 'activation';
    case FailurePolicy = 'failure_policy';
}
