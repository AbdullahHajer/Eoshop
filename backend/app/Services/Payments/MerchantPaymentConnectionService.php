<?php

namespace App\Services\Payments;

use App\Enums\PermissionKey;
use App\Enums\RoleScope;
use App\Enums\TenantMembershipStatus;
use App\Enums\UserStatus;
use App\Exceptions\PaymentConnectionConflict;
use App\Models\MerchantPaymentConnection;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AdminAuditService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use JsonException;
use SensitiveParameter;

final class MerchantPaymentConnectionService
{
    public function __construct(
        private readonly PaymentCredentialVault $vault,
        private readonly AdminAuditService $audit,
    ) {}

    /** @return array<string, mixed> */
    public function read(Tenant $tenant, User $actor): array
    {
        $central = DB::connection((string) config('tenancy.database.central_connection'));
        $this->assertReadable($central, $tenant, $actor);

        $connection = MerchantPaymentConnection::query()
            ->where('tenant_id', $tenant->getKey())
            ->where('provider', MerchantPaymentConnection::PROVIDER_BASGATE)
            ->first();

        return $this->project($connection);
    }

    /**
     * @param  array{
     *   expectedRevision: int,
     *   environment: string,
     *   credentials: array{appId: string, merchantKey: string, clientId: string, clientSecret: string},
     *   idempotencyKey: string,
     *   requestId?: string|null
     * }  $input
     * @return array{resource: array<string, mixed>, replayed: bool}
     */
    public function configure(
        Tenant $tenant,
        User $actor,
        #[SensitiveParameter] array $input,
        Request $request,
    ): array {
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        return $central->transaction(function () use (
            $central,
            $tenant,
            $actor,
            $input,
            $request,
        ): array {
            [$lockedTenant, $lockedActor] = $this->lockAndAuthorizeWrite($central, $tenant, $actor);
            $fingerprintPayload = [
                'tenantId' => (string) $lockedTenant->getKey(),
                'provider' => MerchantPaymentConnection::PROVIDER_BASGATE,
                'kind' => 'configure',
                'expectedRevision' => $input['expectedRevision'],
                'environment' => $input['environment'],
                'credentials' => $input['credentials'],
            ];
            $requestFingerprint = $this->vault->requestFingerprint($fingerprintPayload);
            $operation = $this->claimOperation(
                $central,
                $lockedTenant,
                $lockedActor,
                (string) $input['idempotencyKey'],
                $requestFingerprint,
                $fingerprintPayload,
                isset($input['requestId']) ? (string) $input['requestId'] : null,
            );
            if ($operation['replayed']) {
                return [
                    'resource' => $this->replayResult($central, (string) $operation['record']->id),
                    'replayed' => true,
                ];
            }

            $connection = MerchantPaymentConnection::query()
                ->where('tenant_id', $lockedTenant->getKey())
                ->where('provider', MerchantPaymentConnection::PROVIDER_BASGATE)
                ->lockForUpdate()
                ->first();
            $expectedRevision = (int) $input['expectedRevision'];
            if (($connection === null && $expectedRevision !== 0)
                || ($connection !== null && (int) $connection->getAttribute('revision') !== $expectedRevision)) {
                throw new PaymentConnectionConflict(
                    'The payment connection changed since it was loaded.',
                    'payment_connection_revision_conflict',
                );
            }
            if ($connection !== null && in_array(
                (string) $connection->getAttribute('state'),
                ['active', 'verification_pending'],
                true,
            )) {
                throw new PaymentConnectionConflict(
                    'The payment connection cannot be replaced in its current state.',
                    'payment_connection_state_conflict',
                );
            }

            if ($connection !== null
                && (string) $connection->getAttribute('environment') === $input['environment']) {
                try {
                    $candidateFingerprint = $this->vault->credentialFingerprint(
                        credentials: $input['credentials'],
                        tenantId: (string) $lockedTenant->getKey(),
                        provider: MerchantPaymentConnection::PROVIDER_BASGATE,
                        environment: $input['environment'],
                        keyVersion: (string) $connection->getAttribute('fingerprint_key_version'),
                    );
                } catch (PaymentConnectionConflict $exception) {
                    if ($exception->errorCode !== 'payment_connection_unavailable') {
                        throw $exception;
                    }
                    $candidateFingerprint = null;
                }
                if ($candidateFingerprint !== null && hash_equals(
                    (string) $connection->getAttribute('credential_fingerprint'),
                    $candidateFingerprint['fingerprint'],
                )) {
                    $resource = $this->project($connection);
                    $this->storeResult($central, (string) $operation['record']->id, $resource);

                    return ['resource' => $resource, 'replayed' => false];
                }
            }

            $nextCredentialRevision = $connection === null
                ? 1
                : (int) $connection->getAttribute('credential_revision') + 1;
            $sealed = $this->vault->seal(
                credentials: $input['credentials'],
                tenantId: (string) $lockedTenant->getKey(),
                provider: MerchantPaymentConnection::PROVIDER_BASGATE,
                environment: $input['environment'],
                credentialRevision: $nextCredentialRevision,
            );

            $oldProjection = $this->auditProjection($connection);
            if ($connection === null) {
                $connection = new MerchantPaymentConnection;
                $connection->forceFill([
                    'id' => (string) Str::uuid(),
                    'tenant_id' => $lockedTenant->getKey(),
                    'provider' => MerchantPaymentConnection::PROVIDER_BASGATE,
                    'revision' => 1,
                    'credential_revision' => 1,
                    'created_by_user_id' => $lockedActor->getKey(),
                ]);
            } else {
                $connection->forceFill([
                    'revision' => (int) $connection->getAttribute('revision') + 1,
                    'credential_revision' => $nextCredentialRevision,
                ]);
            }
            $connection->forceFill([
                'environment' => $input['environment'],
                'state' => 'draft',
                'verified_credential_revision' => null,
                'credential_ciphertext' => $sealed['ciphertext'],
                'credential_key_version' => $sealed['keyVersion'],
                'credential_fingerprint' => $sealed['fingerprint'],
                'fingerprint_key_version' => $sealed['fingerprintKeyVersion'],
                'last_verification_code' => null,
                'last_verification_attempt_at' => null,
                'last_verified_at' => null,
                'disabled_at' => null,
                'updated_by_user_id' => $lockedActor->getKey(),
            ])->save();

            $resource = $this->project($connection->refresh());
            $this->audit->record(
                request: $request,
                actor: $lockedActor,
                action: 'merchant.payment_connection.configured',
                subject: $connection,
                tenant: $lockedTenant,
                oldValues: $oldProjection,
                newValues: $this->auditProjection($connection),
            );
            $this->storeResult($central, (string) $operation['record']->id, $resource);

            return ['resource' => $resource, 'replayed' => false];
        });
    }

