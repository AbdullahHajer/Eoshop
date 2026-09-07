<?php

namespace App\Enums;

enum MarketingCampaignState: string
{
    case Draft = 'draft';
    case Active = 'active';
    case Paused = 'paused';
    case Ended = 'ended';
    case Archived = 'archived';
}
