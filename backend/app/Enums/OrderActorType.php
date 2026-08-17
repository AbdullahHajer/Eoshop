<?php

namespace App\Enums;

enum OrderActorType: string
{
    case Guest = 'guest';
    case User = 'user';
    case System = 'system';
}
