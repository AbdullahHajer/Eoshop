<?php

namespace App\Providers;

use App\Http\Middleware\EnsureCentralDomain;
use App\Http\Middleware\EnsureKnownApplicationDomain;
use App\Http\Middleware\InitializeTenancyByDomain;
use App\Support\CanonicalDomain;
use App\Support\TenantSchemaName;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Stancl\Tenancy\DatabaseConfig;
use Stancl\Tenancy\Events;
use Stancl\Tenancy\Listeners;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;

class TenancyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        DatabaseConfig::generateDatabaseNamesUsing(
            static fn ($tenant): string => TenantSchemaName::for((string) $tenant->getTenantKey()),
        );
    }

    public function boot(): void
    {
        Event::listen(Events\TenancyInitialized::class, Listeners\BootstrapTenancy::class);
        Event::listen(Events\TenancyEnded::class, Listeners\RevertToCentralContext::class);

        $this->app->booted(function (): void {
            if (! $this->app->routesAreCached()) {
                Route::group([], base_path('routes/tenant.php'));
            }
        });

        foreach (array_reverse([
            PreventAccessFromCentralDomains::class,
            EnsureCentralDomain::class,
            EnsureKnownApplicationDomain::class,
            InitializeTenancyByDomain::class,
        ]) as $middleware) {
            $this->app[Kernel::class]
                ->prependToMiddlewarePriority($middleware);
        }

        config()->set('tenancy.central_domains', array_values(array_unique(array_map(
            static fn (string $domain): string => CanonicalDomain::normalize($domain),
            config('tenancy.central_domains', []),
        ))));
    }
}
