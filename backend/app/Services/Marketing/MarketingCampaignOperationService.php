<?php

namespace App\Services\Marketing;

use App\Exceptions\MarketingCampaignConflict;
use App\Support\CanonicalPayload;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class MarketingCampaignOperationService
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array{operation: object, replayed: bool}
     */
    public function claim(string $kind, string $scopeId, string $idempotencyKey, array $payload): array
    {
        $fingerprint = CanonicalPayload::fingerprint($payload);
        $inserted = DB::connection('tenant')->table('marketing_campaign_operations')->insertOrIgnore([
            'id' => (string) Str::uuid(),
            'operation_kind' => $kind,
            'scope_id' => $scopeId,
            'idempotency_key' => $idempotencyKey,
            'request_fingerprint' => $fingerprint,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $operation = DB::connection('tenant')->table('marketing_campaign_operations')
            ->where('operation_kind', $kind)
            ->where('scope_id', $scopeId)
            ->where('idempotency_key', $idempotencyKey)
            ->lockForUpdate()
            ->first();
        if ($operation === null) {
            throw new MarketingCampaignConflict('The campaign operation could not be claimed.', 'marketing_campaigns_not_ready', 503);
        }
        if (! hash_equals((string) $operation->request_fingerprint, $fingerprint)) {
            throw new MarketingCampaignConflict('The idempotency key was reused with different content.', 'campaign_idempotency_conflict');
        }

        return ['operation' => $operation, 'replayed' => $inserted === 0];
    }

    public function complete(string $operationId, string $resourceType, string $resourceId): void
    {
        $updated = DB::connection('tenant')->table('marketing_campaign_operations')
            ->where('id', $operationId)
            ->whereNull('completed_at')
            ->update([
                'resource_type' => $resourceType,
                'resource_id' => $resourceId,
                'completed_at' => now(),
                'updated_at' => now(),
            ]);
        if ($updated !== 1) {
            throw new MarketingCampaignConflict('The campaign operation result is unavailable.', 'marketing_campaigns_not_ready', 503);
        }
    }

    public function replayResourceId(object $operation, string $resourceType): string
    {
        if ($operation->completed_at === null || $operation->resource_type !== $resourceType || ! is_string($operation->resource_id)) {
            throw new MarketingCampaignConflict('The exact campaign replay is unavailable.', 'marketing_campaigns_not_ready', 503);
        }

        return $operation->resource_id;
    }
}
