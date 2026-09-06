<?php

namespace App\Http\Controllers;

use App\Exceptions\OrderConflict;
use App\Http\Requests\CreateOrderRequest;
use App\Models\Tenant;
use App\Services\OrderService;
use Illuminate\Http\JsonResponse;

class StoreOrderController extends Controller
{
    public function store(CreateOrderRequest $request, OrderService $orders): JsonResponse
    {
        $tenant = tenant();
        if (! $tenant instanceof Tenant) {
            abort(404);
        }

        try {
            $response = response()->json(['data' => $orders->create($tenant, $request->validated())], 201);
        } catch (OrderConflict $exception) {
            $response = response()->json(['message' => $exception->getMessage(), 'code' => $exception->errorCode], $exception->httpStatus);
        }

        return $response->withHeaders([
            'Cache-Control' => 'private, no-store, max-age=0',
            'Pragma' => 'no-cache',
            'Referrer-Policy' => 'no-referrer',
        ]);
    }
}
