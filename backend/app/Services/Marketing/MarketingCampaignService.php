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
use Illuminate\Validation\ValidationException;

final class MarketingCampaignService
{
    public function __construct(
        private readonly MarketingTenantAccess $access,
        private readonly MarketingCampaignOperationService $operations,
        private readonly MarketingCampaignEligibility $eligibility,
    ) {}

    /** @return list<array<string, mixed>> */
    public function list(Tenant $tenant, User $actor): array
    {
        return $this->access->forManager($tenant, $actor, function (Tenant $lockedTenant): array {
            $storePublished = $this->storePublished($lockedTenant);

            return $lockedTenant->run(function () use ($storePublished): array {
                $this->assertReady();

                return DB::connection('tenant')->transaction(function () use ($storePublished): array {
                    DB::connection('tenant')->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');

                    return DB::connection('tenant')->table('marketing_campaigns')
                        ->orderByDesc('created_at')
                        ->orderBy('id')
                        ->get()
                        ->map(fn (object $campaign): array => $this->compose($campaign, $storePublished))
                        ->all();
                });
            });
        });
    }

    /** @return array<string, mixed> */
    public function read(Tenant $tenant, User $actor, string $campaignId): array
    {
        return $this->access->forManager($tenant, $actor, function (Tenant $lockedTenant) use ($campaignId): array {
            $storePublished = $this->storePublished($lockedTenant);

            return $lockedTenant->run(function () use ($campaignId, $storePublished): array {
                $this->assertReady();
                $campaign = DB::connection('tenant')->table('marketing_campaigns')->where('id', $campaignId)->first();
                if ($campaign === null) {
                    throw new MarketingCampaignConflict('The campaign was not found.', 'campaign_not_found', 404);
                }

                return $this->compose($campaign, $storePublished);
            });
        });
    }

