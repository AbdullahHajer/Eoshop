<?php

namespace App\Http\Controllers;

use App\Exceptions\OrderConflict;
use App\Models\Tenant;
use App\Services\OrderTrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class StoreOrderTrackingController extends Controller
{
    public function show(Request $request, OrderTrackingService $tracking): JsonResponse
    {
        $tenant = tenant();
        if (! $tenant instanceof Tenant) {
            abort(404);
        }

        try {
            $response = response()->json(['data' => $tracking->read($tenant, (string) ($request->bearerToken() ?? ''))]);
        } catch (OrderConflict $exception) {
            $response = response()->json([
                'message' => $exception->getMessage(),
                'code' => $exception->errorCode,
            ], $exception->httpStatus);
        }

        return $response->withHeaders([
            'Cache-Control' => 'private, no-store, max-age=0',
            'Pragma' => 'no-cache',
            'Vary' => 'Authorization',
            'Referrer-Policy' => 'no-referrer',
            'X-Content-Type-Options' => 'nosniff',
            'X-Robots-Tag' => 'noindex, nofollow, noarchive',
        ]);
    }
}
