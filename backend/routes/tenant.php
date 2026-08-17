<?php

declare(strict_types=1);

use App\Http\Controllers\StoreFrontController;
use App\Http\Controllers\StoreOrderController;
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
    Route::post('/api/store/orders', [StoreOrderController::class, 'store'])
        ->middleware('throttle:store.orders');
});