    /** @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function create(Tenant $tenant, User $actor, array $payload, string $idempotencyKey): array
    {
        $normalized = MarketingCampaignContract::createPayload($payload);
        $idempotencyKey = MarketingCampaignContract::idempotencyKey($idempotencyKey);

        return $this->access->forManager($tenant, $actor, function (Tenant $lockedTenant) use ($actor, $normalized, $idempotencyKey): array {
            $storePublished = $this->storePublished($lockedTenant);

            return $lockedTenant->run(fn (): array => DB::connection('tenant')->transaction(
                function () use ($actor, $normalized, $idempotencyKey, $storePublished): array {
                    $this->assertReady();
                    $claim = $this->operations->claim(
                        'campaign.create',
                        MarketingCampaignContract::TENANT_SCOPE_ID,
                        $idempotencyKey,
                        $normalized,
                    );
                    if ($claim['replayed']) {
                        $campaignId = $this->operations->replayResourceId($claim['operation'], 'campaign');
                        $campaign = $this->campaign($campaignId, false);
                        $result = $this->compose($campaign, $storePublished);
                        $result['replayed'] = true;

                        return $result;
                    }

                    $registry = DB::connection('tenant')->table('marketing_campaign_registry')->where('id', 1)->lockForUpdate()->first();
                    if ($registry === null) {
                        throw new MarketingCampaignConflict('The campaign registry is unavailable.', 'marketing_campaigns_not_ready', 503);
                    }
                    $limit = (int) config('marketing_campaigns.max_campaigns', 20);
                    $count = DB::connection('tenant')->table('marketing_campaigns')->where('state', '!=', MarketingCampaignState::Archived->value)->count();
                    if ($count >= $limit) {
                        throw new MarketingCampaignConflict('The store campaign quota is exhausted.', 'campaign_quota_exceeded', 422);
                    }

                    $id = (string) Str::uuid();
                    $candidate = (object) [
                        'target_type' => $normalized['targetType'],
                        'target_value' => $normalized['targetValue'],
                        'coupon_code' => $normalized['couponCode'],
                    ];
                    $this->eligibility->assertEligible($candidate, true, true);
                    $now = now('UTC');
                    DB::connection('tenant')->table('marketing_campaigns')->insert([
                        'id' => $id,
                        'name' => $normalized['name'],
                        'objective' => $normalized['objective'],
                        'state' => MarketingCampaignState::Draft->value,
                        'starts_at' => $normalized['startsAt'],
                        'ends_at' => $normalized['endsAt'],
                        'target_type' => $normalized['targetType'],
                        'target_value' => $normalized['targetValue'],
                        'coupon_code' => $normalized['couponCode'],
                        'revision' => 1,
                        'created_by_ulid' => (string) $actor->getKey(),
                        'updated_by_ulid' => (string) $actor->getKey(),
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $this->event($id, 'created', null, 'draft', 1, (string) $actor->getKey());
                    $this->operations->complete((string) $claim['operation']->id, 'campaign', $id);
                    $result = $this->compose($this->campaign($id, false), $storePublished);
                    $result['replayed'] = false;

                    return $result;
                },
            ));
        });
    }

    /** @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function update(Tenant $tenant, User $actor, string $campaignId, int $expectedRevision, array $payload): array
    {
        if ($expectedRevision < 1) {
            throw ValidationException::withMessages(['revision' => ['The campaign revision must be positive.']]);
        }
        $patch = MarketingCampaignContract::patchPayload($payload);

        return $this->access->forManager($tenant, $actor, function (Tenant $lockedTenant) use ($actor, $campaignId, $expectedRevision, $patch): array {
            $storePublished = $this->storePublished($lockedTenant);

            return $lockedTenant->run(fn (): array => DB::connection('tenant')->transaction(
                function () use ($actor, $campaignId, $expectedRevision, $patch, $storePublished): array {
                    $this->assertReady();
                    $campaign = $this->campaign($campaignId, true);
                    $this->assertRevision($campaign, $expectedRevision);
                    $effective = MarketingCampaignContract::effectiveState($campaign);
                    if (! in_array($effective, ['draft', 'paused'], true)) {
                        throw new MarketingCampaignConflict('The campaign cannot be edited in its current state.', 'campaign_state_transition_invalid');
                    }

                    $next = [
                        'name' => (string) $campaign->name,
                        'objective' => (string) $campaign->objective,
                        'startsAt' => $this->date($campaign->starts_at),
                        'endsAt' => $this->date($campaign->ends_at),
                        'targetType' => (string) $campaign->target_type,
                        'targetValue' => $campaign->target_value === null ? null : (string) $campaign->target_value,
                        'couponCode' => $campaign->coupon_code === null ? null : (string) $campaign->coupon_code,
                    ];
                    $next = array_replace($next, $patch);
                    MarketingCampaignContract::assertSchedule($next['startsAt'], $next['endsAt']);
                    $candidate = (object) [
                        'target_type' => $next['targetType'],
                        'target_value' => $next['targetValue'],
                        'coupon_code' => $next['couponCode'],
                    ];
                    $this->eligibility->assertEligible($candidate, true, true);
                    $current = [
                        'name' => (string) $campaign->name,
                        'objective' => (string) $campaign->objective,
                        'startsAt' => $this->date($campaign->starts_at),
                        'endsAt' => $this->date($campaign->ends_at),
                        'targetType' => (string) $campaign->target_type,
                        'targetValue' => $campaign->target_value === null ? null : (string) $campaign->target_value,
                        'couponCode' => $campaign->coupon_code === null ? null : (string) $campaign->coupon_code,
                    ];
                    if ($current === $next) {
                        return $this->compose($campaign, $storePublished);
                    }

                    $revision = (int) $campaign->revision + 1;
                    DB::connection('tenant')->table('marketing_campaigns')->where('id', $campaignId)->update([
                        'name' => $next['name'],
                        'objective' => $next['objective'],
                        'starts_at' => $next['startsAt'],
                        'ends_at' => $next['endsAt'],
                        'target_type' => $next['targetType'],
                        'target_value' => $next['targetValue'],
                        'coupon_code' => $next['couponCode'],
                        'revision' => $revision,
                        'updated_by_ulid' => (string) $actor->getKey(),
                        'updated_at' => now('UTC'),
                    ]);
                    $this->event($campaignId, 'updated', $effective, $effective, $revision, (string) $actor->getKey());

                    return $this->compose($this->campaign($campaignId, false), $storePublished);
                },
            ));
        });
    }

    /** @return array<string, mixed> */
    public function activate(Tenant $tenant, User $actor, string $campaignId, int $expectedRevision): array
    {
        return $this->transition($tenant, $actor, $campaignId, $expectedRevision, 'activate');
    }

