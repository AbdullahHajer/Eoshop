<?php

namespace App\Exceptions;

use RuntimeException;

class StoreWorkspaceValidation extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode = 'workspace_validation_failed',
    ) {
        parent::__construct($message);
    }
}
