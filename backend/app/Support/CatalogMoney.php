<?php

namespace App\Support;

use InvalidArgumentException;

final class CatalogMoney
{
    /** @var list<string> */
    public const CURRENCIES = ['YER', 'SAR', 'USD'];

    public static function parse(string $amount): int
    {
        if (! preg_match('/^(0|[1-9][0-9]{0,7})(?:\.([0-9]{1,2}))?$/', $amount, $matches)) {
            throw new InvalidArgumentException('Money must be a canonical decimal string with at most two fractional digits.');
        }

        $fraction = str_pad($matches[2] ?? '', 2, '0');

        return ((int) $matches[1] * 100) + (int) $fraction;
    }

    public static function format(int $minor): string
    {
        if ($minor < 0) {
            throw new InvalidArgumentException('Money may not be negative.');
        }

        return intdiv($minor, 100).'.'.str_pad((string) ($minor % 100), 2, '0', STR_PAD_LEFT);
    }

    public static function normalizeCurrency(string $currency): string
    {
        $value = mb_strtoupper(trim($currency));

        return match ($value) {
            'YER', 'ر.ي', 'ر. ي', 'ريال يمني' => 'YER',
            'SAR', 'ر.س', 'ر. س', 'ريال سعودي' => 'SAR',
            'USD', '$', 'US$' => 'USD',
            default => throw new InvalidArgumentException('The catalog currency is not supported.'),
        };
    }
}
