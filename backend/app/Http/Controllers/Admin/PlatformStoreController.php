<?php

namespace App\Http\Controllers\Admin;

use App\Enums\TenantVerificationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateTenantMetadataRequest;
use App\Http\Requests\Admin\UpdateTenantStatusRequest;
use App\Http\Resources\PlatformStoreResource;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AdminAuditService;
use App\Services\PlatformStoreManagementService;
use App\Services\PlatformStoreReviewService;
use App\Services\ProvisioningCoordinator;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PlatformStoreController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return PlatformStoreResource::collection(
            Tenant::query()->with(['domains', 'latestProvisioningRun'])->latest()->paginate(50)
        );
    }

    public function updateStatus(
        UpdateTenantStatusRequest $request,
        Tenant $tenant,
        PlatformStoreReviewService $reviews,
        AdminAuditService $audit,
    ): PlatformStoreResource {
        /** @var User $actor */
        $actor = $request->user();
        $status = TenantVerificationStatus::from((string) $request->validated('status'));
        $updatedTenant = $reviews->changeStatus(
            tenant: $tenant,
            status: $status,
            reason: $request->validated('reason'),
            actor: $actor,
            request: $request,
        );

        return (new PlatformStoreResource($updatedTenant->load(['domains', 'latestProvisioningRun'])))
            ->additional(['meta' => ['requestId' => $audit->requestId($request)]]);
    }

    public function update(
        UpdateTenantMetadataRequest $request,
        Tenant $tenant,
        PlatformStoreManagementService $stores,
        AdminAuditService $audit,
    ): PlatformStoreResource {
        /** @var User $actor */
        $actor = $request->user();
        $updatedTenant = $stores->updateMetadata($tenant, $request->validated(), $actor, $request);

        return (new PlatformStoreResource($updatedTenant->load(['domains', 'latestProvisioningRun'])))
            ->additional(['meta' => ['requestId' => $audit->requestId($request)]]);
    }

    public function retryProvisioning(
        Request $request,
        Tenant $tenant,
        ProvisioningCoordinator $provisioning,
        AdminAuditService $audit,
    ): PlatformStoreResource|JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        try {
            $provisioning->retry($tenant, $actor, $request);
        } catch (DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 409);
        }

        return (new PlatformStoreResource($tenant->refresh()->load(['domains', 'latestProvisioningRun'])))
            ->additional(['meta' => ['requestId' => $audit->requestId($request)]]);
    }
}
