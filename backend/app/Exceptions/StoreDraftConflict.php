<?php

namespace App\Exceptions;

use RuntimeException;

class StoreDraftConflict extends RuntimeException
{
    public function __construct(string $message, public readonly string $errorCode)
    {
        parent::__construct($message, 409);
    }

    public static function revision(): self
    {
        return new self('The store draft changed on the server. Reload it before saving again.', 'draft_revision_conflict');
    }

    public static function state(): self
    {
        return new self('The store draft is not editable in its current lifecycle state.', 'draft_state_conflict');
    }

    public static function resubmissionKeyReused(): self
    {
        return new self('The idempotency key was already used for another resubmission.', 'resubmission_idempotency_conflict');
    }
}
