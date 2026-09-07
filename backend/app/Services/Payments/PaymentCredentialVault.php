<?php

namespace App\Services\Payments;

use App\Exceptions\PaymentConnectionConflict;
use JsonException;
use SensitiveParameter;

final class PaymentCredentialVault
{
    private const ALGORITHM = 'aes-256-gcm';

    private const ENVELOPE_VERSION = 1;

    private const IV_BYTES = 12;

    private const TAG_BYTES = 16;

    /**
     * @param  array{appId: string, merchantKey: string, clientId: string, clientSecret: string}  $credentials
     * @return array{ciphertext: string, keyVersion: string, fingerprint: string, fingerprintKeyVersion: string}
     */
    public function seal(
        #[SensitiveParameter] array $credentials,
        string $tenantId,
        string $provider,
        string $environment,
        int $credentialRevision,
    ): array {
        [$currentVersion, $keys] = $this->encryptionKeyMaterial();
        $context = $this->context($tenantId, $provider, $environment, $credentialRevision);
        $normalizedCredentials = $this->normalize($credentials);
        $plaintext = $this->encode([
            'schemaVersion' => self::ENVELOPE_VERSION,
            'context' => $context,
            'credentials' => $normalizedCredentials,
        ]);
        $aad = $this->encode($context);
        $iv = random_bytes(self::IV_BYTES);
        $tag = '';
        $encrypted = openssl_encrypt(
            $plaintext,
            self::ALGORITHM,
            $keys[$currentVersion],
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            $aad,
            self::TAG_BYTES,
        );
        if (! is_string($encrypted) || strlen($tag) !== self::TAG_BYTES) {
            throw $this->unavailable();
        }

        return [
            'ciphertext' => $this->encode([
                'version' => self::ENVELOPE_VERSION,
                'algorithm' => self::ALGORITHM,
                'iv' => base64_encode($iv),
                'tag' => base64_encode($tag),
                'ciphertext' => base64_encode($encrypted),
            ]),
            'keyVersion' => $currentVersion,
            ...$this->credentialFingerprint(
                $credentials,
                $tenantId,
                $provider,
                $environment,
            ),
        ];
    }

