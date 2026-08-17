<?php

namespace App\Http\Controllers;

use App\Exceptions\StoreWorkspaceConflict;
use App\Models\Tenant;
use App\Services\StoreWorkspaceService;
use Illuminate\Http\JsonResponse;

class StoreFrontController extends Controller
{
    /**
     * Get Store Config for the active tenant.
     */
    public function getStoreConfig(StoreWorkspaceService $workspaces): JsonResponse
    {
        $tenant = tenant();
        if (! $tenant instanceof Tenant) {
            abort(404);
        }

        try {
            $workspace = $workspaces->readPublic($tenant);

            return response()->json(['data' => [
                'workspaceRevision' => $workspace['revision'],
                'catalogRevision' => $workspace['catalogRevision'],
                'config' => $workspace['config'],
            ]]);
        } catch (StoreWorkspaceConflict) {
            abort(404);
        }
    }
}
