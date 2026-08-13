<?php

namespace App\Http\Middleware;

use App\Enums\TenantVerificationStatus;
use App\Models\Domain;
use App\Models\Tenant;
use App\Support\CanonicalDomain;
use Closure;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Response;

class EnsureKnownApplicationDomain
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            $host = CanonicalDomain::normalize($request->getHost());
        } catch (InvalidArgumentException) {
            abort(404);
        }

        if (in_array($host, config('tenancy.central_domains', []), true)) {
            return $next($request);
        }

        $domain = Domain::query()->with('tenant')->where('domain', $host)->first();
        $tenant = $domain?->tenant;

        if (! $tenant instanceof Tenant
            || $tenant->getAttribute('verification_status') !== TenantVerificationStatus::Approved->value
            || ! $tenant->database()->manager()->databaseExists((string) $tenant->database()->getName())
        ) {
            abort(404);
        }

        return $next($request);
    }
}
