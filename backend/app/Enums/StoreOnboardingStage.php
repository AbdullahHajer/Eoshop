<?php

namespace App\Enums;

enum StoreOnboardingStage: string
{
    case Business = 'business';
    case Design = 'design';
    case Review = 'review';

    public function rank(): int
    {
        return match ($this) {
            self::Business => 1,
            self::Design => 2,
            self::Review => 3,
        };
    }
}
