<?php

namespace App\Http\Controllers;

use App\Exceptions\StoreDraftConflict;
use App\Exceptions\StoreSubmissionConflict;
use App\Http\Requests\SubmitStoreDraftRequest;
use App\Http\Resources\StoreSubmissionResource;
use App\Models\Tenant;
use App\Models\User;
use App\Services\PublicationService;
use App\Services\StoreResubmissionService;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantStoreLifecycleController extends Controller
{
    public function resubmit(
        SubmitStoreDraftRequest $request,
        Tenant $tenant,
        StoreResubmissionService $resubmissions,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();
        try {
            $result = $resubmissions->resubmit(
                $tenant,
                (int) $request->validated('expectedRevision'),
                (string) $request->validated('idempotencyKey'),
                $actor,
                $request,
            );
        } catch (StoreDraftConflict $exception) {
            return response()->json(['message' => $exception->getMessage(), 'code' => $exception->errorCode], 409);
        } catch (StoreSubmissionConflict $exception) {
            return response()->json(['message' => $exception->getMessage(), 'code' => 'store_submission_conflict'], 409);
        }

        return (new StoreSubmissionResource($result['tenant']->load(MerchantStoreController::relations())))
            ->additional(['meta' => ['replayed' => $result['replayed']]])
            ->response();
    }

    public function publish(
        Request $request,
        Tenant $tenant,
        PublicationService $publications,
    ): StoreSubmissionResource|JsonResponse {
        /** @var User $actor */
        $actor = $request->user();
        try {
            $updated = $publications->publishMerchant($tenant, $actor, $request);
        } catch (DomainException|StoreSubmissionConflict $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => 'publication_not_ready',
            ], 409);
        }

        return new StoreSubmissionResource($updated->load(MerchantStoreController::relations()));
    }

    public function unpublish(
        Request $request,
        Tenant $tenant,
        PublicationService $publications,
    ): StoreSubmissionResource|JsonResponse {
        /** @var User $actor */
        $actor = $request->user();
        try {
            $updated = $publications->unpublishMerchant($tenant, $actor, $request);
        } catch (DomainException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => 'publication_state_conflict',
            ], 409);
        }

        return new StoreSubmissionResource($updated->load(MerchantStoreController::relations()));
    }
}
