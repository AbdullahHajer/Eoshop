<?php

namespace App\Support;

use InvalidArgumentException;

final class PublicStoreHandle
{
    public static function normalize(string $handle): string
    {
        $normalized = strtolower(trim($handle));
        $reserved = config('domain_policy.reserved_handles', []);

        if (preg_match('/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/', $normalized) !== 1
            || str_starts_with($normalized, 'store-')
            || in_array($normalized, $reserved, true)
        ) {
            throw new InvalidArgumentException('The store handle must be 3–50 lowercase ASCII letters, numbers, or internal hyphens and must not be reserved.');
        }

        return $normalized;
    }

    public static function domain(string $handle): string
    {
        return CanonicalDomain::normalize(
            self::normalize($handle).'.'.CanonicalDomain::normalize((string) config('tenancy.tenant_base_domain'))
        );
    }
}
