<?php

namespace App\Support;

final class StoreContactTarget
{
    public static function normalize(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);
        if ($value === '' || ! str_starts_with($value, '+') || preg_match('/^\+[0-9() \-]+$/', $value) !== 1) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $value);
        if (! is_string($digits) || strlen($digits) < 7 || strlen($digits) > 15) {
            return null;
        }

        return '+'.$digits;
    }

    /** @param array<string, mixed> $config */
    public static function preferred(array $config): ?string
    {
        return self::normalize($config['whatsapp'] ?? null)
            ?? self::normalize($config['phone'] ?? null);
    }
}
