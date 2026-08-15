<?php

namespace App\Enums;

enum DomainKind: string
{
    case Internal = 'internal';
    case PublicSubdomain = 'public_subdomain';
}