    private function assertReadable(ConnectionInterface $central, Tenant $tenant, User $actor): void
    {
        $activeActor = User::withTrashed()
            ->whereKey($actor->getKey())
            ->whereNull('deleted_at')
            ->where('status', UserStatus::Active->value)
            ->exists();
        $membership = $central->table('tenant_user')
            ->where('tenant_id', $tenant->getKey())
            ->where('user_id', $actor->getKey())
            ->where('status', TenantMembershipStatus::Active->value)
            ->exists();
        if (! $activeActor || ! $membership) {
            throw new AuthorizationException('An active tenant membership is required.');
        }
    }

    /** @return array{Tenant, User} */
    private function lockAndAuthorizeWrite(
        ConnectionInterface $central,
        Tenant $tenant,
        User $actor,
    ): array {
        $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
        $lockedActor = User::withTrashed()->whereKey($actor->getKey())->lockForUpdate()->first();
        if (! $lockedActor instanceof User
            || $lockedActor->trashed()
            || $lockedActor->getAttribute('status') !== UserStatus::Active) {
            throw new AuthorizationException('The payment connection actor is not active.');
        }

        $membership = $central->table('tenant_user')
            ->where('tenant_id', $lockedTenant->getKey())
            ->where('user_id', $lockedActor->getKey())
            ->lockForUpdate()
            ->first();
        if ($membership === null || $membership->status !== TenantMembershipStatus::Active->value) {
            throw new AuthorizationException('An active tenant membership is required.');
        }

        $allowed = $central->table('tenant_user')
            ->join('roles', 'roles.id', '=', 'tenant_user.role_id')
            ->join('permission_role', 'permission_role.role_id', '=', 'roles.id')
            ->join('permissions', 'permissions.id', '=', 'permission_role.permission_id')
            ->where('tenant_user.tenant_id', $lockedTenant->getKey())
            ->where('tenant_user.user_id', $lockedActor->getKey())
            ->where('tenant_user.status', TenantMembershipStatus::Active->value)
            ->where('roles.scope', RoleScope::Tenant->value)
            ->where('permissions.scope', RoleScope::Tenant->value)
            ->where('permissions.key', PermissionKey::TenantStoreManage->value)
            ->exists();
        if (! $allowed) {
            throw new AuthorizationException('Store management permission is required.');
        }

        return [$lockedTenant, $lockedActor];
    }

