<?php

namespace Tests\Integration;

use App\Enums\SystemRole;
use App\Enums\TenantMembershipStatus;
use App\Enums\UserStatus;
use App\Models\AdminAuditLog;
use App\Models\MerchantPaymentConnection;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Payments\PaymentCredentialVault;
use App\Services\RoleAssignmentService;
use Database\Seeders\IdentitySeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use RuntimeException;
use Tests\TestCase;

#[Group('database')]
class MerchantPaymentConnectionTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
        config()->set('payments.credential_vault', [
            'current_key_version' => 'test-enc-v1',
            'current_key' => 'base64:'.base64_encode(str_repeat('E', 32)),
            'previous_key_version' => null,
            'previous_key' => null,
            'fingerprint_current_key_version' => 'test-fp-v1',
            'fingerprint_current_key' => 'base64:'.base64_encode(str_repeat('F', 32)),
            'fingerprint_previous_key_version' => null,
            'fingerprint_previous_key' => null,
        ]);
    }

    public function test_configure_is_write_only_encrypted_audited_revisioned_and_exactly_replayed(): void
    {
        [$tenant, $owner] = $this->ownedTenant('payment-primary');
        $body = $this->payload();
        $headers = [
            'Idempotency-Key' => '11111111-1111-4111-8111-111111111111',
            'X-Request-ID' => '21111111-1111-4111-8111-111111111111',
        ];

        $this->getJson("/api/merchant/stores/{$tenant->getKey()}/payment-connections/basgate")
            ->assertUnauthorized();
        $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->getKey()}/payment-connections/basgate")
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.provider', 'basgate')
            ->assertJsonPath('data.state', 'unconfigured')
            ->assertJsonPath('data.revision', 0)
            ->assertJsonPath('data.environment', null)
            ->assertJsonPath('data.canAcceptOnlinePayments', false);

        $response = $this->actingAs($owner)->withHeaders($headers)->putJson(
            "/api/merchant/stores/{$tenant->getKey()}/payment-connections/basgate",
            $body,
        );
        $response->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.provider', 'basgate')
            ->assertJsonPath('data.environment', 'sandbox')
            ->assertJsonPath('data.state', 'draft')
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('data.canAcceptOnlinePayments', false)
            ->assertJsonPath('meta.replayed', false)
            ->assertJsonMissingPath('data.credentials')
            ->assertJsonMissingPath('data.credentialRevision');
        $this->assertResponseExcludesCredentials($response->getContent(), $body['credentials']);

        $record = MerchantPaymentConnection::query()
            ->where('tenant_id', $tenant->getKey())
            ->where('provider', 'basgate')
            ->sole();
        $this->assertSame('test-enc-v1', $record->getAttribute('credential_key_version'));
        $this->assertSame('test-fp-v1', $record->getAttribute('fingerprint_key_version'));
        $this->assertSame(1, $record->getAttribute('credential_revision'));
        $ciphertext = (string) $record->getAttribute('credential_ciphertext');
        $this->assertResponseExcludesCredentials($ciphertext, $body['credentials']);
        $this->assertEquals($body['credentials'], app(PaymentCredentialVault::class)->open(
            $ciphertext,
            'test-enc-v1',
            (string) $tenant->getKey(),
            'basgate',
            'sandbox',
            1,
        ));

        $audit = AdminAuditLog::query()
            ->where('action', 'merchant.payment_connection.configured')
            ->sole();
        $this->assertSame([
            'provider' => 'basgate',
            'environment' => null,
            'state' => 'unconfigured',
            'revision' => 0,
        ], $audit->old_values);
        $this->assertSame([
            'provider' => 'basgate',
            'environment' => 'sandbox',
            'state' => 'draft',
            'revision' => 1,
        ], $audit->new_values);
        $this->assertResponseExcludesCredentials(
            json_encode([$audit->old_values, $audit->new_values], JSON_THROW_ON_ERROR),
            $body['credentials'],
        );

        $replay = $this->actingAs($owner)->withHeaders($headers)->putJson(
            "/api/merchant/stores/{$tenant->getKey()}/payment-connections/basgate",
            $body,
        );
        $replay->assertOk()
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('meta.replayed', true);
        $this->assertSame(1, MerchantPaymentConnection::query()->where('tenant_id', $tenant->getKey())->count());
        $this->assertSame(1, DB::table('payment_connection_operations')->where('tenant_id', $tenant->getKey())->count());
        $this->assertSame(1, AdminAuditLog::query()->where('action', 'merchant.payment_connection.configured')->count());

        $conflicting = $body;
        $conflicting['credentials']['clientSecret'] = 'another-fake-client-secret';
        $conflictResponse = $this->actingAs($owner)->withHeaders($headers)->putJson(
            "/api/merchant/stores/{$tenant->getKey()}/payment-connections/basgate",
            $conflicting,
        );
        $conflictResponse->assertConflict()
            ->assertJsonPath('code', 'payment_connection_idempotency_conflict');
        $this->assertResponseExcludesCredentials($conflictResponse->getContent(), $conflicting['credentials']);
    }

    public function test_new_idempotency_key_with_identical_content_is_a_revision_noop(): void
    {
        [$tenant, $owner] = $this->ownedTenant('payment-noop');
        $url = "/api/merchant/stores/{$tenant->getKey()}/payment-connections/basgate";
        $body = $this->payload();

        $this->actingAs($owner)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->putJson($url, $body)->assertOk()->assertJsonPath('data.revision', 1);
        $body['expectedRevision'] = 1;
        $this->actingAs($owner)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->putJson($url, $body)
            ->assertOk()
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('meta.replayed', false);

        $this->assertSame(2, DB::table('payment_connection_operations')->where('tenant_id', $tenant->getKey())->count());
        $this->assertSame(1, AdminAuditLog::query()->where('action', 'merchant.payment_connection.configured')->count());
    }

    public function test_receipt_replay_survives_multiple_fingerprint_rotations_and_missing_old_key_allows_replacement(): void
    {
        [$tenant, $owner] = $this->ownedTenant('payment-key-rotation');
        $url = "/api/merchant/stores/{$tenant->getKey()}/payment-connections/basgate";
        $body = $this->payload();
        $idempotencyKey = (string) Str::uuid();

        $this->actingAs($owner)->withHeader('Idempotency-Key', $idempotencyKey)
            ->putJson($url, $body)->assertOk()->assertJsonPath('data.revision', 1);

        config()->set('payments.credential_vault.fingerprint_current_key_version', 'test-fp-v3');
        config()->set(
            'payments.credential_vault.fingerprint_current_key',
            'base64:'.base64_encode(str_repeat('Q', 32)),
        );
        config()->set('payments.credential_vault.fingerprint_previous_key_version', 'test-fp-v2');
        config()->set(
            'payments.credential_vault.fingerprint_previous_key',
            'base64:'.base64_encode(str_repeat('P', 32)),
        );
        config()->set('payments.credential_vault.fingerprint_retained_keys', json_encode([
            'test-fp-v1' => 'base64:'.base64_encode(str_repeat('F', 32)),
        ], JSON_THROW_ON_ERROR));

        $this->actingAs($owner)->withHeader('Idempotency-Key', $idempotencyKey)
            ->putJson($url, $body)
            ->assertOk()
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('meta.replayed', true);

        config()->set('payments.credential_vault.fingerprint_retained_keys', null);
        $replacement = $body;
        $replacement['expectedRevision'] = 1;
        $replacement['credentials']['clientSecret'] = 'rotated-fake-client-secret';
        $this->actingAs($owner)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->putJson($url, $replacement)
            ->assertOk()
            ->assertJsonPath('data.revision', 2)
            ->assertJsonPath('meta.replayed', false);

        $record = MerchantPaymentConnection::query()->where('tenant_id', $tenant->getKey())->sole();
        $this->assertSame('test-fp-v3', $record->getAttribute('fingerprint_key_version'));
        $this->assertSame(2, $record->getAttribute('credential_revision'));
    }

    public function test_exact_tenant_membership_and_store_manage_permission_bound_read_and_write(): void
    {
        [$tenantA, $ownerA] = $this->ownedTenant('payment-auth-a');
        [$tenantB, $ownerB] = $this->ownedTenant('payment-auth-b');
        $staff = $this->user('payment-staff@example.test');
        app(RoleAssignmentService::class)->assignTenantRole(
            $tenantA,
            $staff,
            Role::query()->where('key', SystemRole::MerchantStaff->value)->firstOrFail(),
            $ownerA,
        );
        $urlA = "/api/merchant/stores/{$tenantA->getKey()}/payment-connections/basgate";
        $urlB = "/api/merchant/stores/{$tenantB->getKey()}/payment-connections/basgate";

        $this->flushSession();
        $this->actingAs($ownerA)->getJson($urlB)->assertForbidden();
        $this->flushSession();
        $this->actingAs($ownerB)->getJson($urlA)->assertForbidden();
        $this->flushSession();
        $this->actingAs($staff)->getJson($urlA)->assertOk()->assertJsonPath('data.state', 'unconfigured');
        $this->actingAs($staff)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->putJson($urlA, $this->payload())->assertForbidden();
        $this->assertSame(0, DB::table('payment_connection_operations')->count());

        $idempotencyKey = (string) Str::uuid();
        $this->flushSession();
        $this->actingAs($ownerA)->withHeader('Idempotency-Key', $idempotencyKey)
            ->putJson($urlA, $this->payload())->assertOk();
        DB::table('tenant_user')
            ->where('tenant_id', $tenantA->getKey())
            ->where('user_id', $ownerA->getKey())
            ->update(['status' => TenantMembershipStatus::Suspended->value]);
        $this->actingAs($ownerA->refresh())->withHeader('Idempotency-Key', $idempotencyKey)
            ->putJson($urlA, $this->payload())->assertForbidden();
        $this->assertSame(1, DB::table('payment_connection_operations')->where('tenant_id', $tenantA->getKey())->count());
    }

    public function test_validation_rejects_unknown_fields_without_echoing_credentials(): void
    {
        [$tenant, $owner] = $this->ownedTenant('payment-validation');
        $body = $this->payload();
        $body['unexpected'] = 'must-be-rejected';
        $body['credentials']['redirectUrl'] = 'https://merchant-controlled.example.test';

        $response = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->putJson("/api/merchant/stores/{$tenant->getKey()}/payment-connections/basgate", $body);
        $response->assertUnprocessable()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('code', 'payment_connection_validation_failed')
            ->assertJsonValidationErrors(['request', 'credentials']);
        $this->assertResponseExcludesCredentials($response->getContent(), $body['credentials']);
        $this->assertSame(0, DB::table('payment_connection_operations')->count());
    }

    public function test_validation_rejects_whitespace_and_invisible_unicode_inside_opaque_credentials(): void
    {
        [$tenant, $owner] = $this->ownedTenant('payment-validation-unicode');
        $body = $this->payload();
        $body['credentials']['merchantKey'] = ' fake-merchant-key ';
        $body['credentials']['clientSecret'] = "fake\u{200B}client-secret";

        $response = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->putJson("/api/merchant/stores/{$tenant->getKey()}/payment-connections/basgate", $body);
        $response->assertUnprocessable()
            ->assertJsonPath('code', 'payment_connection_validation_failed')
            ->assertJsonValidationErrors(['credentials.merchantKey', 'credentials.clientSecret']);
        $this->assertResponseExcludesCredentials($response->getContent(), $body['credentials']);
        $this->assertSame(0, DB::table('payment_connection_operations')->count());
    }

    public function test_stale_revision_and_inflight_or_active_state_refuse_replacement(): void
    {
        [$tenant, $owner] = $this->ownedTenant('payment-state');
        $url = "/api/merchant/stores/{$tenant->getKey()}/payment-connections/basgate";
        $this->actingAs($owner)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->putJson($url, $this->payload())->assertOk();

        $replacement = $this->payload();
        $replacement['credentials']['clientSecret'] = 'replacement-fake-client-secret';
        $this->actingAs($owner)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->putJson($url, $replacement)
            ->assertConflict()
            ->assertJsonPath('code', 'payment_connection_revision_conflict');

        DB::table('merchant_payment_connections')
            ->where('tenant_id', $tenant->getKey())
            ->update(['state' => 'verification_pending']);
        $replacement['expectedRevision'] = 1;
        $this->actingAs($owner)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->putJson($url, $replacement)
            ->assertConflict()
            ->assertJsonPath('code', 'payment_connection_state_conflict');

        DB::table('merchant_payment_connections')
            ->where('tenant_id', $tenant->getKey())
            ->update([
                'state' => 'active',
                'verified_credential_revision' => 1,
                'last_verified_at' => now(),
            ]);
        $this->actingAs($owner)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->putJson($url, $replacement)
            ->assertConflict()
            ->assertJsonPath('code', 'payment_connection_state_conflict');

        $record = MerchantPaymentConnection::query()->where('tenant_id', $tenant->getKey())->sole();
        $this->assertSame('active', $record->getAttribute('state'));
        $this->assertSame(1, $record->getAttribute('revision'));
        $this->assertSame(1, DB::table('payment_connection_operations')->where('tenant_id', $tenant->getKey())->count());
    }

    public function test_missing_vault_configuration_fails_before_claiming_an_operation(): void
    {
        [$tenant, $owner] = $this->ownedTenant('payment-vault-missing');
        config()->set('payments.credential_vault.current_key', null);

        $response = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->putJson(
                "/api/merchant/stores/{$tenant->getKey()}/payment-connections/basgate",
                $this->payload(),
            );
        $response->assertStatus(503)
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('code', 'payment_connection_unavailable');
        $this->assertSame(0, DB::table('payment_connection_operations')->where('tenant_id', $tenant->getKey())->count());
        $this->assertSame(0, MerchantPaymentConnection::query()->where('tenant_id', $tenant->getKey())->count());
    }

    public function test_populated_migration_refuses_destructive_rollback(): void
    {
        [$tenant, $owner] = $this->ownedTenant('payment-rollback');
        $this->actingAs($owner)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->putJson(
                "/api/merchant/stores/{$tenant->getKey()}/payment-connections/basgate",
                $this->payload(),
            )->assertOk();
        $migration = require database_path(
            'migrations/system/2026_09_07_000017_create_merchant_payment_connections.php',
        );

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Refusing to erase merchant payment connection');
        $migration->down();
    }

    /** @return array{Tenant, User} */
    private function ownedTenant(string $id): array
    {
        $tenant = Tenant::query()->create([
            'id' => $id,
            'store_name' => 'Payment Store '.$id,
            'owner_name' => 'Payment Owner',
            'owner_email' => $id.'@example.test',
            'business_type' => 'retail',
        ]);
        $owner = $this->user($id.'-owner@example.test');
        app(RoleAssignmentService::class)->assignTenantRole(
            $tenant,
            $owner,
            Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail(),
            $owner,
        );

        return [$tenant, $owner];
    }

    private function user(string $email): User
    {
        return User::query()->create([
            'name' => 'Payment Test User',
            'email' => $email,
            'password' => 'not-a-real-password',
            'status' => UserStatus::Active,
        ]);
    }

    /**
     * @return array{
     *   expectedRevision: int,
     *   environment: string,
     *   credentials: array{appId: string, merchantKey: string, clientId: string, clientSecret: string}
     * }
     */
    private function payload(): array
    {
        return [
            'expectedRevision' => 0,
            'environment' => 'sandbox',
            'credentials' => [
                'appId' => '31111111-1111-4111-8111-111111111111',
                'merchantKey' => 'integration-fake-merchant-key',
                'clientId' => '32222222-2222-4222-8222-222222222222',
                'clientSecret' => 'integration-fake-client-secret',
            ],
        ];
    }

    /** @param array<string, string> $credentials */
    private function assertResponseExcludesCredentials(string $content, array $credentials): void
    {
        foreach ($credentials as $credential) {
            $this->assertStringNotContainsString($credential, $content);
        }
    }
}
