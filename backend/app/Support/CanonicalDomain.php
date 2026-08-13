<?php

namespace App\Support;

use InvalidArgumentException;

final class CanonicalDomain
{
    public static function normalize(string $domain): string
    {
        $normalized = strtolower(rtrim(trim($domain), '.'));

        if ($normalized === ''
            || strlen($normalized) > 253
            || str_contains($normalized, '://')
            || str_contains($normalized, '/')
            || str_contains($normalized, ':')
            || filter_var($normalized, FILTER_VALIDATE_DOMAIN, FILTER_FLAG_HOSTNAME) === false
        ) {
            throw new InvalidArgumentException('The tenant domain must be a canonical ASCII hostname without a scheme, port, path, or trailing dot.');
        }

        return $normalized;
    }
}
