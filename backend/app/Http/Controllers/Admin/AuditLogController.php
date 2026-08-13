<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminAuditLogResource;
use App\Models\AdminAuditLog;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AuditLogController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return AdminAuditLogResource::collection(
            AdminAuditLog::query()->latest('occurred_at')->paginate(50)
        );
    }
}
