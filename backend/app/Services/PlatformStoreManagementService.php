<?php

namespace App\Services;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PlatformStoreManagementService
{
    public function __construct(private readonly AdminAuditService $audit) {}

    /**
     * @param  array<string, mixed>  $input
     */
    public function updateMetadata(Tenant $tenant, array $input, User $actor, Request $request): Tenant
    {
        return DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($tenant, $input, $actor, $request): Tenant {
                $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
                $mapping = [
                    'storeName' => 'store_name',
                    'ownerName' => 'owner_name',
                    'ownerEmail' => 'owner_email',
                    'ownerPhone' => 'owner_phone',
                    'businessType' => 'business_type',
                ];
                $newValues = [];

                foreach ($mapping as $inputKey => $column) {
                    if (array_key_exists($inputKey, $input)) {
                        $value = is_string($input[$inputKey]) ? trim($input[$inputKey]) : $input[$inputKey];
                        $newValues[$column] = $inputKey === 'ownerEmail' && is_string($value)
                            ? Str::lower($value)
                            : $value;
                    }
                }

                $oldValues = collect(array_keys($newValues))
                    ->mapWithKeys(fn (string $column): array => [$column => $lockedTenant->getAttribute($column)])
                    ->all();

                if ($oldValues === $newValues) {
                    return $lockedTenant;
                }

                $lockedTenant->forceFill($newValues)->save();
                $this->audit->record(
                    request: $request,
                    actor: $actor,
                    action: 'platform.store.metadata.changed',
                    subject: $lockedTenant,
                    tenant: $lockedTenant,
                    oldValues: $oldValues,
                    newValues: $newValues,
                );

                return $lockedTenant->refresh();
            });
    }
}
