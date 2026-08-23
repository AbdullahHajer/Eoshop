<?php

namespace App\Http\Controllers;

use App\Exceptions\StoreDraftConflict;
use App\Exceptions\StoreOnboardingFailure;
use App\Http\Requests\SaveStoreDraftRequest;
use App\Http\Requests\SaveStoreOnboardingBusinessRequest;
use App\Http\Requests\SaveStoreOnboardingDesignRequest;
use App\Http\Requests\SaveStoreOnboardingReviewRequest;
use App\Http\Resources\StoreDraftResource;
use App\Models\StoreDraft;
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

    public function saveBusiness(
        SaveStoreOnboardingBusinessRequest $request,
        StoreDraftService $drafts,
    ): StoreDraftResource|JsonResponse {
        return $this->saveOnboarding(
            fn (User $actor) => $drafts->saveBusiness($request->validated(), $actor, $request),
            $request,
            $drafts,
        );
    }

    public function saveDesign(
        SaveStoreOnboardingDesignRequest $request,
        StoreDraftService $drafts,
    ): StoreDraftResource|JsonResponse {
        $input = $request->validated();
        // Laravel intentionally excludes unvalidated nested array keys from
        // validated(); the workspace contract below is the authoritative deep
        // validator, so preserve the submitted config for that validation.
        $input['config'] = (array) $request->input('config');

        return $this->saveOnboarding(
            fn (User $actor) => $drafts->saveDesign($input, $actor, $request),
            $request,
            $drafts,
        );
    }

    public function saveReview(
        SaveStoreOnboardingReviewRequest $request,
        StoreDraftService $drafts,
    ): StoreDraftResource|JsonResponse {
        return $this->saveOnboarding(
            fn (User $actor) => $drafts->saveReview($request->validated(), $actor, $request),
            $request,
            $drafts,
        );
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

    /** @param callable(User): StoreDraft $save */
    private function saveOnboarding(callable $save, mixed $request, StoreDraftService $drafts): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        try {
            // These revisioned PUT writers have one stable success contract for
            // create, update and exact no-op responses.
            return (new StoreDraftResource($save($actor)))->response()->setStatusCode(200);
        } catch (StoreDraftConflict $exception) {
            return $this->conflict($exception, $drafts->current($actor));
        } catch (StoreOnboardingFailure $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => $exception->errorCode,
            ], $exception->getCode());
        }
    }
}
