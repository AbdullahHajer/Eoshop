<?php

namespace App\Enums;

enum SubscriptionStatus: string
{
    case PendingActivation = 'pending_activation';
    case Active = 'active';
    case Cancelled = 'cancelled';
    case Expired = 'expired';
}
