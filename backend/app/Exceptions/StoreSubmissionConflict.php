<?php

namespace App\Exceptions;

use RuntimeException;

class StoreSubmissionConflict extends RuntimeException
{
    public static function idempotencyKeyReused(): self
    {
        return new self('The idempotency key was already used with a different store submission.', 409);
    }

    public static function domainUnavailable(): self
    {
        return new self('The requested store address is no longer available.', 409);
    }

    public static function domainReservationUnavailable(): self
    {
        return new self('The store address reservation is no longer active.', 409);
    }

    public static function tenantAlreadyHasDomainReservation(): self
    {
        return new self('The store already has an active address reservation.', 409);
    }

    public static function storeQuotaExceeded(): self
    {
        return new self('The current active package does not allow another store.', 409);
    }
}
