<?php

namespace App\Enums;

enum ProductMediaSource: string
{
    case Managed = 'managed';
    case External = 'external';
}
