<?php

namespace App\Http\Controllers\Payments;

use App\Exceptions\PaymentConnectionConflict;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payments\ConfigureBasGateConnectionRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Payments\MerchantPaymentConnectionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantPaymentConnectionController extends Controller
{
    public function show(
        Request $request,
        Tenant $tenant,
        MerchantPaymentConnectionService $connections,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        return $this->response(['data' => $connections->read($tenant, $actor)]);
    }

    public function update(
        ConfigureBasGateConnectionRequest $request,
        Tenant $tenant,
        MerchantPaymentConnectionService $connections,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();
        try {
            $result = $connections->configure($tenant, $actor, $request->validated(), $request);

            return $this->response([
                'data' => $result['resource'],
                'meta' => ['replayed' => $result['replayed']],
            ]);
        } catch (PaymentConnectionConflict $exception) {
            return $this->response([
                'message' => $exception->getMessage(),
                'code' => $exception->errorCode,
            ], $exception->httpStatus);
        }
    }

    /** @param array<string, mixed> $payload */
    private function response(array $payload, int $status = 200): JsonResponse
    {
        return response()->json($payload, $status)
            ->header('Cache-Control', 'no-store, private')
            ->header('Pragma', 'no-cache');
    }
}
