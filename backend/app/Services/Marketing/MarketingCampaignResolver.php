<?php

namespace App\Services\Marketing;

use App\Models\Domain;
use App\Models\Tenant;
use App\Support\MarketingCampaignContract;
use App\Support\MarketingCampaignSchema;
use App\Support\TenantRuntimeReadiness;
use Illuminate\Support\Facades\DB;

final class MarketingCampaignResolver
{
    public function __construct(private readonly MarketingCampaignEligibility $eligibility) {}

    /**
     * This core service returns an internal redirect decision only. HTTP route wiring and
     * touch/attribution are intentionally outside T2.
     *
     * @return array{status: int, location: ?string, linkId: ?string, campaignId: ?string, eligible: bool}
     */
    public function resolve(Tenant $tenant, string $host, string $opaqueToken): array
    {
        if (! MarketingCampaignContract::validOpaqueToken($opaqueToken)) {
            return $this->notFound();
        }
        $domain = Domain::query()->where('tenant_id', $tenant->getKey())
            ->where('domain', strtolower(rtrim($host, '.')))->first();
        if (! $domain instanceof Domain) {
            return $this->notFound();
        }
        if (! $tenant->database()->manager()->databaseExists((string) $tenant->database()->getName())) {
            return $this->fallback();
        }
        $storePublished = (string) $tenant->getAttribute('published_domain_id') === (string) $domain->getKey()
            && TenantRuntimeReadiness::check($tenant, (string) $domain->domain);

        return $tenant->run(function () use ($opaqueToken, $storePublished): array {
            if (! MarketingCampaignSchema::ready()) {
                return $this->fallback();
            }

            return DB::connection('tenant')->transaction(function () use ($opaqueToken, $storePublished): array {
                DB::connection('tenant')->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
                $row = DB::connection('tenant')->table('marketing_channel_links as links')
                    ->join('marketing_campaigns as campaigns', 'campaigns.id', '=', 'links.campaign_id')
                    ->where('links.token_hash', hash('sha256', $opaqueToken))
                    ->select([
                        'links.id as link_id', 'links.utm_source', 'links.utm_medium',
                        'links.utm_campaign', 'links.utm_content', 'campaigns.*',
                    ])->first();
                if ($row === null) {
                    return $this->notFound();
                }
                $eligible = MarketingCampaignContract::effectiveState($row) === 'active'
                    && $this->eligibility->reasons($row, $storePublished) === [];
                if (! $eligible) {
                    return $this->fallback();
                }

                $path = match ((string) $row->target_type) {
                    'store' => '/',
                    'product' => '/products/'.rawurlencode((string) $row->target_value),
                    'category' => '/products',
                    default => throw new \LogicException('Unsupported campaign target type.'),
                };
                $query = [];
                if ($row->target_type === 'category') {
                    $query['category'] = (string) $row->target_value;
                }
                $query += [
                    'utm_source' => (string) $row->utm_source,
                    'utm_medium' => (string) $row->utm_medium,
                    'utm_campaign' => (string) $row->utm_campaign,
                    'utm_content' => (string) $row->utm_content,
                ];
                if ($row->coupon_code !== null) {
                    $query['coupon'] = (string) $row->coupon_code;
                }

                return [
                    'status' => 302,
                    'location' => $path.'?'.http_build_query($query, '', '&', PHP_QUERY_RFC3986),
                    'linkId' => (string) $row->link_id,
                    'campaignId' => (string) $row->id,
                    'eligible' => true,
                ];
            });
        });
    }

    /** @return array{status: int, location: null, linkId: null, campaignId: null, eligible: false} */
    private function notFound(): array
    {
        return ['status' => 404, 'location' => null, 'linkId' => null, 'campaignId' => null, 'eligible' => false];
    }

    /** @return array{status: int, location: string, linkId: null, campaignId: null, eligible: false} */
    private function fallback(): array
    {
        return ['status' => 302, 'location' => '/', 'linkId' => null, 'campaignId' => null, 'eligible' => false];
    }
}
