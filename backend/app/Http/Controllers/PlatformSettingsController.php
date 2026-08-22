<?php

namespace App\Http\Controllers;

use App\Http\Resources\PlatformSettingsResource;
use App\Services\PlatformSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformSettingsController extends Controller
{
    public function show(Request $request, PlatformSettingsService $settings): JsonResponse
    {
        return response()->json([
            'data' => (new PlatformSettingsResource($settings->current()))->resolve($request),
        ])->header('Cache-Control', 'no-store');
    }
}
