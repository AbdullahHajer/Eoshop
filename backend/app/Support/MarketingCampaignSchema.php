<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class MarketingCampaignSchema
{
    public static function ready(): bool
    {
        foreach (['marketing_campaign_registry', 'marketing_campaigns', 'marketing_channel_links', 'marketing_campaign_operations', 'marketing_campaign_events'] as $table) {
            if (! Schema::connection('tenant')->hasTable($table)) {
                return false;
            }
        }

        return DB::connection('tenant')->table('marketing_campaign_registry')->where('id', 1)->count() === 1;
    }
}
