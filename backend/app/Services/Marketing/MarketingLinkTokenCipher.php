<?php

namespace App\Services\Marketing;

use Illuminate\Encryption\Encrypter;
use RuntimeException;

final class MarketingLinkTokenCipher
{
    /** @return array{ciphertext: string, keyId: string} */
    public function encrypt(string $token): array
    {
        [$keyId, $key] = $this->currentKey();

        return [
            'ciphertext' => $this->encrypter($key)->encryptString($token),
            'keyId' => $keyId,
        ];
    }

    public function decrypt(string $ciphertext, string $keyId): string
    {
        foreach ($this->availableKeys() as $candidateId => $key) {
            if (hash_equals($candidateId, $keyId)) {
                return $this->encrypter($key)->decryptString($ciphertext);
            }
        }

        throw new RuntimeException('The marketing link token key is unavailable.');
    }

    /** @return array{ciphertext: string, keyId: string}|null */
    public function reencryptIfPrevious(string $ciphertext, string $keyId): ?array
    {
        [$currentId] = $this->currentKey();
        if (hash_equals($currentId, $keyId)) {
            return null;
        }

        return $this->encrypt($this->decrypt($ciphertext, $keyId));
    }

    public function currentKeyId(): string
    {
        return $this->currentKey()[0];
    }

    /** @return array{string, string} */
    private function currentKey(): array
    {
        $id = config('marketing_campaigns.link_token.current_key_id');
        $key = config('marketing_campaigns.link_token.current_key');
        if (! is_string($id) || $id === '' || strlen($id) > 32 || ! is_string($key) || $key === '') {
            throw new RuntimeException('The current marketing link token key is invalid.');
        }

        return [$id, $key];
    }

    /** @return array<string, string> */
    private function availableKeys(): array
    {
        [$currentId, $currentKey] = $this->currentKey();
        $keys = [$currentId => $currentKey];
        $previousId = config('marketing_campaigns.link_token.previous_key_id');
        $previousKey = config('marketing_campaigns.link_token.previous_key');
        if (is_string($previousId) && $previousId !== '' && is_string($previousKey) && $previousKey !== '') {
            $keys[$previousId] = $previousKey;
        }

        return $keys;
    }

    private function encrypter(string $key): Encrypter
    {
        $decoded = str_starts_with($key, 'base64:') ? base64_decode(substr($key, 7), true) : $key;
        if (! is_string($decoded) || strlen($decoded) !== 32) {
            throw new RuntimeException('Marketing link token keys must contain exactly 32 bytes.');
        }

        return new Encrypter($decoded, 'AES-256-CBC');
    }
}
