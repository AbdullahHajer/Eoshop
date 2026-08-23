<?php

namespace App\Http\Controllers;

use App\Exceptions\StoreDraftConflict;
use App\Exceptions\StoreSubmissionConflict;
use App\Http\Requests\StoreSubmissionRequest;
use App\Http\Resources\StoreSubmissionResource;
use App\Models\User;
use App\Services\StoreSubmissionService;
use Illuminate\Http\JsonResponse;

class StoreSubmissionController extends Controller
{
    public function store(StoreSubmissionRequest $request, StoreSubmissionService $submissions): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        try {
            $result = $submissions->submit($request->validated(), $actor, $request);
        } catch (StoreDraftConflict $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => $exception->errorCode,
            ], 409);
        } catch (StoreSubmissionConflict $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        return (new StoreSubmissionResource(
            $result['tenant']->load(MerchantStoreController::relations())
        ))
            ->additional(['meta' => ['replayed' => $result['replayed']]])
            ->response()
            ->setStatusCode($result['replayed'] ? 200 : 201);
    }
}
