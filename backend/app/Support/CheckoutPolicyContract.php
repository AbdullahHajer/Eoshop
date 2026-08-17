<?php

namespace App\Support;

use Illuminate\Validation\Validator;

final class CheckoutPolicyContract
{
    private const DEMO_ACCOUNTS = [
        '123456789012', 'SA9480000000123456789012', '0501234567', '30678912',
        '770123456', '779876543', '771122334',
    ];

    /** @param array<string, mixed> $config */
    public static function bankIsUsable(array $config): bool
    {
        $account = trim((string) ($config['bankAccountNumber'] ?? ''));
        $iban = trim((string) ($config['bankIban'] ?? ''));

        return ($config['enableBankTransfer'] ?? false) === true
            && trim((string) ($config['bankName'] ?? '')) !== ''
            && trim((string) ($config['bankAccountName'] ?? '')) !== ''
            && ($account !== '' || $iban !== '')
            && ! in_array($account, self::DEMO_ACCOUNTS, true)
            && ! in_array($iban, self::DEMO_ACCOUNTS, true);
    }

    /** @param array<string, mixed> $wallet */
    public static function walletIsUsable(array $wallet): bool
    {
        $account = trim((string) ($wallet['accountNumber'] ?? ''));

        return ($wallet['active'] ?? false) === true
            && trim((string) ($wallet['id'] ?? '')) !== ''
            && trim((string) ($wallet['name'] ?? '')) !== ''
            && $account !== ''
            && trim((string) ($wallet['accountName'] ?? '')) !== ''
            && ! in_array($account, self::DEMO_ACCOUNTS, true);
    }

    /** @param array<string, mixed> $config */
    public static function appendErrors(Validator $validator, array $config): void
    {
        if (($config['enableBankTransfer'] ?? false) === true) {
            if (trim((string) ($config['bankName'] ?? '')) === '') {
                $validator->errors()->add('config.bankName', 'An enabled bank transfer requires a bank name.');
            }
            if (trim((string) ($config['bankAccountName'] ?? '')) === '') {
                $validator->errors()->add('config.bankAccountName', 'An enabled bank transfer requires an account holder name.');
            }
            if (! self::bankIsUsable($config)) {
                $validator->errors()->add('config.bankAccountNumber', 'An enabled bank transfer requires a non-demo IBAN or account number.');
            }
        }

        if (($config['enableEWallets'] ?? false) === true) {
            $active = array_filter(
                is_array($config['customWallets'] ?? null) ? $config['customWallets'] : [],
                static fn (mixed $wallet): bool => is_array($wallet) && ($wallet['active'] ?? false) === true,
            );
            $valid = array_filter($active, self::walletIsUsable(...));
            if (count($valid) !== count($active) || $valid === []) {
                $validator->errors()->add('config.customWallets', 'Enabled wallets require at least one complete active wallet account.');
            }
        }
    }
}
