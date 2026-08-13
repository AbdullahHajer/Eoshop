<?php

declare(strict_types=1);

use App\Http\Controllers\StoreFrontController;
use App\Http\Middleware\InitializeTenancyByDomain;
use Illuminate\Support\Facades\Route;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;

/*
|--------------------------------------------------------------------------
| Tenant Routes (Resolved Per Tenant Subdomain / Custom Domain)
|--------------------------------------------------------------------------
*/

Route::middleware([
    'web',
    InitializeTenancyByDomain::class,
    PreventAccessFromCentralDomains::class,
])->group(function () {
    Route::get('/api/store/config', [StoreFrontController::class, 'getStoreConfig']);
    Route::post('/api/store/config', [StoreFrontController::class, 'updateStoreConfig'])
        ->middleware(['auth', 'tenant.permission:tenant.store.manage']);
});
