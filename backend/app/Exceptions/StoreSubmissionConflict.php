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
}
