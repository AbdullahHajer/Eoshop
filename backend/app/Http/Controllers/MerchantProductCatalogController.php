<?php

namespace App\Http\Controllers;

use App\Exceptions\InventoryConflict;
use App\Exceptions\ProductCatalogConflict;
use App\Http\Requests\UpdateProductCatalogRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Services\ProductCatalogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantProductCatalogController extends Controller
{
    public function show(Request $request, Tenant $tenant, ProductCatalogService $catalogs): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        return $this->respond(fn (): array => $catalogs->read($tenant, $actor));
    }

    public function update(
        UpdateProductCatalogRequest $request,
        Tenant $tenant,
        ProductCatalogService $catalogs,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        return $this->respond(fn (): array => $catalogs->update($tenant, $actor, $request->validated()));
    }

    /** @param callable(): array<string, mixed> $operation */
    private function respond(callable $operation): JsonResponse
    {
        try {
            return response()->json(['data' => $operation()]);
        } catch (ProductCatalogConflict|InventoryConflict $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => $exception->errorCode,
            ], 409);
        }
    }
}