    /**
     * @param  array{fingerprint: string, fingerprintKeyVersion: string}  $requestFingerprint
     * @param  array<string, mixed>  $fingerprintPayload
     * @return array{record: object, replayed: bool}
     */
    private function claimOperation(
        ConnectionInterface $central,
        Tenant $tenant,
        User $actor,
        string $idempotencyKey,
        array $requestFingerprint,
        #[SensitiveParameter] array $fingerprintPayload,
        ?string $requestId,
    ): array {
        $inserted = $central->table('payment_connection_operations')->insertOrIgnore([
            'id' => (string) Str::uuid(),
            'tenant_id' => $tenant->getKey(),
            'actor_user_id' => $actor->getKey(),
            'provider' => MerchantPaymentConnection::PROVIDER_BASGATE,
            'kind' => 'configure',
            'idempotency_key' => $idempotencyKey,
            'request_fingerprint' => $requestFingerprint['fingerprint'],
            'fingerprint_key_version' => $requestFingerprint['fingerprintKeyVersion'],
            'request_id' => $requestId,
            'created_at' => now(),
        ]);
        $operation = $central->table('payment_connection_operations')
            ->where('tenant_id', $tenant->getKey())
            ->where('actor_user_id', $actor->getKey())
            ->where('provider', MerchantPaymentConnection::PROVIDER_BASGATE)
            ->where('kind', 'configure')
            ->where('idempotency_key', $idempotencyKey)
            ->lockForUpdate()
            ->first();
        if ($operation === null) {
            throw new PaymentConnectionConflict(
                'The payment connection operation could not be claimed.',
                'payment_connection_unavailable',
                503,
            );
        }
        $comparison = $this->vault->requestFingerprint(
            $fingerprintPayload,
            (string) $operation->fingerprint_key_version,
        );
        if (! hash_equals((string) $operation->request_fingerprint, $comparison['fingerprint'])) {
            throw new PaymentConnectionConflict(
                'The idempotency key was reused with different payment connection content.',
                'payment_connection_idempotency_conflict',
            );
        }

        return ['record' => $operation, 'replayed' => $inserted === 0];
    }

    /** @return array<string, mixed> */
    private function replayResult(ConnectionInterface $central, string $operationId): array
    {
        $stored = $central->table('payment_connection_operation_results')
            ->where('operation_id', $operationId)
            ->value('response_json');
        try {
            $result = is_array($stored)
                ? $stored
                : (is_string($stored) ? json_decode($stored, true, 32, JSON_THROW_ON_ERROR) : null);
        } catch (JsonException) {
            $result = null;
        }
        if (! is_array($result) || ! $this->validRedactedResource($result)) {
            throw new PaymentConnectionConflict(
                'The payment connection operation is still in progress.',
                'payment_connection_operation_in_progress',
            );
        }

        return $result;
    }

    /** @param array<string, mixed> $resource */
    private function validRedactedResource(array $resource): bool
    {
        $allowedKeys = [
            'provider',
            'environment',
            'state',
            'revision',
            'canAcceptOnlinePayments',
            'lastVerificationCode',
            'lastVerifiedAt',
            'updatedAt',
        ];
        $actualKeys = array_keys($resource);
        if (count($actualKeys) !== count($allowedKeys)
            || array_diff($actualKeys, $allowedKeys) !== []
            || array_diff($allowedKeys, $actualKeys) !== []) {
            return false;
        }

        return $resource['provider'] === MerchantPaymentConnection::PROVIDER_BASGATE
            && in_array($resource['environment'], ['sandbox', 'production'], true)
            && in_array($resource['state'], ['draft', 'verification_pending', 'active', 'verification_failed', 'disabled'], true)
            && is_int($resource['revision'])
            && $resource['revision'] > 0
            && is_bool($resource['canAcceptOnlinePayments'])
            && ($resource['lastVerificationCode'] === null || is_string($resource['lastVerificationCode']))
            && ($resource['lastVerifiedAt'] === null || is_string($resource['lastVerifiedAt']))
            && ($resource['updatedAt'] === null || is_string($resource['updatedAt']));
    }

    /** @param array<string, mixed> $resource */
    private function storeResult(ConnectionInterface $central, string $operationId, array $resource): void
    {
        $central->table('payment_connection_operation_results')->insert([
            'operation_id' => $operationId,
            'response_json' => json_encode($resource, JSON_THROW_ON_ERROR),
            'created_at' => now(),
        ]);
    }

    /** @return array<string, mixed> */
    private function project(?MerchantPaymentConnection $connection): array
    {
        if (! $connection instanceof MerchantPaymentConnection) {
            return [
                'provider' => MerchantPaymentConnection::PROVIDER_BASGATE,
                'environment' => null,
                'state' => 'unconfigured',
                'revision' => 0,
                'canAcceptOnlinePayments' => false,
                'lastVerificationCode' => null,
                'lastVerifiedAt' => null,
                'updatedAt' => null,
            ];
        }

        return [
            'provider' => MerchantPaymentConnection::PROVIDER_BASGATE,
            'environment' => (string) $connection->getAttribute('environment'),
            'state' => (string) $connection->getAttribute('state'),
            'revision' => (int) $connection->getAttribute('revision'),
            'canAcceptOnlinePayments' => false,
            'lastVerificationCode' => $connection->getAttribute('last_verification_code'),
            'lastVerifiedAt' => $connection->getAttribute('last_verified_at')?->toISOString(),
            'updatedAt' => $connection->getAttribute('updated_at')?->toISOString(),
        ];
    }

    /** @return array<string, mixed> */
    private function auditProjection(?MerchantPaymentConnection $connection): array
    {
        $projection = $this->project($connection);

        return [
            'provider' => $projection['provider'],
            'environment' => $projection['environment'],
            'state' => $projection['state'],
            'revision' => $projection['revision'],
        ];
    }
}
