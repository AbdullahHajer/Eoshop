<?php

use App\Http\Controllers\StoreGeneratorController;
use App\Http\Controllers\TenantController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Central API Routes (Platform Admin & Public Onboarding)
|--------------------------------------------------------------------------
*/

// AI Store Ideas Generator Endpoint
Route::post('/generate-store-ideas', [StoreGeneratorController::class, 'generate']);

// Tenant Registration Endpoint
Route::post('/register-store', [TenantController::class, 'registerStore']);

// Super Admin Platform Endpoints
Route::get('/admin/stores', [TenantController::class, 'listStores']);
Route::patch('/admin/stores/{storeId}/status', [TenantController::class, 'updateStatus']);