    /**
     * @return array{appId: string, merchantKey: string, clientId: string, clientSecret: string}
     */
    public function open(
        #[SensitiveParameter] string $ciphertext,
        string $keyVersion,
        string $tenantId,
        string $provider,
        string $environment,
        int $credentialRevision,
    ): array {
        [, $keys] = $this->encryptionKeyMaterial();
        $key = $keys[$keyVersion] ?? null;
        if (! is_string($key)) {
            throw $this->unavailable();
        }

        try {
            $envelope = json_decode($ciphertext, true, 32, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw $this->unavailable();
        }
        if (! is_array($envelope)
            || ($envelope['version'] ?? null) !== self::ENVELOPE_VERSION
            || ($envelope['algorithm'] ?? null) !== self::ALGORITHM) {
            throw $this->unavailable();
        }

        $iv = $this->decodeEnvelopePart($envelope['iv'] ?? null, self::IV_BYTES);
        $tag = $this->decodeEnvelopePart($envelope['tag'] ?? null, self::TAG_BYTES);
        $encrypted = $this->decodeEnvelopePart($envelope['ciphertext'] ?? null);
        $context = $this->context($tenantId, $provider, $environment, $credentialRevision);
        $plaintext = openssl_decrypt(
            $encrypted,
            self::ALGORITHM,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            $this->encode($context),
        );
        if (! is_string($plaintext)) {
            throw $this->unavailable();
        }

        try {
            $decoded = json_decode($plaintext, true, 32, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw $this->unavailable();
        }
        if (! is_array($decoded)
            || ($decoded['schemaVersion'] ?? null) !== self::ENVELOPE_VERSION
            || ! is_array($decoded['context'] ?? null)
            || ! hash_equals($this->encode($context), $this->encode($decoded['context']))
            || ! $this->validCredentialShape($decoded['credentials'] ?? null)) {
            throw $this->unavailable();
        }

        /** @var array{appId: string, merchantKey: string, clientId: string, clientSecret: string} $credentials */
        $credentials = $decoded['credentials'];

        return $credentials;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{fingerprint: string, fingerprintKeyVersion: string}
     */
    public function requestFingerprint(
        #[SensitiveParameter] array $payload,
        ?string $keyVersion = null,
    ): array {
        [$currentVersion, $keys] = $this->fingerprintKeyMaterial();
        $selectedVersion = $keyVersion ?? $currentVersion;
        $key = $keys[$selectedVersion] ?? null;
        if (! is_string($key)) {
            throw $this->unavailable();
        }

        return [
            'fingerprint' => $this->hmac('request', $payload, $key),
            'fingerprintKeyVersion' => $selectedVersion,
        ];
    }

    /**
     * @param  array{appId: string, merchantKey: string, clientId: string, clientSecret: string}  $credentials
     * @return array{fingerprint: string, fingerprintKeyVersion: string}
     */
    public function credentialFingerprint(
        #[SensitiveParameter] array $credentials,
        string $tenantId,
        string $provider,
        string $environment,
        ?string $keyVersion = null,
    ): array {
        [$currentVersion, $keys] = $this->fingerprintKeyMaterial();
        $selectedVersion = $keyVersion ?? $currentVersion;
        $key = $keys[$selectedVersion] ?? null;
        if (! is_string($key)) {
            throw $this->unavailable();
        }

        return [
            'fingerprint' => $this->hmac('credential', [
                'tenantId' => $tenantId,
                'provider' => $provider,
                'environment' => $environment,
                'credentials' => $credentials,
            ], $key),
            'fingerprintKeyVersion' => $selectedVersion,
        ];
    }

    /** @return array{string, array<string, string>} */
    private function encryptionKeyMaterial(): array
    {
        $currentVersion = config('payments.credential_vault.current_key_version');
        $currentValue = config('payments.credential_vault.current_key');
        $previousVersion = config('payments.credential_vault.previous_key_version');
        $previousValue = config('payments.credential_vault.previous_key');

        [$currentVersion, $keys] = $this->buildKeyRing(
            $currentVersion,
            $currentValue,
            $previousVersion,
            $previousValue,
        );
        $keys = $this->mergeRetainedKeys(
            $keys,
            config('payments.credential_vault.retained_keys'),
        );

        return [$currentVersion, $keys];
    }

    /** @return array{string, array<string, string>} */
    private function fingerprintKeyMaterial(): array
    {
        [$currentVersion, $keys] = $this->buildKeyRing(
            config('payments.credential_vault.fingerprint_current_key_version'),
            config('payments.credential_vault.fingerprint_current_key'),
            config('payments.credential_vault.fingerprint_previous_key_version'),
            config('payments.credential_vault.fingerprint_previous_key'),
        );
        $keys = $this->mergeRetainedKeys(
            $keys,
            config('payments.credential_vault.fingerprint_retained_keys'),
        );

        [, $encryptionKeys] = $this->encryptionKeyMaterial();
        foreach ($keys as $fingerprintKey) {
            foreach ($encryptionKeys as $encryptionKey) {
                if (hash_equals($fingerprintKey, $encryptionKey)) {
                    throw $this->unavailable();
                }
            }
        }

        return [$currentVersion, $keys];
    }

    /**
     * @param  array<string, string>  $keys
     * @return array<string, string>
     */
    private function mergeRetainedKeys(array $keys, mixed $configured): array
    {
        if ($configured === null || $configured === '') {
            return $keys;
        }

        if (is_string($configured)) {
            try {
                $configured = json_decode($configured, true, 16, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                throw $this->unavailable();
            }
        }
        if ($configured === []) {
            return $keys;
        }
        if (! is_array($configured) || array_is_list($configured)) {
            throw $this->unavailable();
        }

        foreach ($configured as $version => $value) {
            if (! is_string($version)
                || preg_match('/^[A-Za-z0-9._-]{1,64}$/', $version) !== 1
                || array_key_exists($version, $keys)) {
                throw $this->unavailable();
            }
            $keys[$version] = $this->decodeKey($value);
        }

        return $keys;
    }

    /** @return array{string, array<string, string>} */
    private function buildKeyRing(
        mixed $currentVersion,
        mixed $currentValue,
        mixed $previousVersion,
        mixed $previousValue,
    ): array {
        if (! is_string($currentVersion) || preg_match('/^[A-Za-z0-9._-]{1,64}$/', $currentVersion) !== 1) {
            throw $this->unavailable();
        }

        $keys = [$currentVersion => $this->decodeKey($currentValue)];
        $previousMissing = ($previousVersion === null || $previousVersion === '')
            && ($previousValue === null || $previousValue === '');
        if (! $previousMissing) {
            if (! is_string($previousVersion)
                || preg_match('/^[A-Za-z0-9._-]{1,64}$/', $previousVersion) !== 1
                || $previousVersion === $currentVersion) {
                throw $this->unavailable();
            }
            $keys[$previousVersion] = $this->decodeKey($previousValue);
        }

        return [$currentVersion, $keys];
    }

    private function decodeKey(mixed $value): string
    {
        if (! is_string($value) || ! str_starts_with($value, 'base64:')) {
            throw $this->unavailable();
        }
        $decoded = base64_decode(substr($value, 7), true);
        if (! is_string($decoded) || strlen($decoded) !== 32) {
            throw $this->unavailable();
        }

        return $decoded;
    }

    private function decodeEnvelopePart(mixed $value, ?int $expectedBytes = null): string
    {
        if (! is_string($value)) {
            throw $this->unavailable();
        }
        $decoded = base64_decode($value, true);
        if (! is_string($decoded) || ($expectedBytes !== null && strlen($decoded) !== $expectedBytes)) {
            throw $this->unavailable();
        }

        return $decoded;
    }

    /** @return array{schemaVersion: int, tenantId: string, provider: string, environment: string, credentialRevision: int} */
    private function context(
        string $tenantId,
        string $provider,
        string $environment,
        int $credentialRevision,
    ): array {
        return [
            'schemaVersion' => self::ENVELOPE_VERSION,
            'tenantId' => $tenantId,
            'provider' => $provider,
            'environment' => $environment,
            'credentialRevision' => $credentialRevision,
        ];
    }

    /** @param array<string, mixed> $value */
    private function hmac(string $purpose, array $value, string $key): string
    {
        return hash_hmac('sha256', $purpose."\0".$this->encode($this->normalize($value)), $key);
    }

    private function normalize(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }
        if (array_is_list($value)) {
            return array_map(fn (mixed $item): mixed => $this->normalize($item), $value);
        }
        ksort($value);

        return array_map(fn (mixed $item): mixed => $this->normalize($item), $value);
    }

    private function encode(mixed $value): string
    {
        try {
            return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        } catch (JsonException) {
            throw $this->unavailable();
        }
    }

    private function validCredentialShape(mixed $value): bool
    {
        if (! is_array($value) || array_keys($value) !== ['appId', 'clientId', 'clientSecret', 'merchantKey']) {
            return false;
        }

        return collect($value)->every(static fn (mixed $item): bool => is_string($item) && $item !== '');
    }

    private function unavailable(): PaymentConnectionConflict
    {
        return new PaymentConnectionConflict(
            'Payment credential storage is unavailable.',
            'payment_connection_unavailable',
            503,
        );
    }
}
