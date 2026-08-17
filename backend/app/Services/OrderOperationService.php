<?php

namespace App\Services;

use App\Enums\OrderActorType;
use App\Enums\OrderOperationKind;
use App\Exceptions\OrderConflict;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderOperationService
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array{operation: object, replayed: bool}
     */
    public function claim(
        OrderOperationKind $kind,
        string $scope,
        string $idempotencyKey,
        array $payload,
        OrderActorType $actorType,
        ?string $actorUserId,
        ?string $requestId,
    ): array {
        $fingerprint = hash('sha256', json_encode($this->canonicalize($payload), JSON_THROW_ON_ERROR));
        $inserted = DB::table('order_operations')->insertOrIgnore([
            'id' => (string) Str::uuid(),
            'kind' => $kind->value,
            'idempotency_scope' => $scope,
            'idempotency_key' => $idempotencyKey,
            'request_fingerprint' => $fingerprint,
            'actor_type' => $actorType->value,
            'actor_user_id' => $actorUserId,
            'request_id' => $requestId,
            'created_at' => now(),
        ]);

        $operation = DB::table('order_operations')
            ->where('kind', $kind->value)
            ->where('idempotency_scope', $scope)
            ->where('idempotency_key', $idempotencyKey)
            ->lockForUpdate()
            ->first();
        if ($operation === null) {
            throw new OrderConflict('The order operation could not be claimed.', 'order_not_ready', 503);
        }
        if (! hash_equals((string) $operation->request_fingerprint, $fingerprint)) {
            throw new OrderConflict('The idempotency key was reused with different order content.', 'order_idempotency_conflict');
        }

        return ['operation' => $operation, 'replayed' => $inserted === 0];
    }

    /** @param array<string, mixed> $result */
    public function storeResult(string $operationId, array $result): array
    {
        DB::table('order_operation_results')->insert([
            'operation_id' => $operationId,
            'response_json' => json_encode($result, JSON_THROW_ON_ERROR),
            'created_at' => now(),
        ]);

        return $result;
    }

    /** @return array<string, mixed> */
    public function replayResult(string $operationId): array
    {
        $stored = DB::table('order_operation_results')->where('operation_id', $operationId)->value('response_json');
        $result = is_array($stored) ? $stored : (is_string($stored) ? json_decode($stored, true, 512, JSON_THROW_ON_ERROR) : null);
        if (! is_array($result)) {
            throw new OrderConflict('The exact order replay is unavailable.', 'order_not_ready', 503);
        }
        $result['replayed'] = true;

        return $result;
    }

    private function canonicalize(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }
        if (array_is_list($value)) {
            return array_map(fn (mixed $item): mixed => $this->canonicalize($item), $value);
        }
        ksort($value);

        return array_map(fn (mixed $item): mixed => $this->canonicalize($item), $value);
    }
}
