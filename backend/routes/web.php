<?php

use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\PlatformStoreController;
use App\Http\Controllers\Auth\AuthenticationController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\StoreGeneratorController;
use App\Http\Controllers\TenantController;
use App\Models\AdminAuditLog;
use App\Models\Tenant;
use Illuminate\Support\Facades\Route;

Route::prefix('api/auth')->group(function (): void {
    Route::get('/csrf', [AuthenticationController::class, 'csrf']);
    Route::get('/session', [AuthenticationController::class, 'current']);
    Route::post('/register', [AuthenticationController::class, 'register'])->middleware('throttle:auth.register');
    Route::post('/login', [AuthenticationController::class, 'login'])->middleware('throttle:auth.login');
    Route::post('/forgot-password', [PasswordResetController::class, 'requestLink'])->middleware('throttle:auth.password-link');
    Route::post('/reset-password', [PasswordResetController::class, 'reset'])->middleware('throttle:auth.password-reset');
    Route::post('/logout', [AuthenticationController::class, 'logout'])->middleware('auth');
});

Route::prefix('api/admin')->middleware('auth')->group(function (): void {
    Route::get('/stores', [PlatformStoreController::class, 'index'])
        ->can('viewAny', Tenant::class);
    Route::patch('/stores/{tenant}', [PlatformStoreController::class, 'update'])
        ->can('update', 'tenant')
        ->middleware('throttle:admin.mutations');
    Route::patch('/stores/{tenant}/status', [PlatformStoreController::class, 'updateStatus'])
        ->can('changeAnyStatus', 'tenant')
        ->middleware('throttle:admin.mutations');
    Route::get('/audit-logs', [AuditLogController::class, 'index'])
        ->can('viewAny', AdminAuditLog::class);
});

Route::prefix('api')->middleware('auth')->group(function (): void {
    Route::post('/generate-store-ideas', [StoreGeneratorController::class, 'generate'])
        ->middleware('throttle:ai.generate');
    Route::post('/register-store', [TenantController::class, 'registerStore'])
        ->middleware('throttle:store.register');
});

Route::get('/', function () {
    return response()->json([
        'platform' => 'Eoshop Multi-Tenant Commerce API',
        'status' => 'active',
        'framework' => 'Laravel 12',
    ]);
});
