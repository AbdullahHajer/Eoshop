<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\PlatformAdministrationReadService;
use Illuminate\Http\JsonResponse;

class PlatformOverviewController extends Controller
{
    public function show(PlatformAdministrationReadService $administration): JsonResponse
    {
        return response()->json(['data' => $administration->overview()]);
    }
}
