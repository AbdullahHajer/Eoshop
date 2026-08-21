<?php

namespace App\Support;

final class SqlLikePattern
{
    public static function containsLiteral(string $value): string
    {
        return '%'.strtr($value, [
            '\\' => '\\\\',
            '%' => '\\%',
            '_' => '\\_',
        ]).'%';
    }
}
