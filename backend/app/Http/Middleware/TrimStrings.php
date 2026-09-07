<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\TrimStrings as Middleware;

class TrimStrings extends Middleware
{
    /**
     * The attributes that should not be trimmed.
     *
     * BasGate's opaque credentials are byte-sensitive: trimming them would turn
     * invalid input into a different credential before validation and storage.
     *
     * @var array<int, string>
     */
    protected $except = [
        'current_password',
        'password',
        'password_confirmation',
        'credentials.merchantKey',
        'credentials.clientSecret',
    ];
}
