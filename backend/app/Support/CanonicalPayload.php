<?php

namespace App\Support;

class CanonicalPayload
{
    /** @param array<string, mixed> $payload */
    public static function fingerprint(array $payload): string
    {
        return hash('sha256', json_encode(self::normalize($payload), JSON_THROW_ON_ERROR));
    }

    private static function normalize(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        if (array_is_list($value)) {
            return array_map(self::normalize(...), $value);
        }

        ksort($value);

        return array_map(self::normalize(...), $value);
    }
}
