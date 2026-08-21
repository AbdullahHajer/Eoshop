<?php

namespace App\Enums;

enum PlatformAttentionQueue: string
{
    case Review = 'review';
    case Provisioning = 'provisioning';
    case Subscription = 'subscription';
    case Publication = 'publication';
}
