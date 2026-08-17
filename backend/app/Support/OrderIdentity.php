<?php

namespace App\Support;

use Ramsey\Uuid\Uuid;

final class OrderIdentity
{
    public static function expiration(string $orderId): string
    {
        return Uuid::uuid5(Uuid::NAMESPACE_URL, "eoshop:order:expire:{$orderId}")->toString();
    }
}
