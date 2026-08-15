<?php

namespace App\Exceptions;

use RuntimeException;

class StoreWorkspaceConflict extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode = 'workspace_conflict',
    ) {
        parent::__construct($message);
    }
}
