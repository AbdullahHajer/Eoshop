<?php

namespace App\Http\Resources;

use App\Models\AdminAuditLog;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin AdminAuditLog
 */
class AdminAuditLogResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $occurredAt = $this->getAttribute('occurred_at');
        $oldValues = $this->getAttribute('old_values');
        $newValues = $this->getAttribute('new_values');
        $changedFields = array_values(array_unique(array_merge(
            is_array($oldValues) ? array_keys($oldValues) : [],
            is_array($newValues) ? array_keys($newValues) : [],
        )));
        sort($changedFields);

        return [
            'id' => $this->getKey(),
            'actorUserId' => $this->getAttribute('actor_user_id'),
            'tenantId' => $this->getAttribute('tenant_id'),
            'action' => $this->getAttribute('action'),
            'subjectType' => $this->getAttribute('subject_type'),
            'subjectId' => $this->getAttribute('subject_id'),
            'changedFields' => $changedFields,
            'ipAddress' => $this->getAttribute('ip_address'),
            'requestId' => $this->getAttribute('request_id'),
            'occurredAt' => $occurredAt instanceof CarbonInterface ? $occurredAt->toIso8601String() : null,
        ];
    }
}
