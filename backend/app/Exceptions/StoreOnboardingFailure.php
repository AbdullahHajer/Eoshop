<?php

namespace App\Exceptions;

use RuntimeException;

class StoreOnboardingFailure extends RuntimeException
{
    public function __construct(string $message, public readonly string $errorCode, int $status = 422)
    {
        parent::__construct($message, $status);
    }

    public static function prerequisite(): self
    {
        return new self('Complete the preceding onboarding step first.', 'onboarding_prerequisite_missing');
    }

    public static function domainUnavailable(): self
    {
        return new self('The requested store address is no longer available.', 'domain_unavailable', 409);
    }
}
