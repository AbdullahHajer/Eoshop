<?php

namespace App\Enums;

enum DomainReservationOrigin: string
{
    case UserSelected = 'user_selected';
    case Wp22Internal = 'wp22_internal';
}
