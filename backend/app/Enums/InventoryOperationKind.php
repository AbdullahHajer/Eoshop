<?php

namespace App\Enums;

enum InventoryOperationKind: string
{
    case Opening = 'opening';
    case ManualAdjustment = 'manual_adjustment';
    case PolicyUpdate = 'policy_update';
    case ReservationCreate = 'reservation_create';
    case ReservationRelease = 'reservation_release';
    case ReservationCommit = 'reservation_commit';
    case ReservationExpire = 'reservation_expire';
}
