<?php

namespace App\Http\Middleware;

use App\Enums\UserStatus;
use App\Models\User;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\SessionGuard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveUserSession
{
    /**
     * Reject stale authenticated sessions centrally before a protected action runs.
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var SessionGuard $guard */
        $guard = Auth::guard('web');
        $user = $guard->user();
        $hasAuthenticatedSession = $request->hasSession()
            && $request->session()->has($guard->getName());

        $isInvalidUser = $user instanceof User
            && ($user->getAttribute('status') !== UserStatus::Active || $user->trashed());

        if ($isInvalidUser || ($hasAuthenticatedSession && ! $user instanceof User)) {
            $guard->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw new AuthenticationException('Unauthenticated.', ['web']);
        }

        return $next($request);
    }
}
