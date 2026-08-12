<?php

use App\Http\Controllers\Auth\AuthenticationController;
use App\Http\Controllers\Auth\PasswordResetController;
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

Route::get('/', function () {
    return response()->json([
        'platform' => 'Eoshop Multi-Tenant Commerce API',
        'status' => 'active',
        'framework' => 'Laravel 12',
    ]);
});
