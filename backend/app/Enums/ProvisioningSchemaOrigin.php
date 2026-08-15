<?php

namespace App\Enums;

enum ProvisioningSchemaOrigin: string
{
    case PlatformCreated = 'platform_created';
    case Wp21Adopted = 'wp21_adopted';
}
