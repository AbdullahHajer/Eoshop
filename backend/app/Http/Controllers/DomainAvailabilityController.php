<?php

namespace App\Http\Controllers;

use App\Http\Requests\DomainAvailabilityRequest;
use App\Services\DomainReservationService;
use App\Support\PublicStoreHandle;
use Illuminate\Http\JsonResponse;

class DomainAvailabilityController extends Controller
{
    public function show(DomainAvailabilityRequest $request, DomainReservationService $domains): JsonResponse
    {
        $handle = PublicStoreHandle::normalize((string) $request->validated('handle'));

        return response()->json([
            'data' => [
                'handle' => $handle,
                'domain' => PublicStoreHandle::domain($handle),
                'available' => $domains->isAvailable($handle),
            ],
        ]);
    }
}
