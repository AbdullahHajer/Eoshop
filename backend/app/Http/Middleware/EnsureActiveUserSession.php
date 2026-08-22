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
    public const SESSION_GENERATION_KEY = 'identity_session_generation';

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

        $hasInvalidGeneration = false;
        if ($user instanceof User && ! $isInvalidUser && $hasAuthenticatedSession) {
            $currentGeneration = $user->getAttribute('session_generation');
            $boundGeneration = $request->session()->get(self::SESSION_GENERATION_KEY);

            if ($boundGeneration === null && $guard->viaRemember() && is_int($currentGeneration)) {
                $request->session()->put(self::SESSION_GENERATION_KEY, $currentGeneration);
                $boundGeneration = $currentGeneration;
            }

            $hasInvalidGeneration = ! is_int($currentGeneration)
                || ! is_int($boundGeneration)
                || $currentGeneration < 1
                || $boundGeneration !== $currentGeneration;
        }

        if ($isInvalidUser || $hasInvalidGeneration || ($hasAuthenticatedSession && ! $user instanceof User)) {
            $guard->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw new AuthenticationException('Unauthenticated.', ['web']);
        }

        return $next($request);
    }
}
