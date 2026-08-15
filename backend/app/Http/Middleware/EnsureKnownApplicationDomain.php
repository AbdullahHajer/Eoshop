<?php

namespace App\Http\Middleware;

use App\Models\Domain;
use App\Models\Tenant;
use App\Support\CanonicalDomain;
use App\Support\TenantRuntimeReadiness;
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

        $domain = Domain::query()->with([
            'tenant.latestProvisioningRun',
            'tenant.currentPublicationRequest.reservation',
            'tenant.publishedDomain',
            'tenant.publicationSubscription',
        ])->where('domain', $host)->first();
        $tenant = $domain?->tenant;

        if (! $tenant instanceof Tenant || ! TenantRuntimeReadiness::check($tenant, $host)) {
            abort(404);
        }

        return $next($request);
    }
}
