<?php

namespace App\Services;

use App\Enums\PlanActivationMode;
use App\Enums\SubscriptionActivationSource;
use App\Enums\SubscriptionStatus;
use App\Enums\SystemRole;
use App\Enums\TenantMembershipStatus;
use App\Enums\TenantVerificationStatus;
use App\Exceptions\StoreSubmissionConflict;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class SubscriptionService
{
    public function __construct(private readonly AdminAuditService $audit) {}

    public function assertStoreQuota(User $actor): void
    {
        $nowUtc = CarbonImmutable::now('UTC');
        $starterLimit = (int) Plan::query()->whereKey('starter')->value('max_stores');
        $entitledLimit = (int) DB::table('tenant_subscriptions')
            ->join('plans', 'plans.key', '=', 'tenant_subscriptions.plan_key')
            ->join('tenant_user', 'tenant_user.tenant_id', '=', 'tenant_subscriptions.tenant_id')
            ->join('roles', 'roles.id', '=', 'tenant_user.role_id')
            ->where('tenant_user.user_id', $actor->getKey())
            ->where('tenant_user.status', TenantMembershipStatus::Active->value)
            ->where('roles.key', SystemRole::MerchantOwner->value)
            ->where('tenant_subscriptions.status', SubscriptionStatus::Active->value)
            ->where(function ($query) use ($nowUtc): void {
                $query->whereNull('tenant_subscriptions.starts_at')
                    ->orWhere('tenant_subscriptions.starts_at', '<=', $nowUtc);
            })
            ->where(function ($query) use ($nowUtc): void {
                $query->whereNull('tenant_subscriptions.ends_at')
                    ->orWhere('tenant_subscriptions.ends_at', '>', $nowUtc);
            })
            ->max('plans.max_stores');
        $limit = max($starterLimit, $entitledLimit);
        $currentStores = DB::table('store_submissions')
            ->join('tenants', 'tenants.id', '=', 'store_submissions.tenant_id')
            ->where('store_submissions.submitted_by_user_id', $actor->getKey())
            ->where('tenants.verification_status', '!=', TenantVerificationStatus::Rejected->value)
            ->count();

        if ($currentStores >= $limit) {
            throw StoreSubmissionConflict::storeQuotaExceeded();
        }
    }

    public function createForSubmission(Tenant $tenant, Plan $plan, User $actor): TenantSubscription
    {
        $automatic = $plan->getAttribute('activation_mode') === PlanActivationMode::Automatic;

        return TenantSubscription::query()->create([
            'tenant_id' => $tenant->getKey(),
            'plan_key' => $plan->getKey(),
            'status' => $automatic ? SubscriptionStatus::Active : SubscriptionStatus::PendingActivation,
            'activation_source' => $automatic
                ? SubscriptionActivationSource::AutomaticFree
                : SubscriptionActivationSource::ManualPending,
            'requested_by_user_id' => $actor->getKey(),
            'activated_by_user_id' => null,
            'starts_at' => $automatic ? CarbonImmutable::now('UTC') : null,
            'ends_at' => null,
            'cancelled_at' => null,
        ]);
    }

    public function forResubmission(
        Tenant $tenant,
        Plan $plan,
        User $actor,
        TenantSubscription $current,
    ): TenantSubscription {
        if ($current->getAttribute('tenant_id') !== $tenant->getKey()) {
            throw new DomainException('The subscription does not belong to the resubmitted store.');
        }

        $status = $current->getAttribute('status');
        if ($status === SubscriptionStatus::Active && ! $current->isCurrentlyActive()) {
            $current->forceFill(['status' => SubscriptionStatus::Expired])->save();
            $status = SubscriptionStatus::Expired;
        }

        if ($current->getAttribute('plan_key') === $plan->getKey()
            && in_array($status, [SubscriptionStatus::PendingActivation, SubscriptionStatus::Active], true)
        ) {
            return $current;
        }

        if (in_array($status, [SubscriptionStatus::PendingActivation, SubscriptionStatus::Active], true)) {
            $current->forceFill([
                'status' => SubscriptionStatus::Cancelled,
                'cancelled_at' => CarbonImmutable::now('UTC'),
            ])->save();
        }

        return $this->createForSubmission($tenant, $plan, $actor);
    }

    public function activate(Tenant $tenant, User $actor, DateTimeInterface $endsAt, Request $request): TenantSubscription
    {
        $end = CarbonImmutable::instance($endsAt);
        $nowUtc = CarbonImmutable::now('UTC');
        if ($end->lessThanOrEqualTo($nowUtc) || $end->greaterThan($nowUtc->addYear())) {
            throw new DomainException('The entitlement end date must be in the future and no more than one year away.');
        }

        return DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($tenant, $actor, $end, $request): TenantSubscription {
                $lockedTenant = Tenant::query()->whereKey($tenant->getKey())->lockForUpdate()->firstOrFail();
                Gate::forUser($actor)->authorize('activateSubscription', $lockedTenant);
                $subscription = TenantSubscription::query()
                    ->with('plan')
                    ->where('tenant_id', $lockedTenant->getKey())
                    ->whereIn('status', [SubscriptionStatus::PendingActivation, SubscriptionStatus::Active])
                    ->lockForUpdate()
                    ->firstOrFail();

                $renewing = $subscription->getAttribute('status') === SubscriptionStatus::Active
                    && ! $subscription->isCurrentlyActive();
                if ($subscription->getAttribute('status') === SubscriptionStatus::Active && ! $renewing) {
                    return $subscription;
                }
                if ($subscription->plan->getAttribute('activation_mode') !== PlanActivationMode::Manual) {
                    throw new DomainException('Only a pending manually activated package can be activated here.');
                }

                $oldValues = [
                    'subscription_status' => $subscription->getAttribute('status')->value,
                    'plan_key' => $subscription->getAttribute('plan_key'),
                    'ends_at' => $subscription->getAttribute('ends_at')?->toIso8601String(),
                ];
                $subscription->forceFill([
                    'status' => SubscriptionStatus::Active,
                    'activation_source' => SubscriptionActivationSource::ManualAdmin,
                    'activated_by_user_id' => $actor->getKey(),
                    'starts_at' => CarbonImmutable::now('UTC'),
                    'ends_at' => $end,
                ])->save();
                $this->audit->record(
                    request: $request,
                    actor: $actor,
                    action: $renewing
                        ? 'platform.store.subscription.renewed'
                        : 'platform.store.subscription.activated',
                    subject: $lockedTenant,
                    tenant: $lockedTenant,
                    oldValues: $oldValues,
                    newValues: [
                        'subscription_status' => SubscriptionStatus::Active->value,
                        'plan_key' => $subscription->getAttribute('plan_key'),
                        'ends_at' => $end->toIso8601String(),
                    ],
                );

                return $subscription->refresh()->load('plan');
            });
    }
}
