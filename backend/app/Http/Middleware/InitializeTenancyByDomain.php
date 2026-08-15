<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Support\CanonicalDomain;
use App\Support\TenantRuntimeReadiness;
use Closure;
use InvalidArgumentException;
use Stancl\Tenancy\Contracts\TenantCouldNotBeIdentifiedException;
use Stancl\Tenancy\Resolvers\DomainTenantResolver;
use Stancl\Tenancy\Tenancy;

class InitializeTenancyByDomain
{
    public function __construct(
        private readonly Tenancy $tenancy,
        private readonly DomainTenantResolver $resolver,
    ) {}

    public function handle($request, Closure $next): mixed
    {
        try {
            $host = CanonicalDomain::normalize($request->getHost());
            $tenant = $this->resolver->resolve($host);
        } catch (InvalidArgumentException|TenantCouldNotBeIdentifiedException) {
            abort(404);
        }

        if (! $tenant instanceof Tenant || ! TenantRuntimeReadiness::check($tenant, $host)) {
            abort(404);
        }

        try {
            $this->tenancy->initialize($tenant);

            return $next($request);
        } finally {
            if ($this->tenancy->initialized) {
                $this->tenancy->end();
            }
        }
    }
}
