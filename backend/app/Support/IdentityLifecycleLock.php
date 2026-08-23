<?php

namespace App\Support;

use Illuminate\Database\ConnectionInterface;

final class IdentityLifecycleLock
{
    public const KEY = 51120260821;

    public static function acquire(ConnectionInterface $central): void
    {
        $central->select('SELECT pg_advisory_xact_lock(?)', [self::KEY]);
    }
}
