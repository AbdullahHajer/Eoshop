<?php

namespace App\Services;

use App\Enums\InventoryActorType;
use App\Enums\InventoryOperationKind;
use App\Exceptions\InventoryConflict;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InventoryOperationService
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array{operation: object, replayed: bool}
     */
    public function claim(
        InventoryOperationKind $kind,
        string $scope,
        string $idempotencyKey,
        array $payload,
        InventoryActorType $actorType,
        ?string $actorUserId,
        string $source,
        string $reasonCode,
        ?string $note = null,
        ?string $requestId = null,
        ?string $operationId = null,
    ): array {
        $fingerprint = $this->fingerprint($payload);
        $id = $operationId ?? (string) Str::uuid();
        $inserted = DB::table('inventory_operations')->insertOrIgnore([
            'id' => $id,
            'kind' => $kind->value,
            'idempotency_scope' => $scope,
            'idempotency_key' => $idempotencyKey,
            'request_fingerprint' => $fingerprint,
            'actor_type' => $actorType->value,
            'actor_user_id' => $actorUserId,
            'source' => $source,
            'reason_code' => $reasonCode,
            'note' => $note,
            'request_id' => $requestId,
            'created_at' => now(),
        ]);

        $operation = DB::table('inventory_operations')
            ->where('kind', $kind->value)
            ->where('idempotency_scope', $scope)
            ->where('idempotency_key', $idempotencyKey)
            ->lockForUpdate()
            ->first();
        if ($operation === null) {
            throw new InventoryConflict('The inventory operation could not be claimed.', 'inventory_not_ready');
        }
        if (! hash_equals((string) $operation->request_fingerprint, $fingerprint)) {
            throw new InventoryConflict(
                'The inventory idempotency key was reused with different content.',
                'inventory_idempotency_conflict',
            );
        }

        return ['operation' => $operation, 'replayed' => $inserted === 0];
    }

    /** @param array<string, mixed> $payload */
    public function fingerprint(array $payload): string
    {
        return hash('sha256', json_encode($this->canonicalize($payload), JSON_THROW_ON_ERROR));
    }

    /** @param array<string, mixed> $result */
    public function storeResult(string $operationId, array $result): array
    {
        DB::table('inventory_operation_results')->insert([
            'operation_id' => $operationId,
            'response_json' => json_encode($result, JSON_THROW_ON_ERROR),
            'created_at' => now(),
        ]);

        return $result;
    }

    /** @return array<string, mixed> */
    public function replayResult(string $operationId): array
    {
        $json = DB::table('inventory_operation_results')->where('operation_id', $operationId)->value('response_json');
        if (is_string($json)) {
            $result = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        } elseif (is_array($json)) {
            $result = $json;
        } else {
            throw new InventoryConflict('The exact inventory replay is unavailable.', 'inventory_not_ready');
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
