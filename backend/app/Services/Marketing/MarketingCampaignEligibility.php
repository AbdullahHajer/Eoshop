<?php

namespace App\Services\Marketing;

use App\Enums\MarketingCampaignTargetType;
use App\Enums\ProductStatus;
use App\Exceptions\MarketingCampaignConflict;
use App\Support\MarketingCampaignContract;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use JsonException;

final class MarketingCampaignEligibility
{
    /** @return list<string> */
    public function reasons(object $campaign, bool $storePublished, bool $lock = false): array
    {
        $reasons = [];
        if (! $storePublished) {
            $reasons[] = 'store_unpublished';
        }
        if (! $this->targetAvailable($campaign, $lock)) {
            $reasons[] = 'target_unavailable';
        }
        if (! $this->couponAvailable($campaign, $lock)) {
            $reasons[] = 'coupon_invalid';
        }

        return $reasons;
    }

    public function assertTargetAvailable(object $campaign, bool $lock = false): void
    {
        if (! $this->targetAvailable($campaign, $lock)) {
            throw new MarketingCampaignConflict('The campaign target is unavailable.', 'campaign_target_unavailable', 422);
        }
    }

    public function assertEligible(object $campaign, bool $storePublished, bool $lock = false): void
    {
        $reason = $this->reasons($campaign, $storePublished, $lock)[0] ?? null;
        if ($reason === null) {
            return;
        }

        throw match ($reason) {
            'store_unpublished' => new MarketingCampaignConflict('The store must be published.', 'campaign_store_unpublished', 422),
            'target_unavailable' => new MarketingCampaignConflict('The campaign target is unavailable.', 'campaign_target_unavailable', 422),
            default => new MarketingCampaignConflict('The campaign coupon is invalid.', 'campaign_coupon_invalid', 422),
        };
    }

    private function targetAvailable(object $campaign, bool $lock): bool
    {
        $type = MarketingCampaignTargetType::from((string) $campaign->target_type);
        if ($type === MarketingCampaignTargetType::Store) {
            return true;
        }
        if ($type === MarketingCampaignTargetType::Product) {
            $query = DB::connection('tenant')->table('products')
                ->where('id', $campaign->target_value)
                ->where('status', ProductStatus::Published->value);
            $this->lock($query, $lock);

            return $query->exists();
        }

        $query = DB::connection('tenant')->table('products')
            ->where('status', ProductStatus::Published->value)
            ->whereNotNull('category');
        $this->lock($query, $lock);

        return $query->pluck('category')->contains(
            fn (mixed $category): bool => is_string($category)
                && MarketingCampaignContract::canonicalCategory($category) === (string) $campaign->target_value,
        );
    }

    private function couponAvailable(object $campaign, bool $lock): bool
    {
        if ($campaign->coupon_code === null) {
            return true;
        }
        $query = DB::connection('tenant')->table('store_configs')->where('is_current', true);
        $this->lock($query, $lock);
        $row = $query->first();
        if ($row === null) {
            return false;
        }
        try {
            $config = json_decode((string) $row->config_json, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return false;
        }
        if (($config['enableCoupons'] ?? false) !== true || ! is_array($config['customCoupons'] ?? null)) {
            return false;
        }

        return collect($config['customCoupons'])->contains(static fn (mixed $coupon): bool => is_array($coupon)
            && ($coupon['active'] ?? false) === true
            && mb_strtoupper(trim((string) ($coupon['code'] ?? ''))) === (string) $campaign->coupon_code);
    }

    private function lock(Builder $query, bool $lock): void
    {
        if ($lock) {
            $query->lockForUpdate();
        }
    }
}
