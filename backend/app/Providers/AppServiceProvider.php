<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Application bindings are registered here.
    }

    public function boot(): void
    {
        RateLimiter::for('auth.login', function (Request $request): array {
            $email = Str::lower(trim((string) $request->input('email')));

            return [
                Limit::perMinute(60)->by('login-ip:'.$request->ip()),
                Limit::perMinute(5)->by('login:'.$email.'|'.$request->ip()),
            ];
        });

        RateLimiter::for('auth.register', fn (Request $request): Limit => Limit::perHour(5)
            ->by('register:'.$request->ip()));

        RateLimiter::for('auth.password-link', function (Request $request): array {
            $email = Str::lower(trim((string) $request->input('email')));

            return [
                Limit::perMinute(20)->by('password-link-ip:'.$request->ip()),
                Limit::perMinute(3)->by('password-link:'.$email.'|'.$request->ip()),
            ];
        });

        RateLimiter::for('auth.password-reset', fn (Request $request): Limit => Limit::perMinute(5)
            ->by('password-reset:'.$request->ip()));

        RateLimiter::for('admin.mutations', fn (Request $request): Limit => Limit::perMinute(30)
            ->by('admin-mutation:'.$request->user()?->getAuthIdentifier().'|'.$request->ip()));

        RateLimiter::for('merchant.mutations', fn (Request $request): Limit => Limit::perMinute(30)
            ->by('merchant-mutation:'.$request->user()?->getAuthIdentifier().'|'.$request->ip()));

        RateLimiter::for('ai.generate', fn (Request $request): Limit => Limit::perMinute(10)
            ->by('ai-generate:'.$request->user()?->getAuthIdentifier().'|'.$request->ip()));

        RateLimiter::for('store.register', fn (Request $request): Limit => Limit::perHour(5)
            ->by('store-register:'.$request->user()?->getAuthIdentifier().'|'.$request->ip()));

        RateLimiter::for('store.orders', fn (Request $request): Limit => Limit::perMinute(10)
            ->by('store-orders:'.mb_strtolower($request->getHost()).'|'.$request->ip()));

        RateLimiter::for('domain.availability', fn (Request $request): Limit => Limit::perMinute(30)
            ->by('domain-availability:'.$request->user()?->getAuthIdentifier().'|'.$request->ip()));

        ResetPassword::createUrlUsing(function (User $user, string $token): string {
            $baseUrl = rtrim((string) config('app.frontend_url'), '/');

            return $baseUrl.'/reset-password?token='.rawurlencode($token)
                .'&email='.rawurlencode($user->getEmailForPasswordReset());
        });
    }
}
