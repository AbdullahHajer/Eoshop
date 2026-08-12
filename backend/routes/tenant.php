<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use App\Http\Controllers\StoreFrontController;

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
    Route::post('/api/store/config', [StoreFrontController::class, 'updateStoreConfig']);
    Route::post('/api/store/orders', [StoreFrontController::class, 'createOrder']);
});
