<?php

namespace App\Enums;

enum InventoryMovementKind: string
{
    case Opening = 'opening';
    case Receive = 'receive';
    case Issue = 'issue';
    case Return = 'return';
    case Correction = 'correction';
    case Reserve = 'reserve';
    case Release = 'release';
    case Commit = 'commit';
    case Expire = 'expire';
}
