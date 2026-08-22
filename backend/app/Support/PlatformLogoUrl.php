<?php

namespace App\Support;

final class PlatformLogoUrl
{
    /** @var list<string> */
    private const RESERVED_PREFIXES = [
        '/api/store-assets/',
        '/api/catalog-media/',
        '/api/platform-assets/',
    ];

    public static function accepts(?string $value): bool
    {
        if ($value === null) {
            return true;
        }
        if ($value === '' || mb_strlen($value) > 2048 || preg_match('/[\\x00-\\x1F\\x7F\\\\]/u', $value) === 1) {
            return false;
        }
        if (filter_var($value, FILTER_VALIDATE_URL) === false
            || mb_strtolower((string) parse_url($value, PHP_URL_SCHEME)) !== 'https'
            || trim((string) parse_url($value, PHP_URL_HOST)) === ''
            || parse_url($value, PHP_URL_USER) !== null
            || parse_url($value, PHP_URL_PASS) !== null
            || parse_url($value, PHP_URL_FRAGMENT) !== null) {
            return false;
        }

        $path = self::canonicalPath((string) parse_url($value, PHP_URL_PATH));

        return $path !== null && collect(self::RESERVED_PREFIXES)->doesntContain(
            static fn (string $prefix): bool => str_starts_with($path, $prefix),
        );
    }

    private static function canonicalPath(string $path): ?string
    {
        for ($attempt = 0; $attempt < 8; $attempt++) {
            if (! mb_check_encoding($path, 'UTF-8') || preg_match('/%(?![0-9A-Fa-f]{2})/', $path) === 1) {
                return null;
            }
            $decoded = rawurldecode($path);
            if (! mb_check_encoding($decoded, 'UTF-8')) {
                return null;
            }
            if ($decoded === $path) {
                break;
            }
            $path = $decoded;
        }
        if (! mb_check_encoding($path, 'UTF-8')
            || preg_match('/%(?![0-9A-Fa-f]{2})/', $path) === 1
            || rawurldecode($path) !== $path) {
            return null;
        }

        $segments = [];
        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..') {
                array_pop($segments);

                continue;
            }
            $segments[] = $segment;
        }

        return '/'.implode('/', $segments).(str_ends_with($path, '/') ? '/' : '');
    }
}
