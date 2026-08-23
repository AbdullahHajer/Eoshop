<?php

namespace App\Support;

use InvalidArgumentException;

final class AccountPhone
{
    public static function normalize(mixed $value): ?string
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }

        $phone = trim((string) $value);
        if (mb_strlen($phone) > 32 || preg_match('/[^0-9+().\-\s]/u', $phone) === 1) {
            throw new InvalidArgumentException('رقم الهاتف غير صالح.');
        }

        $compact = preg_replace('/[().\-\s]/u', '', $phone);
        if (! is_string($compact)) {
            throw new InvalidArgumentException('رقم الهاتف غير صالح.');
        }
        if (str_starts_with($compact, '00967')) {
            $compact = '+967'.substr($compact, 5);
        } elseif (! str_starts_with($compact, '+')) {
            $digits = str_starts_with($compact, '0') ? substr($compact, 1) : $compact;
            if (preg_match('/^[1-9][0-9]{8}$/', $digits) !== 1) {
                throw new InvalidArgumentException('استخدم رقمًا يمنيًا محليًا من 9 أرقام أو صيغة دولية صحيحة.');
            }
            $compact = '+967'.$digits;
        }

        if (preg_match('/^\+[1-9][0-9]{7,14}$/', $compact) !== 1) {
            throw new InvalidArgumentException('رقم الهاتف الدولي غير صالح.');
        }

        return $compact;
    }
}
