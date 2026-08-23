<?php

namespace App\Services;

use App\Http\Middleware\EnsureActiveUserSession;
use App\Models\User;
use Illuminate\Auth\SessionGuard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthenticatedSessionBinder
{
    public function bind(Request $request, SessionGuard $guard, User $user): void
    {
        // Keep the in-memory guard aligned with the freshly committed credentials.
        // This matters for the remainder of the current request and for long-lived
        // test/worker processes that do not reconstruct the guard between calls.
        $guard->setUser($user);
        $request->session()->put(
            'password_hash_'.Auth::getDefaultDriver(),
            $guard->hashPasswordForCookie($user->getAuthPassword()),
        );
        $request->session()->put(
            EnsureActiveUserSession::SESSION_GENERATION_KEY,
            (int) $user->getAttribute('session_generation'),
        );
    }
}
