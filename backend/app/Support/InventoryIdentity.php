<?php

namespace App\Support;

use Ramsey\Uuid\Uuid;

final class InventoryIdentity
{
    public static function opening(string $schema, string $productId): string
    {
        return Uuid::uuid5(Uuid::NAMESPACE_URL, "eoshop:inventory:opening:{$schema}:{$productId}")->toString();
    }

    public static function expiration(string $reservationId): string
    {
        return Uuid::uuid5(Uuid::NAMESPACE_URL, "eoshop:inventory:expire:{$reservationId}")->toString();
    }
}
