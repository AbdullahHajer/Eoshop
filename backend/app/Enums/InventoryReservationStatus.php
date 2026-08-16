<?php

namespace App\Enums;

enum InventoryReservationStatus: string
{
    case Active = 'active';
    case Committed = 'committed';
    case Released = 'released';
    case Expired = 'expired';
}
