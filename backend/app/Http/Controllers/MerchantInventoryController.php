<?php

namespace App\Http\Controllers;

use App\Exceptions\InventoryConflict;
use App\Http\Requests\AdjustInventoryRequest;
use App\Http\Requests\UpdateInventoryPolicyRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Services\InventoryLedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MerchantInventoryController extends Controller
{
    public function index(Request $request, Tenant $tenant, InventoryLedgerService $inventory): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        return $this->respond(fn (): array => $inventory->read($tenant, $actor));
    }

    public function movements(Request $request, Tenant $tenant, InventoryLedgerService $inventory): JsonResponse
    {
        $validated = validator($request->query(), [
            'productId' => ['nullable', 'uuid'],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:100'],
        ])->validate();
        /** @var User $actor */
        $actor = $request->user();

        return $this->respond(fn (): array => $inventory->history(
            $tenant,
            $actor,
            isset($validated['productId']) ? (string) $validated['productId'] : null,
            (int) ($validated['page'] ?? 1),
            (int) ($validated['perPage'] ?? 25),
        ));
    }

    public function adjust(AdjustInventoryRequest $request, Tenant $tenant, InventoryLedgerService $inventory): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $validated = $request->validated();

        return $this->respond(fn (): array => $inventory->adjust(
            $tenant,
            $actor,
            $validated,
            (string) $validated['idempotencyKey'],
            isset($validated['requestId']) ? (string) $validated['requestId'] : null,
        ));
    }

    public function updatePolicy(UpdateInventoryPolicyRequest $request, Tenant $tenant, string $product, InventoryLedgerService $inventory): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $validated = $request->validated();

        return $this->respond(fn (): array => $inventory->updatePolicy(
            $tenant,
            $actor,
            $product,
            (int) $validated['expectedInventoryRevision'],
            (bool) $validated['manageStock'],
            (int) $validated['lowStockThreshold'],
            (string) $validated['idempotencyKey'],
            isset($validated['requestId']) ? (string) $validated['requestId'] : null,
        ));
    }

    /** @param callable(): array<string, mixed> $operation */
    private function respond(callable $operation): JsonResponse
    {
        try {
            return response()->json(['data' => $operation()]);
        } catch (InventoryConflict $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
                'code' => $exception->errorCode,
            ], 409);
        }
    }
}
