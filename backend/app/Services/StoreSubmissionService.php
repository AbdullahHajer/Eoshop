<?php

namespace App\Services;

use App\Enums\ProvisioningState;
use App\Enums\SystemRole;
use App\Enums\TenantMembershipStatus;
use App\Enums\TenantVerificationStatus;
use App\Exceptions\StoreSubmissionConflict;
use App\Models\Role;
use App\Models\StoreSubmission;
use App\Models\Tenant;
use App\Models\User;
use App\Support\CanonicalDomain;
use App\Support\CanonicalPayload;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Stancl\Tenancy\Exceptions\DomainOccupiedByOtherTenantException;

class StoreSubmissionService
{
    public function __construct(
        private readonly RoleAssignmentService $roles,
        private readonly AdminAuditService $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array{tenant: Tenant, replayed: bool}
     */
    public function submit(array $input, User $actor, Request $request): array
    {
        $idempotencyKey = (string) $input['idempotencyKey'];
        $requestPayload = collect($input)->except('idempotencyKey')->all();
        $fingerprint = CanonicalPayload::fingerprint($requestPayload);

        $existing = $this->existingSubmission($actor, $idempotencyKey);
        if ($existing !== null) {
            return $this->replay($existing, $fingerprint);
        }

        $baseDomain = CanonicalDomain::normalize((string) config('tenancy.tenant_base_domain'));
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        try {
            return $central->transaction(function () use ($input, $actor, $request, $idempotencyKey, $fingerprint, $baseDomain): array {
                $tenant = Tenant::query()->create([
                    'id' => strtolower((string) Str::ulid()),
                    'store_name' => trim((string) $input['storeName']),
                    'owner_name' => (string) $actor->getAttribute('name'),
                    'owner_email' => (string) $actor->getAttribute('email'),
                    'owner_phone' => $actor->getAttribute('phone'),
                    'business_type' => trim((string) $input['businessType']),
                    'verification_status' => TenantVerificationStatus::Pending->value,
                    'provisioning_status' => ProvisioningState::NotStarted->value,
                    'theme_style' => $input['themeStyle'],
                ]);
                $domain = CanonicalDomain::normalize('store-'.$tenant->getKey().'.'.$baseDomain);
                $tenant->domains()->create(['domain' => $domain]);

                StoreSubmission::query()->create([
                    'tenant_id' => $tenant->getKey(),
                    'submitted_by_user_id' => $actor->getKey(),
                    'idempotency_key' => $idempotencyKey,
                    'request_fingerprint' => $fingerprint,
                    'payload_snapshot' => [
                        'storeName' => $tenant->getAttribute('store_name'),
                        'businessType' => $tenant->getAttribute('business_type'),
                        'domain' => $domain,
                        'themeStyle' => $tenant->getAttribute('theme_style'),
                        'config' => $input['config'],
                        'owner' => [
                            'id' => $actor->getKey(),
                            'name' => $actor->getAttribute('name'),
                            'email' => $actor->getAttribute('email'),
                        ],
                    ],
                    'initial_config_id' => (string) Str::uuid(),
                    'submitted_at' => now(),
                ]);

                $ownerRole = Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail();
                $this->roles->assignTenantRole($tenant, $actor, $ownerRole, $actor, TenantMembershipStatus::Active);
                $this->audit->record(
                    request: $request,
                    actor: $actor,
                    action: 'tenant.store.submitted',
                    subject: $tenant,
                    tenant: $tenant,
                    oldValues: null,
                    newValues: [
                        'domain' => $domain,
                        'verification_status' => TenantVerificationStatus::Pending->value,
                        'provisioning_status' => ProvisioningState::NotStarted->value,
                    ],
                );

                return ['tenant' => $tenant->load('domains'), 'replayed' => false];
            });
        } catch (DomainOccupiedByOtherTenantException) {
            throw StoreSubmissionConflict::domainUnavailable();
        } catch (QueryException $exception) {
            $existing = $this->existingSubmission($actor, $idempotencyKey);
            if ($existing !== null) {
                return $this->replay($existing, $fingerprint);
            }

            if (str_contains((string) ($exception->errorInfo[2] ?? ''), 'domains_domain_unique')) {
                throw StoreSubmissionConflict::domainUnavailable();
            }

            throw $exception;
        }
    }

    private function existingSubmission(User $actor, string $idempotencyKey): ?StoreSubmission
    {
        return StoreSubmission::query()
            ->with('tenant.domains')
            ->where('submitted_by_user_id', $actor->getKey())
            ->where('idempotency_key', $idempotencyKey)
            ->first();
    }

    /** @return array{tenant: Tenant, replayed: true} */
    private function replay(StoreSubmission $submission, string $fingerprint): array
    {
        if (! hash_equals((string) $submission->getAttribute('request_fingerprint'), $fingerprint)) {
            throw StoreSubmissionConflict::idempotencyKeyReused();
        }

        /** @var Tenant $tenant */
        $tenant = $submission->tenant;

        return ['tenant' => $tenant, 'replayed' => true];
    }
}
