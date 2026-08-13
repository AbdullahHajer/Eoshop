<?php

namespace App\Http\Middleware;

use App\Enums\TenantVerificationStatus;
use App\Models\Tenant;
use App\Support\CanonicalDomain;
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
            $tenant = $this->resolver->resolve(CanonicalDomain::normalize($request->getHost()));
        } catch (InvalidArgumentException|TenantCouldNotBeIdentifiedException) {
            abort(404);
        }

        if (! $tenant instanceof Tenant
            || $tenant->getAttribute('verification_status') !== TenantVerificationStatus::Approved->value
            || ! $tenant->database()->manager()->databaseExists((string) $tenant->database()->getName())
        ) {
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
