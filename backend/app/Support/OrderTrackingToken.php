<?php

namespace App\Support;

use Illuminate\Support\Facades\Crypt;
use Throwable;

final class OrderTrackingToken
{
    public const VERSION = 1;

    private const PREFIX = 'eot1_';

    private const RANDOM_BYTES = 32;

    /** @return array{token: string, version: int, digest: string, ciphertext: string} */
    public static function issue(): array
    {
        $token = self::PREFIX.rtrim(strtr(base64_encode(random_bytes(self::RANDOM_BYTES)), '+/', '-_'), '=');

        return [
            'token' => $token,
            'version' => self::VERSION,
            'digest' => hash('sha256', $token),
            'ciphertext' => Crypt::encryptString($token),
        ];
    }

    public static function digest(string $token): ?string
    {
        return self::valid($token) ? hash('sha256', $token) : null;
    }

    public static function decrypt(string $ciphertext): ?string
    {
        try {
            $token = Crypt::decryptString($ciphertext);
        } catch (Throwable) {
            return null;
        }

        return self::valid($token) ? $token : null;
    }

    public static function relativeUrl(string $token): ?string
    {
        return self::valid($token) ? '/track#token='.$token : null;
    }

    public static function valid(string $token): bool
    {
        return preg_match('/^eot1_[A-Za-z0-9_-]{43}$/D', $token) === 1;
    }
}
