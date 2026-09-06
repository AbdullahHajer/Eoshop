<?php

namespace App\Enums;

enum OrderFulfillmentStatus: string
{
    case Unfulfilled = 'unfulfilled';
    case Preparing = 'preparing';
    case Dispatched = 'dispatched';
    case Delivered = 'delivered';
    case LegacyCompleted = 'legacy_completed';
}