    /** @return array<string, mixed> */
    public function pause(Tenant $tenant, User $actor, string $campaignId, int $expectedRevision): array
    {
        return $this->transition($tenant, $actor, $campaignId, $expectedRevision, 'pause');
    }

    /** @return array<string, mixed> */
    public function resume(Tenant $tenant, User $actor, string $campaignId, int $expectedRevision): array
    {
        return $this->transition($tenant, $actor, $campaignId, $expectedRevision, 'resume');
    }

    /** @return array<string, mixed> */
    public function end(Tenant $tenant, User $actor, string $campaignId, int $expectedRevision): array
    {
        return $this->transition($tenant, $actor, $campaignId, $expectedRevision, 'end');
    }

    /** @return array<string, mixed> */
    public function archive(Tenant $tenant, User $actor, string $campaignId, int $expectedRevision): array
    {
        return $this->transition($tenant, $actor, $campaignId, $expectedRevision, 'archive');
    }

    /** @return array<string, mixed> */
    private function transition(Tenant $tenant, User $actor, string $campaignId, int $expectedRevision, string $action): array
    {
        if ($expectedRevision < 1) {
            throw ValidationException::withMessages(['revision' => ['The campaign revision must be positive.']]);
        }

        return $this->access->forManager($tenant, $actor, function (Tenant $lockedTenant) use ($actor, $campaignId, $expectedRevision, $action): array {
            $storePublished = $this->storePublished($lockedTenant);

            return $lockedTenant->run(fn (): array => DB::connection('tenant')->transaction(
                function () use ($actor, $campaignId, $expectedRevision, $action, $storePublished): array {
                    $this->assertReady();
                    $campaign = $this->campaign($campaignId, true);
                    $this->assertRevision($campaign, $expectedRevision);
                    $effective = MarketingCampaignContract::effectiveState($campaign);
                    $allowed = match ($action) {
                        'activate' => $effective === 'draft',
                        'pause' => in_array($effective, ['scheduled', 'active'], true),
                        'resume' => $effective === 'paused',
                        'end' => in_array($effective, ['scheduled', 'active', 'paused'], true),
                        'archive' => in_array($effective, ['draft', 'paused', 'ended'], true),
                        default => false,
                    };
                    if (! $allowed) {
                        throw new MarketingCampaignConflict('The campaign lifecycle transition is invalid.', 'campaign_state_transition_invalid');
                    }
                    $this->eligibility->reasons($campaign, $storePublished, true);
                    if (in_array($action, ['activate', 'resume'], true)) {
                        $this->eligibility->assertEligible($campaign, $storePublished, true);
                    }

                    $transition = [
                        'activate' => ['state' => MarketingCampaignState::Active->value, 'event' => 'activated'],
                        'pause' => ['state' => MarketingCampaignState::Paused->value, 'event' => 'paused'],
                        'resume' => ['state' => MarketingCampaignState::Active->value, 'event' => 'resumed'],
                        'end' => ['state' => MarketingCampaignState::Ended->value, 'event' => 'ended'],
                        'archive' => ['state' => MarketingCampaignState::Archived->value, 'event' => 'archived'],
                    ][$action] ?? throw new \LogicException('Unsupported campaign transition action.');
                    $nextState = $transition['state'];
                    $event = $transition['event'];
                    $revision = (int) $campaign->revision + 1;
                    $now = now('UTC');
                    $values = [
                        'state' => $nextState,
                        'revision' => $revision,
                        'updated_by_ulid' => (string) $actor->getKey(),
                        'updated_at' => $now,
                    ];
                    if ($action === 'activate') {
                        $values['activated_at'] = $campaign->activated_at ?? $now;
                    } elseif ($action === 'pause') {
                        $values['paused_at'] = $now;
                    } elseif ($action === 'end') {
                        $values['ended_at'] = $now;
                    } elseif ($action === 'archive') {
                        $values['archived_at'] = $now;
                        if ($effective === 'ended' && $campaign->ended_at === null) {
                            $values['ended_at'] = $campaign->ends_at ?? $now;
                        }
                    }
                    DB::connection('tenant')->table('marketing_campaigns')->where('id', $campaignId)->update($values);
                    $this->event($campaignId, $event, $effective, $nextState, $revision, (string) $actor->getKey());

                    return $this->compose($this->campaign($campaignId, false), $storePublished);
                },
            ));
        });
    }

