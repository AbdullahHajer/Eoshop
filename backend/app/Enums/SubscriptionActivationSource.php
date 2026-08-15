<?php

namespace App\Enums;

enum SubscriptionActivationSource: string
{
    case AutomaticFree = 'automatic_free';
    case ManualPending = 'manual_pending';
    case ManualAdmin = 'manual_admin';
    case Wp23Adopted = 'wp23_adopted';
}
