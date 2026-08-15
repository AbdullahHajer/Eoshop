<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class PlatformController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'platform' => 'Eoshop Multi-Tenant Commerce API',
            'status' => 'active',
            'framework' => 'Laravel 12',
        ]);
    }

    public function health(): Response
    {
        return response(
            '<!doctype html><html><body>Eoshop is healthy.</body></html>',
            200,
            ['Content-Type' => 'text/html; charset=UTF-8'],
        );
    }
}
