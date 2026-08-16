<?php

namespace App\Http\Controllers;

use App\Exceptions\ProductCatalogConflict;
use App\Http\Requests\UploadCatalogMediaRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Services\CatalogMediaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;

class MerchantCatalogMediaController extends Controller
{
    public function store(UploadCatalogMediaRequest $request, Tenant $tenant, CatalogMediaService $service): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $image = $request->file('image');
        abort_unless($image instanceof UploadedFile, 422);

        try {
            return response()->json(['data' => $service->upload(
                $tenant,
                $actor,
                $image,
                (string) $request->validated('idempotencyKey'),
            )], 201);
        } catch (ProductCatalogConflict $exception) {
            return response()->json(['message' => $exception->getMessage(), 'code' => $exception->errorCode], 409);
        }
    }
}
