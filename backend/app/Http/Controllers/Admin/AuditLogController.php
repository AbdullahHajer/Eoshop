<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ListAdminAuditLogsRequest;
use App\Http\Resources\AdminAuditLogResource;
use App\Models\AdminAuditLog;
use App\Support\SqlLikePattern;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AuditLogController extends Controller
{
    public function index(ListAdminAuditLogsRequest $request): AnonymousResourceCollection
    {
        $validated = $request->validated();
        $query = AdminAuditLog::query();

        if (isset($validated['search'])) {
            $search = SqlLikePattern::containsLiteral((string) $validated['search']);
            $query->where(function ($searchQuery) use ($search): void {
                $searchQuery->whereLike('actor_user_id', $search, caseSensitive: false)
                    ->orWhereLike('tenant_id', $search, caseSensitive: false)
                    ->orWhereLike('action', $search, caseSensitive: false)
                    ->orWhereLike('subject_type', $search, caseSensitive: false)
                    ->orWhereLike('subject_id', $search, caseSensitive: false)
                    ->orWhereRaw('request_id::text ILIKE ?', [$search]);
            });
        }
        if (isset($validated['action'])) {
            $query->where('action', (string) $validated['action']);
        }
        if (isset($validated['tenantId'])) {
            $query->where('tenant_id', (string) $validated['tenantId']);
        }

        return AdminAuditLogResource::collection($query
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->paginate((int) ($validated['perPage'] ?? 25)));
    }
}
