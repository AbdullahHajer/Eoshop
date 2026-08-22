<?php

namespace App\Exceptions;

use RuntimeException;

class PlatformSettingsConflict extends RuntimeException
{
    public function __construct(
        string $message = 'The platform settings changed since they were loaded.',
        public readonly string $errorCode = 'platform_settings_revision_conflict',
    ) {
        parent::__construct($message);
    }
}
