<?php

namespace App\Http\Middleware;

use App\Enums\PermissionKey;
use App\Models\Tenant;
use Closure;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantPermission
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $tenant = tenant();
        $user = $request->user();
        $permissionKey = PermissionKey::tryFrom($permission);

        if (! $tenant instanceof Tenant || $user === null || $permissionKey === null || ! $user->hasTenantPermission($tenant, $permissionKey)) {
            throw new AuthorizationException;
        }

        return $next($request);
    }
}
