<?php

namespace App\Http\Controllers;

use App\Exceptions\MerchantDashboardUnavailable;
use App\Models\Tenant;
use App\Models\User;
use App\Services\MerchantDashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantDashboardController extends Controller
{
    public function show(Request $request, Tenant $tenant, MerchantDashboardService $dashboards): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor instanceof User, 401);

        try {
            return response()->json(['data' => $dashboards->snapshot($tenant, $actor)]);
        } catch (MerchantDashboardUnavailable $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => $exception->errorCode,
            ], 409);
        }
    }
}
