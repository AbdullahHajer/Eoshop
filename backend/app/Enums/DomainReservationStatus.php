<?php

namespace App\Enums;

enum DomainReservationStatus: string
{
    case Reserved = 'reserved';
    case Active = 'active';
    case Released = 'released';
}
