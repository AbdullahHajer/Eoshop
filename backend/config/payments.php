<?php

return [
    'credential_vault' => [
        'current_key_version' => env('PAYMENT_CREDENTIAL_VAULT_CURRENT_VERSION'),
        'current_key' => env('PAYMENT_CREDENTIAL_VAULT_CURRENT_KEY'),
        'previous_key_version' => env('PAYMENT_CREDENTIAL_VAULT_PREVIOUS_VERSION'),
        'previous_key' => env('PAYMENT_CREDENTIAL_VAULT_PREVIOUS_KEY'),
        // Keep old encryption keys only until every referencing row is rewrapped.
        'retained_keys' => env('PAYMENT_CREDENTIAL_VAULT_RETAINED_KEYS_JSON'),
        'fingerprint_current_key_version' => env('PAYMENT_FINGERPRINT_CURRENT_VERSION'),
        'fingerprint_current_key' => env('PAYMENT_FINGERPRINT_CURRENT_KEY'),
        'fingerprint_previous_key_version' => env('PAYMENT_FINGERPRINT_PREVIOUS_VERSION'),
        'fingerprint_previous_key' => env('PAYMENT_FINGERPRINT_PREVIOUS_KEY'),
        // Retain every fingerprint key version referenced by an idempotency receipt.
        // This is a JSON object of key-version => base64:encoded-key pairs.
        'fingerprint_retained_keys' => env('PAYMENT_FINGERPRINT_RETAINED_KEYS_JSON'),
    ],
];
