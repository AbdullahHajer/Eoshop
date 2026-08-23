<?php

namespace App\Services;

use App\Enums\StoreOnboardingStage;
use App\Models\Plan;
use App\Models\StoreDraft;
use App\Support\PublicStoreHandle;
use App\Support\StoreWorkspaceContract;
use InvalidArgumentException;

class StoreOnboardingReadiness
{
    public function __construct(private readonly DomainReservationService $domains) {}

    /** @return array{business: bool, design: bool, review: bool, blockers: list<string>, nextRequiredStep: string}|null */
    public function inspect(StoreDraft $draft): ?array
    {
        if ($draft->getAttribute('tenant_id') !== null) {
            return null;
        }

        $stage = $draft->getAttribute('onboarding_stage');
        if (! $stage instanceof StoreOnboardingStage) {
            return [
                'business' => false,
                'design' => false,
                'review' => false,
                'blockers' => ['onboarding_stage_invalid'],
                'nextRequiredStep' => StoreOnboardingStage::Business->value,
            ];
        }

        $blockers = [];
        $business = $stage->rank() >= StoreOnboardingStage::Business->rank()
            && mb_strlen(trim((string) $draft->getAttribute('store_name'))) >= 2
            && mb_strlen(trim((string) $draft->getAttribute('business_type'))) >= 2;
        if (! $business) {
            $blockers[] = 'business_incomplete';
        }

        $config = (array) $draft->getAttribute('config');
        $design = $business
            && $stage->rank() >= StoreOnboardingStage::Design->rank()
            && ! StoreWorkspaceContract::validator($config, null)->fails();
        if ($business && ! $design) {
            $blockers[] = 'design_incomplete';
        }

        $plan = null;
        $planKey = $draft->getAttribute('plan_key');
        if (is_string($planKey) && $planKey !== '') {
            $plan = Plan::query()->whereKey($planKey)->where('is_active', true)->first();
        }
        $handleAvailable = false;
        try {
            $handle = PublicStoreHandle::normalize((string) $draft->getAttribute('handle'));
            $handleAvailable = $this->domains->isAvailable($handle);
        } catch (InvalidArgumentException) {
            // The blocker below is the public contract; raw validation details stay out of the projection.
        }
        $quotaValid = $design && $plan instanceof Plan
            && ! StoreWorkspaceContract::validator(
                $config,
                $plan->getAttribute('max_products') === null ? null : (int) $plan->getAttribute('max_products'),
            )->fails();
        $review = $design
            && $stage->rank() >= StoreOnboardingStage::Review->rank()
            && $plan instanceof Plan
            && $handleAvailable
            && $quotaValid;
        if ($design && ! $plan instanceof Plan) {
            $blockers[] = 'plan_unavailable';
        }
        if ($design && ! $handleAvailable) {
            $blockers[] = 'domain_unavailable';
        }
        if ($design && $plan instanceof Plan && ! $quotaValid) {
            $blockers[] = 'plan_quota_exceeded';
        }

        return [
            'business' => $business,
            'design' => $design,
            'review' => $review,
            'blockers' => array_values(array_unique($blockers)),
            'nextRequiredStep' => ! $business
                ? StoreOnboardingStage::Business->value
                : (! $design ? StoreOnboardingStage::Design->value : (! $review ? StoreOnboardingStage::Review->value : 'submit')),
        ];
    }
}
