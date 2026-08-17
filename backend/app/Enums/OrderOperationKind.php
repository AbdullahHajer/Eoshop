<?php

namespace App\Enums;

enum OrderOperationKind: string
{
    case Create = 'create';
    case Transition = 'transition';
    case Expire = 'expire';
}
