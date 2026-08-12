<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'platform' => 'Eoshop Multi-Tenant Commerce API',
        'status' => 'active',
        'framework' => 'Laravel 12',
    ]);
});
