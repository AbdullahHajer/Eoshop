<?php

namespace App\Support;

use App\Enums\MarketingCampaignChannel;
use App\Enums\MarketingCampaignObjective;
use App\Enums\MarketingCampaignState;
use App\Enums\MarketingCampaignTargetType;
use App\Exceptions\MarketingCampaignConflict;
use Carbon\CarbonImmutable;
use DateTimeImmutable;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class MarketingCampaignContract
{
    public const TENANT_SCOPE_ID = '00000000-0000-0000-0000-000000000000';

    /** @return array{name: string, objective: string, startsAt: ?string, endsAt: ?string, targetType: string, targetValue: ?string, couponCode: ?string} */
    public static function createPayload(array $payload): array
    {
        self::assertOnlyKeys($payload, ['name', 'objective', 'startsAt', 'endsAt', 'target', 'couponCode']);
        $name = self::name($payload['name'] ?? null);
        $objective = self::objective($payload['objective'] ?? null);
        [$targetType, $targetValue] = self::target($payload['target'] ?? null);
        $startsAt = self::utcDate($payload['startsAt'] ?? null, 'startsAt');
        $endsAt = self::utcDate($payload['endsAt'] ?? null, 'endsAt');
        self::assertSchedule($startsAt, $endsAt);

        return [
            'name' => $name,
            'objective' => $objective,
            'startsAt' => $startsAt,
            'endsAt' => $endsAt,
            'targetType' => $targetType,
            'targetValue' => $targetValue,
            'couponCode' => self::coupon($payload['couponCode'] ?? null),
        ];
    }

    /** @return array<string, string|null> */
    public static function patchPayload(array $payload): array
    {
        self::assertOnlyKeys($payload, ['name', 'objective', 'startsAt', 'endsAt', 'target', 'couponCode']);
        $normalized = [];
        if (array_key_exists('name', $payload)) {
            $normalized['name'] = self::name($payload['name']);
        }
        if (array_key_exists('objective', $payload)) {
            $normalized['objective'] = self::objective($payload['objective']);
        }
        if (array_key_exists('startsAt', $payload)) {
            $normalized['startsAt'] = self::utcDate($payload['startsAt'], 'startsAt');
        }
        if (array_key_exists('endsAt', $payload)) {
            $normalized['endsAt'] = self::utcDate($payload['endsAt'], 'endsAt');
        }
        if (array_key_exists('target', $payload)) {
            [$normalized['targetType'], $normalized['targetValue']] = self::target($payload['target']);
        }
        if (array_key_exists('couponCode', $payload)) {
            $normalized['couponCode'] = self::coupon($payload['couponCode']);
        }

        return $normalized;
    }

    public static function assertSchedule(?string $startsAt, ?string $endsAt): void
    {
        if ($startsAt !== null && $endsAt !== null && CarbonImmutable::parse($startsAt)->gte(CarbonImmutable::parse($endsAt))) {
            throw new MarketingCampaignConflict('Campaign start must precede its end.', 'campaign_schedule_invalid', 422);
        }
    }

    public static function effectiveState(object $campaign, ?CarbonImmutable $now = null): string
    {
        $state = MarketingCampaignState::from((string) $campaign->state);
        $now ??= CarbonImmutable::now('UTC');
        if ($state === MarketingCampaignState::Archived) {
            return MarketingCampaignState::Archived->value;
        }
        if ($state === MarketingCampaignState::Ended) {
            return MarketingCampaignState::Ended->value;
        }
        if (in_array($state, [MarketingCampaignState::Active, MarketingCampaignState::Paused], true)
            && $campaign->ends_at !== null
            && CarbonImmutable::parse((string) $campaign->ends_at)->utc()->lte($now)) {
            return MarketingCampaignState::Ended->value;
        }
        if ($state === MarketingCampaignState::Paused) {
            return MarketingCampaignState::Paused->value;
        }
        if ($state === MarketingCampaignState::Active
            && $campaign->starts_at !== null
            && CarbonImmutable::parse((string) $campaign->starts_at)->utc()->gt($now)) {
            return 'scheduled';
        }

        return $state->value;
    }

    public static function canonicalCategory(string $value): string
    {
        $collapsed = preg_replace('/\s+/u', ' ', trim($value));

        return mb_strtolower($collapsed ?? '');
    }

    /** @return array{source: string, medium: string} */
    public static function channelUtm(MarketingCampaignChannel $channel): array
    {
        return match ($channel) {
            MarketingCampaignChannel::Instagram => ['source' => 'instagram', 'medium' => 'social'],
            MarketingCampaignChannel::Facebook => ['source' => 'facebook', 'medium' => 'social'],
            MarketingCampaignChannel::WhatsApp => ['source' => 'whatsapp', 'medium' => 'messaging'],
            MarketingCampaignChannel::Google => ['source' => 'google', 'medium' => 'search'],
            MarketingCampaignChannel::Email => ['source' => 'email', 'medium' => 'email'],
            MarketingCampaignChannel::Other => ['source' => 'other', 'medium' => 'referral'],
        };
    }

    public static function channel(mixed $value): MarketingCampaignChannel
    {
        if (! is_string($value)) {
            throw new MarketingCampaignConflict('The campaign channel is invalid.', 'campaign_channel_invalid', 422);
        }

        return MarketingCampaignChannel::tryFrom($value)
            ?? throw new MarketingCampaignConflict('The campaign channel is invalid.', 'campaign_channel_invalid', 422);
    }

    public static function idempotencyKey(string $value): string
    {
        if (! Str::isUuid($value)) {
            throw ValidationException::withMessages(['idempotencyKey' => ['The idempotency key must be a UUID.']]);
        }

        return strtolower($value);
    }

    public static function validOpaqueToken(string $token): bool
    {
        return strlen($token) === 43 && preg_match('/^[A-Za-z0-9_-]{43}$/', $token) === 1;
    }

    private static function name(mixed $value): string
    {
        if (! is_string($value) || ($value = trim($value)) === '' || mb_strlen($value) > 120) {
            throw ValidationException::withMessages(['name' => ['The campaign name must contain 1 to 120 characters.']]);
        }

        return $value;
    }

    private static function objective(mixed $value): string
    {
        if (! is_string($value) || MarketingCampaignObjective::tryFrom($value) === null) {
            throw ValidationException::withMessages(['objective' => ['The campaign objective is invalid.']]);
        }

        return $value;
    }

    /** @return array{string, ?string} */
    private static function target(mixed $value): array
    {
        if (! is_array($value)) {
            throw new MarketingCampaignConflict('The campaign target is invalid.', 'campaign_target_unavailable', 422);
        }
        self::assertOnlyKeys($value, ['type', 'value'], 'target');
        $type = is_string($value['type'] ?? null) ? MarketingCampaignTargetType::tryFrom($value['type']) : null;
        if ($type === null) {
            throw new MarketingCampaignConflict('The campaign target is invalid.', 'campaign_target_unavailable', 422);
        }
        if ($type === MarketingCampaignTargetType::Store) {
            if (array_key_exists('value', $value) && $value['value'] !== null) {
                throw new MarketingCampaignConflict('Store campaigns cannot carry a target value.', 'campaign_target_unavailable', 422);
            }

            return [$type->value, null];
        }
        if (! is_string($value['value'] ?? null)) {
            throw new MarketingCampaignConflict('The campaign target is invalid.', 'campaign_target_unavailable', 422);
        }
        $targetValue = $type === MarketingCampaignTargetType::Category
            ? self::canonicalCategory($value['value'])
            : strtolower(trim($value['value']));
        if ($targetValue === '' || mb_strlen($targetValue) > 255
            || ($type === MarketingCampaignTargetType::Product && ! Str::isUuid($targetValue))) {
            throw new MarketingCampaignConflict('The campaign target is invalid.', 'campaign_target_unavailable', 422);
        }

        return [$type->value, $targetValue];
    }

    private static function coupon(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! is_string($value)) {
            throw new MarketingCampaignConflict('The campaign coupon is invalid.', 'campaign_coupon_invalid', 422);
        }
        $canonical = mb_strtoupper(trim($value));
        if ($canonical === '' || strlen($canonical) > 50 || preg_match('/^[A-Z0-9_-]+$/', $canonical) !== 1) {
            throw new MarketingCampaignConflict('The campaign coupon is invalid.', 'campaign_coupon_invalid', 422);
        }

        return $canonical;
    }

    private static function utcDate(mixed $value, string $field): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! is_string($value)) {
            throw new MarketingCampaignConflict('The campaign schedule is invalid.', 'campaign_schedule_invalid', 422);
        }
        $parsed = null;
        foreach (['Y-m-d\TH:i:sP', 'Y-m-d\TH:i:s.vP'] as $format) {
            $candidate = DateTimeImmutable::createFromFormat('!'.$format, $value);
            $errors = DateTimeImmutable::getLastErrors();
            if ($candidate instanceof DateTimeImmutable && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))) {
                $parsed = $candidate;
                break;
            }
        }
        if (! $parsed instanceof DateTimeImmutable || $parsed->getOffset() !== 0) {
            throw new MarketingCampaignConflict("{$field} must be an RFC3339 UTC timestamp.", 'campaign_schedule_invalid', 422);
        }

        return CarbonImmutable::instance($parsed)->utc()->format('Y-m-d\TH:i:s.u\Z');
    }

    /** @param list<string> $allowed */
    private static function assertOnlyKeys(array $payload, array $allowed, string $field = 'campaign'): void
    {
        $unknown = array_values(array_diff(array_keys($payload), $allowed));
        if ($unknown !== []) {
            throw ValidationException::withMessages([$field => ['Unknown fields: '.implode(', ', $unknown).'.']]);
        }
    }
}
