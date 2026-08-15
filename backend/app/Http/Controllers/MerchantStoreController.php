<?php

namespace App\Http\Controllers;

use App\Enums\TenantMembershipStatus;
use App\Http\Resources\StoreSubmissionResource;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class MerchantStoreController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        /** @var User $actor */
        $actor = $request->user();

        return StoreSubmissionResource::collection(
            Tenant::query()
                ->whereHas('users', fn ($query) => $query
                    ->where('users.id', $actor->getKey())
                    ->where('tenant_user.status', TenantMembershipStatus::Active->value))
                ->with(self::relations())
                ->latest()
                ->paginate(25)
        );
    }

    public function show(Tenant $tenant): StoreSubmissionResource
    {
        return new StoreSubmissionResource($tenant->load(self::relations()));
    }

    /** @return list<string> */
    private static function relations(): array
    {
        return [
            'domains',
            'latestProvisioningRun',
            'currentPublicationRequest.reservation',
            'currentPublicationRequest.subscription.plan',
            'publishedDomain',
            'publicationSubscription.plan',
        ];
    }
}
