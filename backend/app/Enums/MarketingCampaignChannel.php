<?php

namespace App\Enums;

enum MarketingCampaignChannel: string
{
    case Instagram = 'instagram';
    case Facebook = 'facebook';
    case WhatsApp = 'whatsapp';
    case Google = 'google';
    case Email = 'email';
    case Other = 'other';
}
