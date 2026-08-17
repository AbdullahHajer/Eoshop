<?php

namespace App\Exceptions;

use RuntimeException;

class OrderConflict extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode,
        public readonly int $httpStatus = 409,
    ) {
        parent::__construct($message);
    }
}
