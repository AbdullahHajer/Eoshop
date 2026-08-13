<?php

namespace App\Http\Middleware;

use App\Support\CanonicalDomain;
use Closure;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Response;

class EnsureCentralDomain
{
    public function handle(Request $request, Closure $next): Response
    {
        $centralDomains = config('tenancy.central_domains', []);

        try {
            $host = CanonicalDomain::normalize($request->getHost());
        } catch (InvalidArgumentException) {
            abort(404);
        }

        abort_unless(in_array($host, $centralDomains, true), 404);

        return $next($request);
    }
}
