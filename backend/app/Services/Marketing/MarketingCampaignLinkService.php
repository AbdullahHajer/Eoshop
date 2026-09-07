<?php

namespace App\Services\Marketing;

use App\Enums\MarketingCampaignState;
use App\Exceptions\MarketingCampaignConflict;
use App\Models\Domain;
use App\Models\Tenant;
use App\Models\User;
use App\Support\MarketingCampaignContract;
use App\Support\MarketingCampaignSchema;
use App\Support\TenantRuntimeReadiness;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class MarketingCampaignLinkService
{
    public function __construct(
        private readonly MarketingTenantAccess $access,
        private readonly MarketingCampaignOperationService $operations,
        private readonly MarketingLinkTokenCipher $cipher,
    ) {}

    /** @return array<string, mixed> */
    public function create(Tenant $tenant, User $actor, string $campaignId, mixed $channelInput, string $idempotencyKey): array
    {
        $channel = MarketingCampaignContract::channel($channelInput);
        $idempotencyKey = MarketingCampaignContract::idempotencyKey($idempotencyKey);

        return $this->access->forManager($tenant, $actor, function (Tenant $lockedTenant) use ($actor, $campaignId, $channel, $idempotencyKey): array {
            $domain = $this->publishedDomain($lockedTenant);
            if ($domain === null || ! TenantRuntimeReadiness::check($lockedTenant, (string) $domain->domain)) {
                throw new MarketingCampaignConflict('The store must be published before creating campaign links.', 'campaign_store_unpublished', 422);
            }
            $host = (string) $domain->domain;

            return $lockedTenant->run(fn (): array => DB::connection('tenant')->transaction(
                function () use ($actor, $campaignId, $channel, $idempotencyKey, $host): array {
                    $this->assertReady();
                    $campaign = DB::connection('tenant')->table('marketing_campaigns')
                        ->where('id', $campaignId)->lockForUpdate()->first();
                    if ($campaign === null) {
                        throw new MarketingCampaignConflict('The campaign was not found.', 'campaign_not_found', 404);
                    }
                    if (MarketingCampaignContract::effectiveState($campaign) === MarketingCampaignState::Archived->value) {
                        throw new MarketingCampaignConflict('Archived campaigns cannot create links.', 'campaign_state_transition_invalid');
                    }
                    $payload = ['campaignId' => $campaignId, 'channel' => $channel->value];
                    $claim = $this->operations->claim('channel_link.create', $campaignId, $idempotencyKey, $payload);
                    if ($claim['replayed']) {
                        $linkId = $this->operations->replayResourceId($claim['operation'], 'channel_link');
                        $link = $this->link($linkId);
                        $result = $this->compose($link, $host);
                        $result['replayed'] = true;

                        return $result;
                    }

                    $limit = (int) config('marketing_campaigns.max_links_per_campaign', 8);
                    if (DB::connection('tenant')->table('marketing_channel_links')->where('campaign_id', $campaignId)->count() >= $limit) {
                        throw new MarketingCampaignConflict('The campaign link quota is exhausted.', 'campaign_link_quota_exceeded', 422);
                    }
                    $id = (string) Str::uuid();
                    $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
                    $encrypted = $this->cipher->encrypt($token);
                    $utm = MarketingCampaignContract::channelUtm($channel);
                    $now = now('UTC');
                    DB::connection('tenant')->table('marketing_channel_links')->insert([
                        'id' => $id,
                        'campaign_id' => $campaignId,
                        'channel' => $channel->value,
                        'token_hash' => hash('sha256', $token),
                        'token_ciphertext' => $encrypted['ciphertext'],
                        'token_key_id' => $encrypted['keyId'],
                        'utm_source' => $utm['source'],
                        'utm_medium' => $utm['medium'],
                        'utm_campaign' => 'cmp_'.$campaignId,
                        'utm_content' => 'lnk_'.$id,
                        'created_by_ulid' => (string) $actor->getKey(),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $this->operations->complete((string) $claim['operation']->id, 'channel_link', $id);
                    $result = $this->compose($this->link($id), $host);
                    $result['replayed'] = false;

                    return $result;
                },
            ));
        });
    }

    /** @return list<array<string, mixed>> */
    public function list(Tenant $tenant, User $actor, string $campaignId): array
    {
        return $this->access->forManager($tenant, $actor, function (Tenant $lockedTenant) use ($campaignId): array {
            $domain = $this->publishedDomain($lockedTenant);
            $host = $domain === null ? null : (string) $domain->domain;

            return $lockedTenant->run(function () use ($campaignId, $host): array {
                $this->assertReady();
                if (! DB::connection('tenant')->table('marketing_campaigns')->where('id', $campaignId)->exists()) {
                    throw new MarketingCampaignConflict('The campaign was not found.', 'campaign_not_found', 404);
                }

                return DB::connection('tenant')->table('marketing_channel_links')
                    ->where('campaign_id', $campaignId)
                    ->orderBy('created_at')
                    ->orderBy('id')
                    ->get()
                    ->map(fn (object $link): array => $this->compose($link, $host))
                    ->all();
            });
        });
    }

    public function reencryptPreviousTokens(Tenant $tenant, User $actor, int $limit = 100): int
    {
        $limit = max(1, min($limit, 500));

        return $this->access->forManager($tenant, $actor, fn (Tenant $lockedTenant): int => $lockedTenant->run(
            fn (): int => DB::connection('tenant')->transaction(function () use ($limit): int {
                $this->assertReady();
                $links = DB::connection('tenant')->table('marketing_channel_links')
                    ->where('token_key_id', '!=', $this->cipher->currentKeyId())
                    ->orderBy('id')->limit($limit)->lockForUpdate()->get();
                $updated = 0;
                foreach ($links as $link) {
                    $replacement = $this->cipher->reencryptIfPrevious(
                        (string) $link->token_ciphertext,
                        (string) $link->token_key_id,
                    );
                    if ($replacement === null) {
                        continue;
                    }
                    DB::connection('tenant')->table('marketing_channel_links')->where('id', $link->id)->update([
                        'token_ciphertext' => $replacement['ciphertext'],
                        'token_key_id' => $replacement['keyId'],
                        'updated_at' => now('UTC'),
                    ]);
                    $updated++;
                }

                return $updated;
            }),
        ));
    }

    private function assertReady(): void
    {
        if (! MarketingCampaignSchema::ready()) {
            throw new MarketingCampaignConflict('The tenant marketing campaign schema is not ready.', 'marketing_campaigns_not_ready');
        }
    }

    private function link(string $linkId): object
    {
        $link = DB::connection('tenant')->table('marketing_channel_links')->where('id', $linkId)->first();
        if ($link === null) {
            throw new MarketingCampaignConflict('The campaign link was not found.', 'campaign_link_not_found', 404);
        }

        return $link;
    }

    private function publishedDomain(Tenant $tenant): ?Domain
    {
        return Domain::query()
            ->whereKey($tenant->getAttribute('published_domain_id'))
            ->where('tenant_id', $tenant->getKey())
            ->first();
    }

    /** @return array<string, mixed> */
    private function compose(object $link, ?string $host): array
    {
        $token = $this->cipher->decrypt((string) $link->token_ciphertext, (string) $link->token_key_id);

        return [
            'id' => (string) $link->id,
            'campaignId' => (string) $link->campaign_id,
            'channel' => (string) $link->channel,
            'url' => $host === null ? null : 'https://'.$host.'/c/'.$token,
            'utm' => [
                'source' => (string) $link->utm_source,
                'medium' => (string) $link->utm_medium,
                'campaign' => (string) $link->utm_campaign,
                'content' => (string) $link->utm_content,
            ],
            'createdBy' => (string) $link->created_by_ulid,
            'createdAt' => CarbonImmutable::parse((string) $link->created_at)->utc()->format('Y-m-d\TH:i:s.u\Z'),
        ];
    }
}
