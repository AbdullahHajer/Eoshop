<?php

namespace App\Exceptions;

use App\Models\User;
use RuntimeException;

class AccountProfileConflict extends RuntimeException
{
    public function __construct(public readonly User $current)
    {
        parent::__construct('The account profile changed on the server. Reload it before saving again.', 409);
    }
}
