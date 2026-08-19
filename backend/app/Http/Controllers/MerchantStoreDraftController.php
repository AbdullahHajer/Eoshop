<?php

namespace App\Http\Controllers;

use App\Exceptions\StoreDraftConflict;
use App\Http\Requests\SaveStoreDraftRequest;
use App\Http\Resources\StoreDraftResource;
use App\Models\Tenant;
use App\Models\User;
use App\Services\StoreDraftService;
use Illuminate\Http\JsonResponse;

class MerchantStoreDraftController extends Controller
{
    public function current(StoreDraftService $drafts): JsonResponse|StoreDraftResource
    {
        /** @var User $actor */
        $actor = request()->user();
        $draft = $drafts->current($actor);

        return $draft === null ? response()->json(['data' => null]) : new StoreDraftResource($draft);
    }

    public function saveCurrent(SaveStoreDraftRequest $request, StoreDraftService $drafts): StoreDraftResource|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        try {
            return new StoreDraftResource($drafts->saveUnbound($request->validated(), $actor, $request));
        } catch (StoreDraftConflict $exception) {
            return $this->conflict($exception, $drafts->current($actor));
        }
    }

    public function correction(Tenant $tenant, StoreDraftService $drafts): StoreDraftResource|JsonResponse
    {
        /** @var User $actor */
        $actor = request()->user();
        try {
            return new StoreDraftResource($drafts->correction($tenant, $actor));
        } catch (StoreDraftConflict $exception) {
            return $this->conflict($exception, null);
        }
    }

    public function saveCorrection(
        SaveStoreDraftRequest $request,
        Tenant $tenant,
        StoreDraftService $drafts,
    ): StoreDraftResource|JsonResponse {
        /** @var User $actor */
        $actor = $request->user();
        try {
            return new StoreDraftResource($drafts->saveCorrection($tenant, $request->validated(), $actor, $request));
        } catch (StoreDraftConflict $exception) {
            $current = $tenant->draft()->first();

            return $this->conflict($exception, $current);
        }
    }

    private function conflict(StoreDraftConflict $exception, mixed $draft): JsonResponse
    {
        return response()->json([
            'message' => $exception->getMessage(),
            'code' => $exception->errorCode,
            'current' => $draft === null ? null : (new StoreDraftResource($draft))->resolve(request()),
        ], 409);
    }
}
