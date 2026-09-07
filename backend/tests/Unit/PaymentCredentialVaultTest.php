<?php

namespace Tests\Unit;

use App\Exceptions\PaymentConnectionConflict;
use App\Models\MerchantPaymentConnection;
use App\Services\Payments\PaymentCredentialVault;
use Illuminate\Database\Eloquent\MassAssignmentException;
use Tests\TestCase;

class PaymentCredentialVaultTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->configureKeys();
    }

    public function test_credentials_are_authenticated_encrypted_and_bound_to_their_row_context(): void
    {
        $vault = app(PaymentCredentialVault::class);
        $credentials = $this->credentials();
        $sealed = $vault->seal($credentials, 'tenant-alpha', 'basgate', 'sandbox', 1);

        $this->assertSame('enc-v1', $sealed['keyVersion']);
        $this->assertSame('fp-v1', $sealed['fingerprintKeyVersion']);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $sealed['fingerprint']);
        foreach ($credentials as $secret) {
            $this->assertStringNotContainsString($secret, $sealed['ciphertext']);
        }
        $this->assertEquals(
            $credentials,
            $vault->open($sealed['ciphertext'], 'enc-v1', 'tenant-alpha', 'basgate', 'sandbox', 1),
        );

        foreach ([
            ['tenant-beta', 'basgate', 'sandbox', 1],
            ['tenant-alpha', 'basgate', 'production', 1],
            ['tenant-alpha', 'basgate', 'sandbox', 2],
        ] as [$tenantId, $provider, $environment, $credentialRevision]) {
            try {
                $vault->open(
                    $sealed['ciphertext'],
                    'enc-v1',
                    $tenantId,
                    $provider,
                    $environment,
                    $credentialRevision,
                );
                $this->fail('Ciphertext moved to another connection context must fail closed.');
            } catch (PaymentConnectionConflict $exception) {
                $this->assertSame('payment_connection_unavailable', $exception->errorCode);
                $this->assertSame(503, $exception->httpStatus);
            }
        }

        $tampered = json_decode($sealed['ciphertext'], true, 32, JSON_THROW_ON_ERROR);
        $tampered['tag'] = base64_encode(str_repeat('T', 16));
        $this->assertVaultUnavailable(fn () => $vault->open(
            json_encode($tampered, JSON_THROW_ON_ERROR),
            'enc-v1',
            'tenant-alpha',
            'basgate',
            'sandbox',
            1,
        ));
    }

    public function test_previous_encryption_and_fingerprint_keys_keep_old_rows_and_receipts_readable(): void
    {
        $vault = app(PaymentCredentialVault::class);
        $credentials = $this->credentials();
        $sealed = $vault->seal($credentials, 'tenant-alpha', 'basgate', 'sandbox', 1);
        $payload = ['tenantId' => 'tenant-alpha', 'kind' => 'configure', 'credentials' => $credentials];
        $oldRequestFingerprint = $vault->requestFingerprint($payload);

        $this->configureKeys(
            encryptionVersion: 'enc-v2',
            encryptionByte: 'N',
            previousEncryptionVersion: 'enc-v1',
            previousEncryptionByte: 'E',
            fingerprintVersion: 'fp-v2',
            fingerprintByte: 'Q',
            previousFingerprintVersion: 'fp-v1',
            previousFingerprintByte: 'F',
        );

        $this->assertEquals(
            $credentials,
            $vault->open($sealed['ciphertext'], 'enc-v1', 'tenant-alpha', 'basgate', 'sandbox', 1),
        );
        $recomputed = $vault->requestFingerprint($payload, 'fp-v1');
        $this->assertSame($oldRequestFingerprint['fingerprint'], $recomputed['fingerprint']);
        $this->assertSame('fp-v1', $recomputed['fingerprintKeyVersion']);
    }

    public function test_retained_key_versions_survive_more_than_one_rotation(): void
    {
        $vault = app(PaymentCredentialVault::class);
        $credentials = $this->credentials();
        $sealed = $vault->seal($credentials, 'tenant-alpha', 'basgate', 'sandbox', 1);
        $payload = ['tenantId' => 'tenant-alpha', 'kind' => 'configure'];
        $original = $vault->requestFingerprint($payload);

        $this->configureKeys(
            encryptionVersion: 'enc-v3',
            encryptionByte: 'N',
            previousEncryptionVersion: 'enc-v2',
            previousEncryptionByte: 'M',
            fingerprintVersion: 'fp-v3',
            fingerprintByte: 'Q',
            previousFingerprintVersion: 'fp-v2',
            previousFingerprintByte: 'P',
        );
        config()->set('payments.credential_vault.retained_keys', json_encode([
            'enc-v1' => 'base64:'.base64_encode(str_repeat('E', 32)),
        ], JSON_THROW_ON_ERROR));
        config()->set('payments.credential_vault.fingerprint_retained_keys', json_encode([
            'fp-v1' => 'base64:'.base64_encode(str_repeat('F', 32)),
        ], JSON_THROW_ON_ERROR));

        $this->assertEquals(
            $credentials,
            $vault->open($sealed['ciphertext'], 'enc-v1', 'tenant-alpha', 'basgate', 'sandbox', 1),
        );
        $recomputed = $vault->requestFingerprint($payload, 'fp-v1');
        $this->assertSame($original['fingerprint'], $recomputed['fingerprint']);
        $this->assertSame('fp-v1', $recomputed['fingerprintKeyVersion']);
    }

    public function test_missing_wrong_or_reused_key_material_fails_closed(): void
    {
        $vault = app(PaymentCredentialVault::class);
        $sealed = $vault->seal($this->credentials(), 'tenant-alpha', 'basgate', 'sandbox', 1);

        config()->set('payments.credential_vault.current_key', null);
        $this->assertVaultUnavailable(fn () => $vault->requestFingerprint(['request' => 'value']));

        $this->configureKeys(fingerprintByte: 'E');
        $this->assertVaultUnavailable(fn () => $vault->requestFingerprint(['request' => 'value']));

        $this->configureKeys(encryptionByte: 'W');
        $this->assertVaultUnavailable(fn () => $vault->open(
            $sealed['ciphertext'],
            'enc-v1',
            'tenant-alpha',
            'basgate',
            'sandbox',
            1,
        ));
    }

    public function test_connection_model_is_fully_guarded_and_never_serializes_security_columns(): void
    {
        $model = new MerchantPaymentConnection;
        $this->expectException(MassAssignmentException::class);
        $model->fill(['state' => 'active']);
    }

    public function test_connection_model_projection_hides_secret_and_internal_material(): void
    {
        $model = new MerchantPaymentConnection;
        $model->forceFill([
            'id' => '11111111-1111-4111-8111-111111111111',
            'tenant_id' => 'tenant-alpha',
            'provider' => 'basgate',
            'environment' => 'sandbox',
            'state' => 'draft',
            'revision' => 1,
            'credential_revision' => 1,
            'credential_ciphertext' => 'encrypted-only',
            'credential_key_version' => 'enc-v1',
            'credential_fingerprint' => str_repeat('a', 64),
            'fingerprint_key_version' => 'fp-v1',
            'created_by_user_id' => '01AAAAAAAAAAAAAAAAAAAAAAAA',
            'updated_by_user_id' => '01AAAAAAAAAAAAAAAAAAAAAAAA',
        ]);

        $serialized = $model->toArray();
        foreach ([
            'id',
            'tenant_id',
            'credential_ciphertext',
            'credential_key_version',
            'credential_fingerprint',
            'fingerprint_key_version',
            'created_by_user_id',
            'updated_by_user_id',
            'credential_revision',
            'verified_credential_revision',
            'last_verification_attempt_at',
            'disabled_at',
        ] as $hidden) {
            $this->assertArrayNotHasKey($hidden, $serialized);
        }
        $this->assertSame('draft', $serialized['state']);
    }

    /** @return array{appId: string, merchantKey: string, clientId: string, clientSecret: string} */
    private function credentials(): array
    {
        return [
            'appId' => '11111111-1111-4111-8111-111111111111',
            'merchantKey' => 'not-a-real-merchant-key',
            'clientId' => '22222222-2222-4222-8222-222222222222',
            'clientSecret' => 'not-a-real-client-secret',
        ];
    }

    private function configureKeys(
        string $encryptionVersion = 'enc-v1',
        string $encryptionByte = 'E',
        ?string $previousEncryptionVersion = null,
        ?string $previousEncryptionByte = null,
        string $fingerprintVersion = 'fp-v1',
        string $fingerprintByte = 'F',
        ?string $previousFingerprintVersion = null,
        ?string $previousFingerprintByte = null,
    ): void {
        config()->set('payments.credential_vault', [
            'current_key_version' => $encryptionVersion,
            'current_key' => 'base64:'.base64_encode(str_repeat($encryptionByte, 32)),
            'previous_key_version' => $previousEncryptionVersion,
            'previous_key' => $previousEncryptionByte === null
                ? null
                : 'base64:'.base64_encode(str_repeat($previousEncryptionByte, 32)),
            'retained_keys' => null,
            'fingerprint_current_key_version' => $fingerprintVersion,
            'fingerprint_current_key' => 'base64:'.base64_encode(str_repeat($fingerprintByte, 32)),
            'fingerprint_previous_key_version' => $previousFingerprintVersion,
            'fingerprint_previous_key' => $previousFingerprintByte === null
                ? null
                : 'base64:'.base64_encode(str_repeat($previousFingerprintByte, 32)),
            'fingerprint_retained_keys' => null,
        ]);
    }

    private function assertVaultUnavailable(callable $operation): void
    {
        try {
            $operation();
            $this->fail('Invalid payment key material must fail closed.');
        } catch (PaymentConnectionConflict $exception) {
            $this->assertSame('payment_connection_unavailable', $exception->errorCode);
            $this->assertSame(503, $exception->httpStatus);
        }
    }
}