    private function assertReady(): void
    {
        if (! MarketingCampaignSchema::ready()) {
            throw new MarketingCampaignConflict('The tenant marketing campaign schema is not ready.', 'marketing_campaigns_not_ready');
        }
    }

    private function campaign(string $campaignId, bool $lock): object
    {
        $query = DB::connection('tenant')->table('marketing_campaigns')->where('id', $campaignId);
        if ($lock) {
            $query->lockForUpdate();
        }
        $campaign = $query->first();
        if ($campaign === null) {
            throw new MarketingCampaignConflict('The campaign was not found.', 'campaign_not_found', 404);
        }

        return $campaign;
    }

    private function assertRevision(object $campaign, int $expectedRevision): void
    {
        if ((int) $campaign->revision !== $expectedRevision) {
            throw new MarketingCampaignConflict('The campaign changed on another device.', 'campaign_revision_conflict');
        }
    }

    private function storePublished(Tenant $tenant): bool
    {
        $domain = Domain::query()
            ->whereKey($tenant->getAttribute('published_domain_id'))
            ->where('tenant_id', $tenant->getKey())
            ->first();

        return $domain instanceof Domain && TenantRuntimeReadiness::check($tenant, (string) $domain->getAttribute('domain'));
    }

    /** @return array<string, mixed> */
    private function compose(object $campaign, bool $storePublished): array
    {
        $reasons = $this->eligibility->reasons($campaign, $storePublished);

        return [
            'id' => (string) $campaign->id,
            'name' => (string) $campaign->name,
            'objective' => (string) $campaign->objective,
            'state' => (string) $campaign->state,
            'effectiveState' => MarketingCampaignContract::effectiveState($campaign),
            'startsAt' => $this->date($campaign->starts_at),
            'endsAt' => $this->date($campaign->ends_at),
            'target' => [
                'type' => (string) $campaign->target_type,
                'value' => $campaign->target_value === null ? null : (string) $campaign->target_value,
            ],
            'couponCode' => $campaign->coupon_code === null ? null : (string) $campaign->coupon_code,
            'revision' => (int) $campaign->revision,
            'healthStatus' => $reasons === [] ? 'healthy' : 'degraded',
            'healthReasons' => $reasons,
            'createdBy' => (string) $campaign->created_by_ulid,
            'updatedBy' => (string) $campaign->updated_by_ulid,
            'createdAt' => $this->date($campaign->created_at),
            'updatedAt' => $this->date($campaign->updated_at),
        ];
    }

    private function event(string $campaignId, string $type, ?string $from, string $to, int $revision, string $actorId): void
    {
        DB::connection('tenant')->table('marketing_campaign_events')->insert([
            'id' => (string) Str::uuid(),
            'campaign_id' => $campaignId,
            'event_type' => $type,
            'from_state' => $from,
            'to_state' => $to,
            'campaign_revision' => $revision,
            'actor_user_ulid' => $actorId,
            'metadata' => json_encode((object) [], JSON_THROW_ON_ERROR),
            'occurred_at' => now('UTC'),
        ]);
    }

    private function date(mixed $value): ?string
    {
        return $value === null ? null : CarbonImmutable::parse((string) $value)->utc()->format('Y-m-d\TH:i:s.u\Z');
    }
}
