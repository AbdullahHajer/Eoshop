<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'platform' => 'Mobtaker Multi-Tenant SaaS Engine',
        'status' => 'active',
        'framework' => 'Laravel 11 (PHP 8.4)'
    ]);
});
