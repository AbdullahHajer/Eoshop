<?php

namespace App\Enums;

enum MarketingCampaignTargetType: string
{
    case Store = 'store';
    case Category = 'category';
    case Product = 'product';
}
