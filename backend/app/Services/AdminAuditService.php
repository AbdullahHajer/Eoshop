<?php

namespace App\Services;

use App\Models\AdminAuditLog;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminAuditService
{
    /**
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    public function record(
        Request $request,
        User $actor,
        string $action,
        Model $subject,
        ?Tenant $tenant,
        ?array $oldValues,
        ?array $newValues,
    ): AdminAuditLog {
        $requestId = $this->requestId($request);

        return AdminAuditLog::query()->create([
            'actor_user_id' => $actor->getKey(),
            'tenant_id' => $tenant?->getKey(),
            'action' => $action,
            'subject_type' => $subject::class,
            'subject_id' => (string) $subject->getKey(),
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'ip_address' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 1024, ''),
            'request_id' => $requestId,
            'occurred_at' => now(),
        ]);
    }

    public function requestId(Request $request): string
    {
        $existing = $request->attributes->get('request_id');

        if (is_string($existing) && Str::isUuid($existing)) {
            return $existing;
        }

        $header = $request->header('X-Request-ID');
        $requestId = is_string($header) && Str::isUuid($header) ? $header : (string) Str::uuid();
        $request->attributes->set('request_id', $requestId);

        return $requestId;
    }
}
